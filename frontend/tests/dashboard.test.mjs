import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Render the real Dashboard, heading, icons and Next Link using the existing runner.
const directory = await mkdtemp(fileURLToPath(new URL(".dashboard-render-test-", import.meta.url)));
const modules = [
  ["../src/components/icon.tsx", "icon.mjs"],
  ["../src/components/page-heading.tsx", "page-heading.mjs"],
  ["../src/app/page.tsx", "page.mjs"],
];
let Dashboard;
try {
  for (const [sourcePath, filename] of modules) {
    const source = (await readFile(new URL(sourcePath, import.meta.url), "utf8"))
      .replace('"next/link"', '"next/link.js"')
      .replace('"@/components/icon"', '"./icon.mjs"')
      .replace('"@/components/page-heading"', '"./page-heading.mjs"');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    await writeFile(join(directory, filename), compiled);
  }
  ({ default: Dashboard } = await import(pathToFileURL(join(directory, "page.mjs")).href));
} finally {
  for (const [, filename] of modules) await unlink(join(directory, filename)).catch(() => {});
  await rmdir(directory);
}
const html = renderToStaticMarkup(createElement(Dashboard));
const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

test("Dashboard renders three available cards with the correct actions and destinations", () => {
  const cards = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(cards.length, 3);
  for (const [index, [href, title, action]] of [
    ["/sales-reports", "Sales Reports", "View Reports"],
    ["/upload-report", "Upload Report", "Upload Report"],
    ["/ai-assistant", "AI Assistant", "Open AI Assistant"],
  ].entries()) {
    assert.equal(cards[index][1], href);
    assert.match(cards[index][2], new RegExp(`<h3[^>]*>${title}</h3>`));
    assert.match(cards[index][2], />Available<\/span>/);
    assert.match(cards[index][2], new RegExp(`>${action} <svg`));
  }
});

test("Dashboard describes implemented capabilities without placeholder or service-health claims", () => {
  for (const phrase of ["n8n report catalog", "search and filter", "multiple uploads", "Google Drive", "server-side validation", "Google Sheets logging", "duplicate and error handling", "retrieved report content", "conversation memory", "Markdown responses"]) assert.ok(text.includes(phrase), phrase);
  assert.match(text, /Workspace ready · Local development/);
  assert.match(text, /Available means the feature is implemented and tested/);
  assert.match(text, /does not run live health checks/);
  assert.doesNotMatch(text, /placeholder|planned|UI preview|future home|once a sandbox|Phase 1|No verified live connection|Waiting for a future connection|\bconnected\b|\bonline\b|\bhealthy\b/i);
});

test("shared footer and metadata no longer describe an unimplemented application", async () => {
  const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  const footer = layout.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(footer);
  assert.match(footer, /Workspace ready · Local development/);
  assert.doesNotMatch(layout, /Integration not live-tested|Frontend preview|no connected business data/i);
  assert.match(layout, /description: "NileMart retail intelligence workspace for sales reports, PDF uploads, and AI-powered report questions\."/);
});
