import { Buffer } from "node:buffer";
import { parseReportsCatalog, REPORT_ERRORS, type ReportsError } from "../reports.ts";

type Environment = { N8N_REPORTS_WEBHOOK_URL?: string; N8N_REPORTS_USERNAME?: string; N8N_REPORTS_PASSWORD?: string };
type UpstreamFetch = (url: URL, init: RequestInit) => Promise<Response>;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const failure = (code: ReportsError, status: number) => Response.json({ success: false, code, message: REPORT_ERRORS[code] }, { status, headers });
class InvalidResponse extends Error {}

/** Only the route reads process.env; injected dependencies keep tests offline. */
export function createReportsHandler(env: Environment, upstreamFetch: UpstreamFetch, timeoutMs = 15_000) {
  return async function handle(): Promise<Response> {
    let url: URL;
    try {
      if (!env.N8N_REPORTS_WEBHOOK_URL || !env.N8N_REPORTS_USERNAME?.trim() || !env.N8N_REPORTS_PASSWORD
        || /[:\r\n]/.test(env.N8N_REPORTS_USERNAME)) throw new Error();
      url = new URL(env.N8N_REPORTS_WEBHOOK_URL);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) || url.username || url.password || url.search || url.hash
        || !/^\/webhook\/nilemart-reports-catalog-v1\/?$/.test(url.pathname)) throw new Error();
    } catch { return failure("NOT_CONFIGURED", 503); }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let timedOut = false;
    try {
      return await Promise.race([
        (async () => {
          const response = await upstreamFetch(url, {
            method: "GET", cache: "no-store", redirect: "error", signal: controller.signal,
            headers: { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${env.N8N_REPORTS_USERNAME}:${env.N8N_REPORTS_PASSWORD}`, "utf8").toString("base64")}` },
          });
          if (response.status === 401 || response.status === 403) {
            void response.body?.cancel().catch(() => {});
            return failure("UPSTREAM_AUTH", 502);
          }
          if (!response.ok) {
            void response.body?.cancel().catch(() => {});
            return failure("UNAVAILABLE", response.status === 503 ? 503 : 502);
          }
          if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "") || !response.body) {
            void response.body?.cancel().catch(() => {});
            throw new InvalidResponse();
          }
          reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 5 * 1024 * 1024) throw new InvalidResponse();
            chunks.push(value);
          }
          let catalog;
          try { catalog = parseReportsCatalog(JSON.parse(Buffer.concat(chunks, size).toString("utf8"))); }
          catch { throw new InvalidResponse(); }
          if (!catalog) throw new InvalidResponse();
          return Response.json(catalog, { headers });
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new Error()); }, timeoutMs);
        }),
      ]);
    } catch (error) {
      return failure(timedOut ? "TIMEOUT" : error instanceof InvalidResponse ? "INVALID_RESPONSE" : "UNAVAILABLE", timedOut ? 504 : 502);
    } finally {
      clearTimeout(timer);
      controller.abort();
      void reader?.cancel().catch(() => {});
    }
  };
}
