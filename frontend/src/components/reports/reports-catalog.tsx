"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { fetchReports } from "@/lib/fetch-reports";
import { EMPTY_REPORT_FILTERS, formatReportMonth, formatUploadedAt, reportSummary, selectReports, type ReportFilters, type ReportsCatalog as Catalog } from "@/lib/reports";
import { ReportsTable } from "./reports-table";

const button = "rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-emerald-700 hover:text-emerald-800 disabled:cursor-wait disabled:opacity-60";
const control = "mt-2 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-slate-800";

export function ReportsCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);
  const active = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    void fetchReports(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (result.success) setCatalog(result.catalog);
      else setError(result.message);
      setLoading(false);
    });
  }, []);

  const refresh = () => {
    setLoading(true);
    setError(null);
    void load();
  };

  useEffect(() => {
    void load();
    return () => active.current?.abort();
  }, [load]);

  const summary = reportSummary(catalog?.reports || []);
  const rows = selectReports(catalog?.reports || [], filters);
  const filtered = filters.search !== "" || filters.branch !== "" || filters.month !== "" || filters.sort !== "newest";

  return (
    <section aria-label="Reports catalog" aria-busy={loading}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Read-only report library <span aria-hidden="true">·</span> Every upload is kept</p>
        <button type="button" className={button} onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh reports"}</button>
      </div>
      {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="font-semibold text-red-900">Unable to load reports</h2>
        <p className="mt-2 text-sm text-red-800">{error}</p>
        {catalog && <p className="mt-2 text-sm text-red-800">Showing the last successful catalog. These records may be out of date.</p>}
        <button type="button" className={`${button} mt-4`} onClick={() => void refresh()} disabled={loading}>Retry</button>
      </div>}
      {loading && !catalog && <div role="status" className="rounded-xl border border-stone-200 bg-white p-6">
        <p className="text-sm text-slate-600">Loading reports…</p>
        <div aria-hidden="true" className="mt-5 space-y-4">{[0, 1, 2, 3].map(key => <div key={key} className="h-12 rounded-lg bg-stone-100 motion-safe:animate-pulse" />)}</div>
      </div>}
      {catalog && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total Files", summary.total, "All uploaded records"],
            ["Unique Reporting Periods", summary.uniquePeriods, "Unique branch and month combinations"],
            ["Branches", summary.branches.length, "Branches represented in the catalog"],
            ["Latest Report Month", formatReportMonth(summary.latestMonth), "Most recent reporting period"],
          ].map(([label, value, detail]) => <div key={label} className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-emerald-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
          </div>)}
        </div>
        <p className="mt-4 text-xs leading-6 text-slate-500">Extra upload records: <span className="font-semibold text-slate-700">{summary.extraUploads}</span>. Multiple uploads share a branch and reporting month; their PDF contents may differ.</p>
        {summary.total === 0 ? <div className="mt-6 rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <Icon name="reports" className="mx-auto size-8 text-emerald-800" /><h2 className="mt-4 text-lg font-semibold">No reports yet</h2><p className="mt-2 text-sm text-slate-600">The catalog has no uploaded reports. Refresh to check for new records.</p>
        </div> : <>
          <div className="mt-6 grid gap-4 rounded-xl border border-stone-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
            <label className="text-xs font-semibold text-slate-600">Search reports<input type="search" value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="Filename, branch, or month" className={control} /></label>
            <label className="text-xs font-semibold text-slate-600">Branch<select value={filters.branch} onChange={event => setFilters({ ...filters, branch: event.target.value })} className={control}><option value="">All Branches</option>{filters.branch && !summary.branches.includes(filters.branch) && <option value={filters.branch}>{filters.branch} (no current reports)</option>}{summary.branches.map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Report month<select value={filters.month} onChange={event => setFilters({ ...filters, month: event.target.value })} className={control}><option value="">All Months</option>{filters.month && !summary.months.includes(filters.month) && <option value={filters.month}>{formatReportMonth(filters.month)} (no current reports)</option>}{summary.months.map(month => <option key={month} value={month}>{formatReportMonth(month)}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Sort by<select value={filters.sort} onChange={event => setFilters({ ...filters, sort: event.target.value as ReportFilters["sort"] })} className={control}><option value="newest">Newest report month</option><option value="oldest">Oldest report month</option></select></label>
          </div>
          <div className="my-4 flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-slate-600">Showing {rows.length} of {summary.total} files{loading ? " · Refreshing…" : ""}</p>
            <button type="button" className={button} onClick={() => setFilters(EMPTY_REPORT_FILTERS)} disabled={!filtered}>Reset filters</button>
          </div>
          {rows.length ? <ReportsTable rows={rows} groups={summary.groups} /> : <div className="rounded-xl border border-stone-200 bg-white p-10 text-center"><h2 className="text-lg font-semibold">No matching reports</h2><p className="mt-2 text-sm text-slate-600">Try a different search or reset the filters to see all files.</p></div>}
        </>}
        <p className="mt-4 text-xs leading-6 text-slate-500">Catalog fetched: <time dateTime={catalog.fetched_at}>{formatUploadedAt(catalog.fetched_at)}</time>. All upload times use Cairo time. PDF links open in a new tab.</p>
      </>}
    </section>
  );
}
