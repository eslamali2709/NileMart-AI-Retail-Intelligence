export const UPLOAD_RESULTS = {
  UPLOADED: { http: 201, state: "success", message: "Report uploaded and metadata logged successfully. Document indexing runs separately.", review: false, retry: false },
  INVALID_REQUEST: { http: 400, state: "validation_error", message: "Provide exactly one PDF file, branch, and report month, with no extra fields.", review: false, retry: true },
  INVALID_FILE: { http: 400, state: "validation_error", message: "Choose a nonempty PDF with a .pdf filename and a valid PDF header.", review: false, retry: true },
  INVALID_BRANCH: { http: 400, state: "validation_error", message: "Select Cairo, Alexandria, Mansoura, or Giza.", review: false, retry: true },
  INVALID_REPORT_MONTH: { http: 400, state: "validation_error", message: "Select a valid reporting month in YYYY-MM format.", review: false, retry: true },
  TOO_LARGE: { http: 413, state: "validation_error", message: "The report or request exceeds the configured upload limit. Choose a smaller PDF.", review: false, retry: true },
  FORBIDDEN: { http: 403, state: "service_error", message: "This request was blocked. Open the application at its configured local address and try again.", review: false, retry: true },
  CONFIGURATION_UNAVAILABLE: { http: 503, state: "service_error", message: "Uploading is unavailable because the server is not configured. No report was sent. Contact the application operator.", review: false, retry: true },
  INVALID_INPUT: { http: 400, state: "validation_error", message: "The upload service rejected the report details. Review the PDF, branch, and month.", review: false, retry: true },
  DUPLICATE_REPORT: { http: 409, state: "duplicate", message: "A report already exists for this branch and month. Review the existing report before making another submission.", review: false, retry: false },
  SHEETS_LOGGING_FAILED: { http: 502, state: "partial_success", message: "The PDF may already be in Drive, but its metadata logging was not confirmed. Do not resubmit this report. Ask the operator to review Drive and Sheets first.", review: true, retry: false },
  STORAGE_FAILED: { http: 502, state: "service_error", message: "The storage service reported a failure. Ask the operator to check for an existing file before submitting again.", review: true, retry: false },
  LOOKUP_UNAVAILABLE: { http: 503, state: "service_error", message: "The service could not check for duplicate reports and stopped before uploading. Try again manually after the service is restored.", review: false, retry: true },
  SERVICE_UNAVAILABLE: { http: 503, state: "service_error", message: "The upload service is unavailable. The outcome is unconfirmed; ask the operator to check before resubmitting.", review: true, retry: false },
  UPSTREAM_TIMEOUT: { http: 504, state: "service_error", message: "Confirmation timed out. The report may have reached the workflow. Do not resubmit until the operator checks the outcome.", review: true, retry: false },
  UNCONFIRMED: { http: 502, state: "service_error", message: "The upload outcome could not be confirmed. Do not resubmit until the operator checks whether a file or metadata record was created.", review: true, retry: false },
} as const;

export type UploadCode = keyof typeof UPLOAD_RESULTS;
export type UploadResult = {
  success: boolean;
  code: UploadCode;
  state: (typeof UPLOAD_RESULTS)[UploadCode]["state"];
  message: string;
  requires_manual_review: boolean;
  retry_safe: boolean;
};

export function uploadResult(code: UploadCode): UploadResult {
  const result = UPLOAD_RESULTS[code];
  return { success: code === "UPLOADED", code, state: result.state, message: result.message, requires_manual_review: result.review, retry_safe: result.retry };
}

/** Never display arbitrary response text or accept a contradictory success. */
export function parseUploadResult(httpStatus: number, value: unknown): UploadResult {
  if (value && typeof value === "object" && "code" in value && typeof value.code === "string" && Object.hasOwn(UPLOAD_RESULTS, value.code)) {
    const code = value.code as UploadCode;
    const expected = uploadResult(code);
    const body = value as Record<string, unknown>;
    if (UPLOAD_RESULTS[code].http === httpStatus && body.success === expected.success && body.state === expected.state && body.requires_manual_review === expected.requires_manual_review && body.retry_safe === expected.retry_safe) return expected;
  }
  return uploadResult("UNCONFIRMED");
}
