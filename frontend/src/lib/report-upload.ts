export const BRANCHES = ["Cairo", "Alexandria", "Mansoura", "Giza"] as const;
export type Branch = (typeof BRANCHES)[number];

/** Matches the existing multipart upload contract. */
export type ReportInformation = {
  branch: Branch | "";
  report_month: string;
};

export type ReportUpload = ReportInformation & { file: File | null };

export function isBranch(value: string): value is Branch {
  return BRANCHES.some((branch) => branch === value);
}

export function isReportMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith("0000-");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  const units = ["KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length);
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(bytes / 1024 ** exponent)} ${units[exponent - 1]}`;
}

/** PDF header screening; full content validation still belongs to the workflow. */
export async function validatePdf(file: File): Promise<string | null> {
  if (!/\.pdf$/i.test(file.name) || (file.type !== "" && file.type !== "application/pdf")) {
    return "Choose a PDF file (.pdf). Other file types are not supported.";
  }
  if (file.size === 0) return "This file is empty. Choose a PDF with report content.";
  try {
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...header) !== "%PDF-") {
      return "This file does not have a valid PDF header. Choose an original PDF report.";
    }
  } catch {
    return "This file could not be read. Try selecting it again or choose another PDF.";
  }
  return null;
}
