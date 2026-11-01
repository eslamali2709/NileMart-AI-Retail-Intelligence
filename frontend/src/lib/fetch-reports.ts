import { parseReportsCatalog, REPORT_ERRORS, type ReportsCatalog, type ReportsError } from "./reports.ts";

type Result = { success: true; catalog: ReportsCatalog } | { success: false; message: string };

export async function fetchReports(signal: AbortSignal, request: typeof fetch = fetch): Promise<Result> {
  try {
    const response = await request("/api/reports", { method: "GET", cache: "no-store", credentials: "same-origin", signal });
    const body: unknown = await response.json();
    if (response.ok) {
      const catalog = parseReportsCatalog(body);
      return catalog ? { success: true, catalog } : { success: false, message: REPORT_ERRORS.INVALID_RESPONSE };
    }
    const code = body && typeof body === "object" && "code" in body ? body.code : null;
    return { success: false, message: typeof code === "string" && Object.hasOwn(REPORT_ERRORS, code) ? REPORT_ERRORS[code as ReportsError] : REPORT_ERRORS.UNAVAILABLE };
  } catch { return { success: false, message: REPORT_ERRORS.UNAVAILABLE }; }
}
