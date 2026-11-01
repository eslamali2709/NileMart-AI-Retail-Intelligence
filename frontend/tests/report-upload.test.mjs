import assert from "node:assert/strict";
import { test } from "node:test";
import { BRANCHES, formatFileSize, isBranch, isReportMonth, validatePdf } from "../src/lib/report-upload.ts";

test("branch and month fields preserve the expected contract", () => {
  assert.deepEqual(BRANCHES, ["Cairo", "Alexandria", "Mansoura", "Giza"]);
  assert.equal(isBranch("Cairo"), true);
  for (const branch of ["", "cairo", "Other"]) assert.equal(isBranch(branch), false);
  for (const month of ["2026-01", "2026-12"]) assert.equal(isReportMonth(month), true);
  for (const month of ["", "2026-00", "2026-13", "2026-1", "26-01", "2026-01-01", "0000-01"]) assert.equal(isReportMonth(month), false);
});

test("PDF screening rejects empty, renamed, and conflicting-type files", async () => {
  assert.equal(await validatePdf(new File(["%PDF-1.7\n"], "report.PDF", { type: "application/pdf" })), null);
  assert.equal(await validatePdf(new File(["%PDF-1.7\n"], "report.pdf")), null);
  for (const file of [
    new File([], "empty.pdf", { type: "application/pdf" }),
    new File(["plain text"], "renamed.pdf", { type: "application/pdf" }),
    new File(["%PDF-1.7"], "report.txt", { type: "application/pdf" }),
    new File(["%PDF-1.7"], "report.pdf", { type: "text/plain" }),
  ]) assert.equal(typeof await validatePdf(file), "string");
});

test("unreadable files produce actionable feedback", async () => {
  const file = new File(["%PDF-1.7"], "report.pdf");
  file.slice = () => { throw new Error("File unavailable"); };
  assert.match(await validatePdf(file), /could not be read/);
});

test("file sizes remain readable across units", () => {
  assert.equal(formatFileSize(0), "0 bytes");
  assert.equal(formatFileSize(1), "1 byte");
  assert.equal(formatFileSize(1024), "1 KB");
  assert.equal(formatFileSize(1536), "1.5 KB");
  assert.equal(formatFileSize(1024 ** 2), "1 MB");
  assert.equal(formatFileSize(1024 ** 3), "1 GB");
});
