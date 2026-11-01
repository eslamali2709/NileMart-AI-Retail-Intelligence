import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Node's existing strip-types runner cannot parse TSX. Compile the real component
// using the project's TypeScript, without adding a second runner or mocking Markdown.
const source = await readFile(new URL("../src/components/chat/assistant-markdown.tsx", import.meta.url), "utf8");
const temporaryDirectory = await mkdtemp(fileURLToPath(new URL(".markdown-render-test-", import.meta.url)));
const compiledPath = join(temporaryDirectory, "assistant-markdown.mjs");
let AssistantMarkdown;
try {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: "assistant-markdown.tsx",
  });
  await writeFile(compiledPath, outputText);
  ({ AssistantMarkdown } = await import(pathToFileURL(compiledPath).href));
} finally {
  await unlink(compiledPath).catch(() => {});
  await rmdir(temporaryDirectory);
}
const render = (text) => renderToStaticMarkup(createElement(AssistantMarkdown, { text }));
const filename = "NileMart_CAI_2026-10_Sales_Inventory.pdf";

test("renders bold, italic, paragraphs, and soft/hard line breaks", () => {
  const html = render("**Net sales:** *EGP 894,275*\nNext line\n\nAnother paragraph.  \nHard break.");
  assert.match(html, /<strong>Net sales:<\/strong>/);
  assert.match(html, /<em>EGP 894,275<\/em><br\/>\nNext line/);
  assert.match(html, /<p>Another paragraph\.<br\/>\nHard break\.<\/p>/);
});

test("renders bullet lists, nested lists, and numbered lists with their start number", () => {
  const html = render("- Cairo\n  - Inventory risk\n- Giza\n\n3. Review report\n4. Confirm period");
  assert.equal((html.match(/<ul>/g) || []).length, 2);
  assert.match(html, /<li>Inventory risk<\/li>/);
  assert.match(html, /<ol start="3">/);
  assert.match(html, /<li>Confirm period<\/li>/);
});

test("renders all heading levels as semantic headings", () => {
  const html = render(Array.from({ length: 6 }, (_, index) => `${"#".repeat(index + 1)} Heading ${index + 1}`).join("\n\n"));
  for (let level = 1; level <= 6; level++) assert.ok(html.includes(`<h${level}>Heading ${level}</h${level}>`));
});

test("renders inline and fenced code while escaping HTML inside code", () => {
  const html = render("Use `net_sales`.\n\n```html\n<script>alert('unsafe')</script>\n  indented\n```");
  assert.match(html, /<code>net_sales<\/code>/);
  assert.match(html, /<pre[^>]*tabindex="0"[^>]*><code class="language-html">/);
  assert.match(html, /&lt;script&gt;alert\(&#x27;unsafe&#x27;\)&lt;\/script&gt;\n  indented/);
  assert.doesNotMatch(html, /<script/i);
});

test("renders GFM tables with header cells and a keyboard-accessible scroll region", () => {
  const html = render(`| Branch | Net sales | Source |\n| :--- | ---: | --- |\n| Cairo | **894,275** | ${filename} |`);
  assert.match(html, /role="region" aria-label="Report data table" tabindex="0"/);
  assert.match(html, /<table[^>]*><thead>/);
  assert.match(html, /<th[^>]*>Net sales<\/th>/);
  assert.match(html, /<td[^>]*><strong>894,275<\/strong><\/td>/);
  assert.ok(html.includes(filename));
});

test("preserves exact filenames in prose, emphasis, code, lists, tables, and source links", () => {
  for (const name of [filename, "NileMart_ALX_2026-09_Sales_Inventory.pdf", "report__final_v2.pdf"]) {
    for (const text of [name, `**${name}**`, `\`${name}\``, `- ${name}`, `| Source |\n| --- |\n| ${name} |`, `[${name}](https://example.com/report.pdf)`]) {
      assert.ok(render(text).includes(name), `Filename changed in ${text}`);
    }
  }
});

test("renders source links and GFM autolinks with safe new-tab attributes", () => {
  const html = render(`[${filename}](https://example.com/report.pdf?download=1 "Source report")\n\nhttps://example.com/another-report\n\n[Local](/reports/cairo) [Section](#sources)`);
  assert.match(html, /href="https:\/\/example\.com\/report\.pdf\?download=1" title="Source report" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /href="https:\/\/example\.com\/another-report"/);
  assert.match(html, /href="\/reports\/cairo"/);
  assert.match(html, /href="#sources"/);
});

test("unsafe and unsupported link protocols remain non-clickable text", () => {
  for (const url of ["javascript:alert%281%29", "JaVaScRiPt:alert%281%29", "javascript&#x3a;alert%281%29", "data:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox%281%29", "file:///private/report.pdf", "//untrusted.example/report", "java%73cript:alert%281%29"]) {
    const html = render(`[Source](${url})`);
    assert.doesNotMatch(html, /<a\b|href=/i, url);
    assert.match(html, /Source/);
  }
});

test("raw HTML, scripts, event handlers, SVG, and iframes never become executable elements", () => {
  const html = render('Safe **answer**.\n\n<script>alert("unsafe")</script>\n\n<img src=x onerror=alert(1)>\n\n<svg onload=alert(1)></svg>\n\n<iframe src="https://example.com"></iframe>\n\n<a href="javascript:alert(1)" onclick="alert(1)">Raw link</a>\n\nStill safe.');
  assert.doesNotMatch(html, /<script|<img|<svg|<iframe|<a\b|onerror=|onload=|onclick=|javascript:/i);
  assert.match(html, /Safe <strong>answer<\/strong>/);
  assert.match(html, /Still safe\./);
});

test("Markdown images keep alt text without loading remote content", () => {
  const html = render(`![${filename}](https://example.com/tracking.png)\n\n![unsafe](data:image/svg+xml;base64,PHN2Zz4=)`);
  assert.ok(html.includes(filename));
  assert.doesNotMatch(html, /<img|src=|tracking\.png|data:image/i);
});

test("plain text and incomplete Markdown render without losing the response", () => {
  assert.match(render("No matching reports were found."), /<p>No matching reports were found\.<\/p>/);
  assert.match(render("**Unclosed heading\n\n```\nunfinished code"), /Unclosed heading/);
  assert.match(render("**Unclosed heading\n\n```\nunfinished code"), /unfinished code/);
});
