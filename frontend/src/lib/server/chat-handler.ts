import { Buffer } from "node:buffer";
import { isSessionId, MAX_CHAT_MESSAGE_LENGTH, MAX_CHAT_REPLY_LENGTH, type ChatErrorCode } from "../chat.ts";

type Environment = {
  N8N_CHAT_WEBHOOK_URL?: string;
  N8N_CHAT_USERNAME?: string;
  N8N_CHAT_PASSWORD?: string;
  APP_ORIGIN?: string;
};
type UpstreamFetch = (url: URL, init: RequestInit) => Promise<Response>;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const failure = (error: ChatErrorCode, status: number) => Response.json({ error }, { status, headers });

async function readLimited(body: ReadableStream<Uint8Array> | null, limit: number, timeoutMs: number) {
  if (!body) throw new Error("Empty body");
  const reader = body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) return Buffer.concat(chunks, size).toString("utf8");
          size += value.byteLength;
          if (size > limit) throw new Error("Body too large");
          chunks.push(value);
        }
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Read timeout")), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

// Last-node Chat Trigger replies use output (Agent) or text (Chain).
// Accept a single serialized n8n item, but never stringify arbitrary upstream data.
export function normalizeChatReply(body: unknown): string | null {
  let data = Array.isArray(body) && body.length === 1 ? body[0] : body;
  if (data && typeof data === "object" && !Array.isArray(data) && "json" in data) data = data.json;
  if (!data || typeof data !== "object" || Array.isArray(data) || data.error || data.success === false) return null;
  const reply = typeof data.output === "string" ? data.output : data.text;
  return typeof reply === "string" && reply.trim() && reply.length <= MAX_CHAT_REPLY_LENGTH ? reply.trim() : null;
}

/** Local development only. Add user authentication and rate limiting before public deployment. */
export function createChatHandler(env: Environment, upstreamFetch: UpstreamFetch, timeoutMs = 90_000) {
  return async function handle(request: Request): Promise<Response> {
    let appOrigin: string;
    try { appOrigin = new URL(env.APP_ORIGIN || "http://localhost:3000").origin; }
    catch { return failure("NOT_CONFIGURED", 503); }
    if (request.headers.get("origin") !== appOrigin || request.headers.get("x-nilemart-chat") !== "1"
      || (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
      return failure("FORBIDDEN", 403);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "") || request.headers.has("content-encoding")) {
      return failure("INVALID_REQUEST", 400);
    }
    let input: unknown;
    try { input = JSON.parse(await readLimited(request.body, 32 * 1024, 10_000)); }
    catch { return failure("INVALID_REQUEST", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return failure("INVALID_REQUEST", 400);
    const { message, sessionId } = input as { message?: unknown; sessionId?: unknown };
    if (typeof message !== "string" || !message.trim() || message.length > MAX_CHAT_MESSAGE_LENGTH || !isSessionId(sessionId)) {
      return failure("INVALID_REQUEST", 400);
    }

    let url: URL;
    try {
      if (!env.N8N_CHAT_WEBHOOK_URL || !env.N8N_CHAT_USERNAME?.trim() || !env.N8N_CHAT_PASSWORD || env.N8N_CHAT_USERNAME.includes(":")) throw new Error();
      url = new URL(env.N8N_CHAT_WEBHOOK_URL);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) || url.username || url.password || url.hash || url.search) throw new Error();
    } catch { return failure("NOT_CONFIGURED", 503); }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      return await Promise.race([
        (async () => {
          const response = await upstreamFetch(url, {
            method: "POST", redirect: "error", cache: "no-store", signal: controller.signal,
            headers: {
              "Content-Type": "application/json", Accept: "application/json",
              Authorization: `Basic ${Buffer.from(`${env.N8N_CHAT_USERNAME}:${env.N8N_CHAT_PASSWORD}`, "utf8").toString("base64")}`,
            },
            body: JSON.stringify({ action: "sendMessage", sessionId, chatInput: message.trim() }),
          });
          if (!response.ok) {
            void response.body?.cancel().catch(() => {});
            return failure(response.status === 401 || response.status === 403 ? "AUTH_FAILED" : "UNAVAILABLE", 502);
          }
          if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) {
            void response.body?.cancel().catch(() => {});
            return failure("INVALID_RESPONSE", 502);
          }
          try {
            const reply = normalizeChatReply(JSON.parse(await readLimited(response.body, 128 * 1024, timeoutMs)));
            return reply ? Response.json({ reply, sessionId }, { headers }) : failure("INVALID_RESPONSE", 502);
          } catch { return failure(timedOut ? "TIMEOUT" : "INVALID_RESPONSE", timedOut ? 504 : 502); }
        })(),
        new Promise<Response>((resolve) => {
          timer = setTimeout(() => { timedOut = true; controller.abort(); resolve(failure("TIMEOUT", 504)); }, timeoutMs);
        }),
      ]);
    } catch { return failure(timedOut ? "TIMEOUT" : "UNAVAILABLE", timedOut ? 504 : 503); }
    finally { clearTimeout(timer); controller.abort(); }
  };
}
