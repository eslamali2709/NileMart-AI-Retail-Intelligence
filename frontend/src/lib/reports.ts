export type Report = {
  branch: string;
  report_month: string;
  file_name: string;
  uploaded_at: string;
  drive_file_id: string;
  file_link: string | null;
};

export type ReportsCatalog = {
  success: true;
  total: number;
  branches: string[];
  latest_report_month: string | null;
  reports: Report[];
  fetched_at: string;
};

export const REPORT_ERRORS = {
  NOT_CONFIGURED: "The reports service is not configured. Check the server configuration.",
  UPSTREAM_AUTH: "The reports service could not authenticate. Check the server configuration.",
  UNAVAILABLE: "The reports service is unavailable. Please try again.",
  TIMEOUT: "The reports service took too long to respond. Please try again.",
  INVALID_RESPONSE: "The reports service returned an invalid response. Please try again.",
} as const;
export type ReportsError = keyof typeof REPORT_ERRORS;

export const normalizeBranch = (branch: string) => branch.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
export const reportingKey = (report: Report) => JSON.stringify([normalizeBranch(report.branch), report.report_month]);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const isMonth = (value: unknown): value is string => typeof value === "string" && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);
const isTimestamp = (value: unknown): value is string => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 4096;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Require an exact Drive host and matching file ID; strip query/fragment data. */
export function safeDriveLink(value: unknown, fileId: string): string | null {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(fileId)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com" || url.port || url.username || url.password
      || url.pathname !== `/file/d/${fileId}/view`) return null;
    return `https://drive.google.com/file/d/${fileId}/view`;
  } catch { return null; }
}

export function reportSummary(reports: Report[]) {
  const groups = new Map<string, number>();
  const branchMap = new Map<string, string>();
  const months = new Set<string>();
  for (const report of reports) {
    const key = reportingKey(report);
    groups.set(key, (groups.get(key) || 0) + 1);
    const branchKey = normalizeBranch(report.branch);
    if (!branchMap.has(branchKey)) branchMap.set(branchKey, report.branch);
    months.add(report.report_month);
  }
  const sortedMonths = [...months].sort((a, b) => compare(b, a));
  return {
    total: reports.length, uniquePeriods: groups.size, extraUploads: reports.length - groups.size,
    branches: [...branchMap.values()].sort((a, b) => compare(normalizeBranch(a), normalizeBranch(b))),
    months: sortedMonths, latestMonth: sortedMonths[0] || null, groups,
  };
}

/** Pick known metadata fields only. Invalid links disable the action, never drop rows. */
export function parseReportsCatalog(value: unknown): ReportsCatalog | null {
  if (!isObject(value) || value.success !== true || !Array.isArray(value.reports)
    || value.total !== value.reports.length || !Array.isArray(value.branches) || !value.branches.every(isText)
    || !(value.latest_report_month === null || isMonth(value.latest_report_month)) || !isTimestamp(value.fetched_at)) return null;
  const reports: Report[] = [];
  for (const item of value.reports) {
    if (!isObject(item) || !isText(item.branch) || !isText(item.file_name) || !isMonth(item.report_month)
      || !isTimestamp(item.uploaded_at) || !isText(item.drive_file_id)) return null;
    reports.push({
      branch: item.branch.trim().replace(/\s+/g, " "), report_month: item.report_month,
      file_name: item.file_name, uploaded_at: item.uploaded_at, drive_file_id: item.drive_file_id,
      file_link: safeDriveLink(item.file_link, item.drive_file_id),
    });
  }
  const summary = reportSummary(reports);
  return { success: true, total: reports.length, branches: summary.branches, latest_report_month: summary.latestMonth, reports, fetched_at: value.fetched_at };
}

export function formatReportMonth(month: string | null): string {
  if (!month) return "No reports yet";
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

export function formatUploadedAt(timestamp: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(timestamp));
}

export type ReportFilters = { search: string; branch: string; month: string; sort: "newest" | "oldest" };
export const EMPTY_REPORT_FILTERS: ReportFilters = { search: "", branch: "", month: "", sort: "newest" };

/** Assign identity before filtering; even repeated Drive IDs retain every source row. */
export function selectReports(reports: Report[], filters: ReportFilters) {
  const occurrences = new Map<string, number>();
  const query = filters.search.trim().toLowerCase();
  return reports.map((report, index) => {
    const occurrence = occurrences.get(report.drive_file_id) || 0;
    occurrences.set(report.drive_file_id, occurrence + 1);
    return { report, index, rowId: `${report.drive_file_id}:${occurrence}` };
  }).filter(({ report }) => (!filters.branch || normalizeBranch(report.branch) === normalizeBranch(filters.branch))
    && (!filters.month || report.report_month === filters.month)
    && (!query || [report.file_name, report.branch, report.report_month, formatReportMonth(report.report_month)].some(value => value.toLowerCase().includes(query))))
    .sort((a, b) => (filters.sort === "oldest" ? 1 : -1) * compare(a.report.report_month, b.report.report_month)
      || Date.parse(b.report.uploaded_at) - Date.parse(a.report.uploaded_at)
      || compare(a.report.drive_file_id, b.report.drive_file_id) || compare(a.report.file_name, b.report.file_name) || a.index - b.index);
}
