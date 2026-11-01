import type { ReportUpload } from "./report-upload.ts";
import { parseUploadResult, uploadResult, type UploadResult } from "./upload-result.ts";

type UploadFetch = (url: string, init: RequestInit) => Promise<Response>;

export async function submitReport(report: ReportUpload, send: UploadFetch): Promise<UploadResult> {
  if (!report.file) return uploadResult("INVALID_FILE");
  const form = new FormData();
  // Browsers sometimes omit MIME metadata; the client has already checked the header.
  const file = report.file.type ? report.file : new File([report.file], report.file.name, { type: "application/pdf" });
  form.set("file", file, file.name);
  form.set("branch", report.branch);
  form.set("report_month", report.report_month);
  try {
    const response = await send("/api/reports/upload", {
      method: "POST", body: form, headers: { "X-NileMart-Upload": "1" },
      credentials: "same-origin", redirect: "error", signal: AbortSignal.timeout(135_000),
    });
    return parseUploadResult(response.status, await response.json());
  } catch {
    // A browser/network failure cannot establish that the server did not upload.
    return uploadResult("UNCONFIRMED");
  }
}
