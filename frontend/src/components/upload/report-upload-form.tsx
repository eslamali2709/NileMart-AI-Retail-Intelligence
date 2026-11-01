"use client";

import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { PdfFilePicker } from "@/components/upload/pdf-file-picker";
import { BRANCHES, isBranch, isReportMonth, validatePdf, type ReportUpload } from "@/lib/report-upload";
import { submitReport } from "@/lib/submit-report";
import type { UploadResult } from "@/lib/upload-result";

export function ReportUploadForm() {
  const [report, setReport] = useState<ReportUpload>({ file: null, branch: "", report_month: "" });
  const [touched, setTouched] = useState({ branch: false, report_month: false });
  const [fileError, setFileError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const pending = useRef(false);
  const selectionVersion = useRef(0);
  const branchError = touched.branch && !isBranch(report.branch) ? "Select the branch this report belongs to." : null;
  const monthError = touched.report_month && !isReportMonth(report.report_month) ? "Select a valid report month in YYYY-MM format." : null;
  const valid = !!report.file && !checking && isBranch(report.branch) && isReportMonth(report.report_month);
  const locked = !!result && (result.requires_manual_review || result.success || result.state === "duplicate");
  const disabled = uploading || locked;

  async function selectFiles(files: File[]) {
    if (pending.current || locked) return;
    const version = ++selectionVersion.current;
    setResult(null);
    setFileError(null);
    setReport((current) => ({ ...current, file: null }));
    setChecking(false);
    if (files.length !== 1) {
      setFileError("Choose one PDF report at a time. No file has been selected.");
      return;
    }
    setChecking(true);
    const error = await validatePdf(files[0]);
    // A slower file read must not overwrite a newer selection or removal.
    if (version !== selectionVersion.current) return;
    setChecking(false);
    setFileError(error);
    if (!error) setReport((current) => ({ ...current, file: files[0] }));
  }

  function removeFile() {
    if (pending.current || locked) return;
    selectionVersion.current += 1;
    setReport((current) => ({ ...current, file: null }));
    setChecking(false);
    setFileError("Select a PDF report to continue.");
    setResult(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || locked) return;
    setTouched({ branch: true, report_month: true });
    if (!report.file) setFileError("Select a PDF report to continue.");
    if (!valid) return;
    pending.current = true;
    setUploading(true);
    setResult(null);
    try {
      setResult(await submitReport(report, (url, init) => fetch(url, init)));
    } finally {
      pending.current = false;
      setUploading(false);
    }
  }

  function startAnotherReport() {
    if (pending.current) return;
    selectionVersion.current += 1;
    setReport({ file: null, branch: "", report_month: "" });
    setTouched({ branch: false, report_month: false });
    setFileError(null);
    setResult(null);
  }

  const inputClass = "mt-2 block min-h-12 w-full min-w-0 rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 aria-[invalid=true]:border-red-500 aria-[invalid=false]:border-stone-300";

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <form noValidate onSubmit={submit} aria-label="Sales report upload" aria-busy={uploading} onDragOver={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <section aria-labelledby="document-title" className="border-b border-stone-200 p-5 sm:p-7">
          <div className="mb-5 flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800">1</span><div><h2 id="document-title" className="text-base font-semibold">Report document <span className="text-sm font-normal text-slate-500">(required)</span></h2><p className="mt-1 text-sm leading-6 text-slate-600">Choose the original PDF for a single branch and month.</p></div></div>
          <PdfFilePicker file={report.file} error={fileError} checking={checking} disabled={disabled} onSelect={selectFiles} onRemove={removeFile} />
        </section>
        <section aria-labelledby="information-title" className="p-5 sm:p-7">
          <div className="mb-5 flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800">2</span><div><h2 id="information-title" className="text-base font-semibold">Report information</h2><p className="mt-1 text-sm leading-6 text-slate-600">Match these details to the information inside your PDF.</p></div></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label htmlFor="branch" className="text-sm font-semibold text-slate-800">Branch <span className="font-normal text-slate-500">(required)</span></label>
              <select id="branch" name="branch" required disabled={disabled} value={report.branch} aria-invalid={!!branchError} aria-describedby={branchError ? "branch-error" : undefined} className={inputClass}
                onBlur={() => setTouched((current) => ({ ...current, branch: true }))}
                onChange={(event) => { const value = event.target.value; setReport((current) => ({ ...current, branch: isBranch(value) ? value : "" })); setResult(null); }}>
                <option value="">Select a branch</option>{BRANCHES.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
              </select>
              {branchError && <p id="branch-error" className="mt-2 text-sm text-red-700" role="alert">{branchError}</p>}
            </div>
            <div><label htmlFor="report-month" className="text-sm font-semibold text-slate-800">Report month <span className="font-normal text-slate-500">(required)</span></label>
              <input id="report-month" name="report_month" type="month" required disabled={disabled} min="0001-01" max="9999-12" placeholder="YYYY-MM" value={report.report_month} aria-invalid={!!monthError} aria-describedby={`month-help${monthError ? " month-error" : ""}`} className={inputClass}
                onBlur={() => setTouched((current) => ({ ...current, report_month: true }))}
                onChange={(event) => { setReport((current) => ({ ...current, report_month: event.target.value })); setResult(null); }} />
              <p id="month-help" className="mt-2 text-xs leading-5 text-slate-500">Format: YYYY-MM. Your browser may display a localized month.</p>
              {monthError && <p id="month-error" className="mt-2 text-sm text-red-700" role="alert">{monthError}</p>}
            </div>
          </div>
        </section>
        <div className="border-t border-stone-200 bg-stone-50/70 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p id="upload-availability" className="max-w-sm text-sm leading-6 text-slate-600">{uploading ? "Sending your report and waiting for confirmation. Keep this page open." : locked ? "Review the outcome below before starting a different report." : "Confirm the branch and month before uploading. Reports are never retried automatically."}</p>
            <button type="submit" disabled={!valid || disabled} aria-describedby="upload-availability" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-slate-500"><Icon name="upload" className="size-4" />{uploading ? "Uploading…" : checking ? "Checking PDF…" : "Upload Report"}</button>
          </div>
          <div role="status" aria-live="polite" aria-atomic="true" className={result ? `mt-4 rounded-lg border p-4 text-sm leading-6 ${result.success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}` : "sr-only"}>
            {uploading ? "Uploading report. Waiting for confirmation." : result?.message}
          </div>
          {locked && <button type="button" onClick={startAnotherReport} className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">Start a different report</button>}
        </div>
      </form>
      <aside aria-label="Submission guidance" className="space-y-5">
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5"><p className="text-xs font-semibold tracking-wider text-emerald-800 uppercase">Phase 2B · Local development</p><h2 className="mt-3 text-base font-semibold text-slate-900">Review before uploading</h2><p className="mt-3 text-sm leading-6 text-slate-600">Uploading requires a configured service. Use this local application only with an isolated sandbox until integration testing is complete.</p><p className="mt-3 text-sm leading-6 text-slate-600">If an outcome is unclear, check with the operator before trying again. Leaving or refreshing clears your selection but does not cancel an upload already received.</p></section>
        <section className="rounded-xl border border-stone-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-900">Before you submit</h2><ul className="mt-4 space-y-4 text-sm leading-6 text-slate-600"><li className="border-l-2 border-emerald-200 pl-3">Use one PDF for one branch and reporting month.</li><li className="border-l-2 border-emerald-200 pl-3">Check that sales and inventory text is readable and selectable.</li><li className="border-l-2 border-emerald-200 pl-3">Confirm the branch and month match the document.</li></ul><p className="mt-5 border-t border-stone-100 pt-4 text-xs leading-5 text-slate-500">The default PDF limit is 10 MiB. The operator can configure a different server limit. A confirmed upload does not mean document indexing is complete.</p></section>
      </aside>
    </div>
  );
}
