import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { EMPTY_REPORT_FILTERS, parseReportsCatalog, reportSummary, selectReports, reportingKey, safeDriveLink } from "../src/lib/reports.ts";
import { reportsFixture } from "./fixtures/reports.mjs";

const catalog = () => parseReportsCatalog(reportsFixture());

test("all 16 uploads yield 13 branch/month periods and 3 extra uploads", () => {
  const data = catalog(); const summary = reportSummary(data.reports);
  assert.equal(summary.total, 16); assert.equal(summary.uniquePeriods, 13); assert.equal(summary.extraUploads, 3);
  assert.equal(summary.branches.length, 4); assert.equal(summary.latestMonth, "2026-10");
  const cairo = data.reports.filter(report => report.branch.toLowerCase() === "cairo" && report.report_month === "2026-09");
  assert.equal(cairo.length, 4);
  for (const report of cairo) assert.equal(summary.groups.get(reportingKey(report)), 4);
  assert.equal(new Set(cairo.map(report => report.file_link)).size, 4);
  const changed = reportSummary(data.reports.slice(0, 1));
  assert.equal(changed.total, 1); assert.equal(changed.uniquePeriods, 1); assert.equal(changed.extraUploads, 0);
  assert.equal(reportSummary([]).latestMonth, null);
});

test("search, combined filters and reset preserve original data", () => {
  const reports = catalog().reports;
  const select = override => selectReports(reports, { ...EMPTY_REPORT_FILTERS, ...override });
  assert.equal(select({ search: " cairo " }).length, 6);
  assert.equal(select({ search: "September 2026" }).length, 7);
  assert.equal(select({ search: "2026-09" }).length, 7);
  assert.equal(select({ search: "NileMart_Giza_2026-07_12.pdf" }).length, 1);
  assert.equal(select({ branch: "CAIRO", month: "2026-09" }).length, 4);
  assert.equal(select({ search: "no match" }).length, 0);
  assert.equal(select({ branch: "Giza", month: "2026-10", search: "Cairo" }).length, 0);
  assert.equal(select({}).length, 16); assert.equal(reports.length, 16);
});

test("month/upload sorting and tie breakers are deterministic; duplicate Drive IDs survive", () => {
  const reports = catalog().reports;
  const rows = selectReports(reports, EMPTY_REPORT_FILTERS);
  assert.equal(rows[0].report.report_month, "2026-10");
  assert.equal(rows[0].report.branch, "Mansoura");
  assert.equal(rows.at(-1).report.report_month, "2026-07");
  assert.equal(selectReports(reports, { ...EMPTY_REPORT_FILTERS, sort: "oldest" })[0].report.report_month, "2026-07");
  const tie = [{ ...reports[0], drive_file_id: "z" }, { ...reports[0], drive_file_id: "a" }, { ...reports[0], drive_file_id: "a" }];
  const tied = selectReports(tie, EMPTY_REPORT_FILTERS);
  assert.deepEqual(tied.map(row => row.rowId), ["a:0", "a:1", "z:0"]);
  assert.equal(tied.length, 3);
});

test("Drive link allowlist blocks unsafe hosts, protocols, credentials and mismatched IDs", () => {
  const valid = "https://drive.google.com/file/d/test_id/view";
  assert.equal(safeDriveLink(`${valid}?usp=sharing#fragment`, "test_id"), valid);
  for (const link of [null, "javascript:alert(1)", "http://drive.google.com/file/d/test_id/view", "https://drive.google.com.evil.invalid/file/d/test_id/view", "https://evil.invalid/file/d/test_id/view", "https://user:password@drive.google.com/file/d/test_id/view", "https://drive.google.com:444/file/d/test_id/view", "https://drive.google.com/file/d/another/view", "https://drive.google.com/drive/folders/test_id", "//drive.google.com/file/d/test_id/view"]) assert.equal(safeDriveLink(link, "test_id"), null);
});

// Exercise the actual table renderer using the existing TypeScript toolchain.
const source = (await readFile(new URL("../src/components/reports/reports-table.tsx", import.meta.url), "utf8"))
  .replace('"../../lib/reports.ts"', JSON.stringify(new URL("../src/lib/reports.ts", import.meta.url).href));
const directory = await mkdtemp(fileURLToPath(new URL(".reports-render-test-", import.meta.url)));
const compiled = join(directory, "reports-table.mjs");
let ReportsTable;
try {
  await writeFile(compiled, ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  ({ ReportsTable } = await import(pathToFileURL(compiled).href));
} finally { await unlink(compiled).catch(() => {}); await rmdir(directory); }
const render = (reports, filters = EMPTY_REPORT_FILTERS) => renderToStaticMarkup(createElement(ReportsTable, { rows: selectReports(reports, filters), groups: reportSummary(reports).groups }));

test("real table renders every file and all four multiple-upload badges with distinct safe links", () => {
  const reports = catalog().reports;
  const html = render(reports);
  assert.equal((html.match(/<tr\b/g) || []).length, 17);
  assert.equal((html.match(/>Multiple Uploads</g) || []).length, 4);
  assert.equal((html.match(/>Single Upload</g) || []).length, 12);
  assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 16);
  for (const report of reports) { assert.ok(html.includes(report.file_name)); assert.ok(html.includes(`href="${report.file_link}"`)); }
  const filtered = render(reports, { ...EMPTY_REPORT_FILTERS, search: "_15.pdf" });
  assert.equal((filtered.match(/>Multiple Uploads</g) || []).length, 1);
  assert.match(html, /role="region" aria-label="Sales reports table" tabindex="0"/);
});

test("table disables unsafe actions and escapes metadata without losing records", () => {
  const reports = catalog().reports;
  reports[0].file_link = "javascript:alert(1)"; reports[0].file_name = '<script>alert("x")</script>';
  const html = render(reports);
  assert.equal((html.match(/<tr\b/g) || []).length, 17);
  assert.equal((html.match(/target="_blank"/g) || []).length, 15);
  assert.match(html, /Link unavailable/); assert.doesNotMatch(html, /javascript:|<script>/);
});
