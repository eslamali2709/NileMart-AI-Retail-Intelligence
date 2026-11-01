import { Buffer } from "node:buffer";
import { isBranch, isReportMonth, validatePdf } from "../report-upload.ts";
import { UPLOAD_RESULTS, uploadResult, type UploadCode } from "../upload-result.ts";

type Environment = {
  NODE_ENV?: string;
  N8N_UPLOAD_WEBHOOK_URL?: string;
  UPLOAD_MAX_BYTES?: string;
  UPLOAD_TIMEOUT_MS?: string;
  APP_ORIGIN?: string;
};

type Configuration = { url: URL; origin: string; maxBytes: number; timeoutMs: number };
type UpstreamFetch = (url: URL, init: RequestInit) => Promise<Response>;
const MULTIPART_ALLOWANCE = 64 * 1024;

class BodyTooLarge extends Error {}
class ReadTimeout extends Error {}

function integer(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new Error("Invalid configuration");
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > max) throw new Error("Invalid configuration");
  return number;
}

function configuration(env: Environment): Configuration {
  if (!env.N8N_UPLOAD_WEBHOOK_URL) throw new Error("Missing configuration");
  const url = new URL(env.N8N_UPLOAD_WEBHOOK_URL);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const standardPath = /^\/(webhook|webhook-test)\/monthly-sales-upload\/?$/.test(url.pathname);
  // Permit only the dedicated local sandbox test endpoint, never a generic path override.
  const localSandbox = env.NODE_ENV === "development"
    && url.protocol === "http:" && loopback && url.port === "5678"
    && url.pathname === "/webhook-test/monthly-sales-e2e-sandbox-test";
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) || url.username || url.password || url.search || url.hash || !(standardPath || localSandbox)) throw new Error("Invalid configuration");
  const origin = new URL(env.APP_ORIGIN || "http://localhost:3000");
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Invalid configuration");
  return {
    url, origin: origin.origin,
    maxBytes: integer(env.UPLOAD_MAX_BYTES, 10 * 1024 * 1024, 100 * 1024 * 1024),
    timeoutMs: integer(env.UPLOAD_TIMEOUT_MS, 30_000, 120_000),
  };
}

function reply(code: UploadCode): Response {
  return Response.json(uploadResult(code), {
    status: UPLOAD_RESULTS[code].http,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** Bound actual streamed bytes, not just the untrusted Content-Length header. */
async function readLimited(body: ReadableStream<Uint8Array> | null, limit: number, timeoutMs: number): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = async () => {
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      size += value.byteLength;
      if (size > limit) throw new BodyTooLarge();
      chunks.push(value);
    }
  };
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ReadTimeout()), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

function sameOrigin(request: Request, origin: string): boolean {
  return request.headers.get("origin") === origin
    && new URL(request.url).origin === origin
    && request.headers.get("x-nilemart-upload") === "1"
    && (!request.headers.has("sec-fetch-site") || request.headers.get("sec-fetch-site") === "same-origin");
}

function upstreamCode(status: number, body: unknown): UploadCode {
  // Some n8n response nodes serialize the single item as an array.
  const data = Array.isArray(body) && body.length === 1 ? body[0] : body;
  if (!data || typeof data !== "object" || Array.isArray(data)) return "UNCONFIRMED";
  if (data.partial_success === true || data.file_uploaded === true || data.requires_manual_review === true || data.error_code === "SHEETS_LOGGING_FAILED") {
    return status === 502 && data.error_code === "SHEETS_LOGGING_FAILED" ? "SHEETS_LOGGING_FAILED" : "UNCONFIRMED";
  }
  if (status === 201 && data.success === true && !data.error_code && data.retry_safe !== false && data.logging_status !== "unconfirmed" && data.file_uploaded !== false && data.upload_performed !== false) return "UPLOADED";
  if (data.success !== false) return "UNCONFIRMED";
  if (status === 400) return "INVALID_INPUT";
  if (status === 409) return "DUPLICATE_REPORT";
  if (status === 502 && data.error_code === "DRIVE_UPLOAD_FAILED") return "STORAGE_FAILED";
  if (status === 503) return data.error_code === "DUPLICATE_CHECK_FAILED" && data.upload_performed === false ? "LOOKUP_UNAVAILABLE" : "SERVICE_UNAVAILABLE";
  return "UNCONFIRMED";
}

/** Dependencies are explicit so tests never need an external service or real env. */
export function createUploadHandler(env: Environment, upstreamFetch: UpstreamFetch) {
  return async function handle(request: Request): Promise<Response> {
    let config: Configuration;
    try { config = configuration(env); } catch { return reply("CONFIGURATION_UNAVAILABLE"); }
    if (!sameOrigin(request, config.origin)) return reply("FORBIDDEN");
    const contentType = request.headers.get("content-type") || "";
    if (!/^multipart\/form-data\s*;/i.test(contentType) || request.headers.has("content-encoding")) return reply("INVALID_REQUEST");
    const maxBody = config.maxBytes + MULTIPART_ALLOWANCE;
    const length = request.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBody)) return reply("TOO_LARGE");

    let form: FormData;
    try {
      const bytes = await readLimited(request.body, maxBody, 15_000);
      form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": contentType } }).formData();
    } catch (error) { return reply(error instanceof BodyTooLarge ? "TOO_LARGE" : "INVALID_REQUEST"); }

    const allowed = ["file", "branch", "report_month"];
    if ([...form.keys()].some((key) => !allowed.includes(key)) || allowed.some((key) => form.getAll(key).length !== 1)) return reply("INVALID_REQUEST");
    const file = form.get("file");
    const branch = form.get("branch");
    const month = form.get("report_month");
    if (!(file instanceof File)) return reply("INVALID_FILE");
    if (typeof branch !== "string" || !isBranch(branch)) return reply("INVALID_BRANCH");
    if (typeof month !== "string" || !isReportMonth(month)) return reply("INVALID_REPORT_MONTH");
    if (file.size > config.maxBytes) return reply("TOO_LARGE");
    if (file.type !== "application/pdf" || await validatePdf(file)) return reply("INVALID_FILE");

    const upstream = new FormData();
    upstream.set("file", file, file.name);
    upstream.set("branch", branch);
    upstream.set("report_month", month);
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const operation = async () => {
        const response = await upstreamFetch(config.url, { method: "POST", body: upstream, signal: controller.signal, redirect: "error", cache: "no-store", headers: { Accept: "application/json" } });
        if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) {
          void response.body?.cancel().catch(() => {});
          return "UNCONFIRMED" as const;
        }
        const bytes = await readLimited(response.body, 32 * 1024, config.timeoutMs);
        return upstreamCode(response.status, JSON.parse(bytes.toString("utf8")));
      };
      const code = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new ReadTimeout()); }, config.timeoutMs);
        }),
      ]);
      return reply(code);
    } catch (error) {
      return reply(timedOut || error instanceof ReadTimeout ? "UPSTREAM_TIMEOUT" : "UNCONFIRMED");
    } finally { clearTimeout(timer); controller.abort(); }
  };
}
