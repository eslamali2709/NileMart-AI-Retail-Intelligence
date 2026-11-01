import { formatReportMonth, formatUploadedAt, reportingKey, safeDriveLink, type selectReports } from "../../lib/reports.ts";

export function ReportsTable({ rows, groups }: { rows: ReturnType<typeof selectReports>; groups: Map<string, number> }) {
  return (
    <div role="region" aria-label="Sales reports table" tabIndex={0} className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full min-w-[850px] table-fixed text-left text-sm">
        <caption className="sr-only">Uploaded sales and inventory reports. Upload times are shown in Cairo time. PDF links open in a new tab.</caption>
        <thead className="border-b border-stone-200 bg-stone-50 text-xs text-slate-600">
          <tr>{[["Report Name", "w-[30%]"], ["Branch", "w-[12%]"], ["Report Month", "w-[15%]"], ["Uploaded At", "w-[17%]"], ["Status", "w-[16%]"], ["Actions", "w-[10%]"]].map(([label, width]) => <th key={label} scope="col" className={`px-4 py-4 font-semibold ${width}`}>{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map(({ report, rowId }) => {
            const multiple = (groups.get(reportingKey(report)) || 0) > 1;
            const link = safeDriveLink(report.file_link, report.drive_file_id);
            return (
              <tr key={rowId} className="align-top hover:bg-stone-50/60">
                <th scope="row" className="px-4 py-5 font-medium text-slate-900 [overflow-wrap:anywhere]">{report.file_name}</th>
                <td className="px-4 py-5 text-slate-600 [overflow-wrap:anywhere]">{report.branch}</td>
                <td className="px-4 py-5 text-slate-600"><time dateTime={report.report_month}>{formatReportMonth(report.report_month)}</time></td>
                <td className="px-4 py-5 text-slate-600"><time dateTime={report.uploaded_at}>{formatUploadedAt(report.uploaded_at)}</time></td>
                <td className="px-4 py-5"><span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${multiple ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}>{multiple ? "Multiple Uploads" : "Single Upload"}</span></td>
                <td className="px-4 py-5">{link ? <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`View PDF: ${report.file_name} (opens in a new tab)`} className="font-semibold text-emerald-800 underline decoration-emerald-200 underline-offset-4 hover:decoration-emerald-800">View PDF</a> : <span className="text-xs text-slate-500" title="The catalog did not provide a valid Google Drive link for this file.">Link unavailable</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
