// Synthetic metadata only. No real Drive IDs or authentication details.
export function reportsFixture() {
  const periods = [
    ...["Cairo", "Alexandria", "Giza", "Mansoura"].flatMap(branch => ["2026-08", "2026-09", "2026-10"].map(month => [branch, month])),
    ["Giza", "2026-07"], [" cairo ", "2026-09"], ["CAIRO", "2026-09"], ["Cairo", "2026-09"],
  ];
  const reports = periods.map(([branch, month], index) => ({
    branch, report_month: month, file_name: `NileMart_${branch.trim()}_${month}_${index}.pdf`,
    uploaded_at: `2026-10-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
    drive_file_id: `synthetic_file_${index}`, file_link: `https://drive.google.com/file/d/synthetic_file_${index}/view`,
  }));
  return { success: true, total: reports.length, branches: ["Cairo", "Alexandria", "Giza", "Mansoura"], latest_report_month: "2026-10", reports, fetched_at: "2026-10-31T12:00:00Z" };
}
