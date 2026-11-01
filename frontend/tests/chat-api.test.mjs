import assert from "node:assert/strict";
import { test, after } from "node:test";
import { createChatHandler, normalizeChatReply } from "../src/lib/server/chat-handler.ts";
import { CHAT_ERRORS, restoreConversation } from "../src/lib/chat.ts";
import { submitChat } from "../src/lib/submit-chat.ts";

const realFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error("Real network is forbidden in unit tests"); };
after(() => { globalThis.fetch = realFetch; });
const origin = "http://localhost:3000";
const sessionId = "11111111-1111-4111-8111-111111111111";
const env = { N8N_CHAT_WEBHOOK_URL: "http://localhost:5678/webhook/synthetic/chat", N8N_CHAT_USERNAME: "synthetic-user", N8N_CHAT_PASSWORD: "synthetic-password" };
const input = { message: "What were Cairo's net sales in October 2026?", sessionId };
// Expected user-provided fixture only; this is not evidence of a live RAG answer.
const answer = "Cairo's October 2026 net sales were **EGP 894,275**.\nSource: NileMart_CAI_2026-10_Sales_Inventory.pdf";
const request = (body = input, headers = {}) => new Request(`${origin}/api/chat`, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-NileMart-Chat": "1", ...headers }, body: JSON.stringify(body),
});
async function run(req = request(), upstream = () => Response.json({ output: answer }), config = env, timeout = 1000) {
  const calls = [];
  const response = await createChatHandler(config, async (url, init) => { calls.push({ url, init }); return upstream(url, init); }, timeout)(req);
  return { response, body: await response.json(), calls };
}

test("forwards exact Chat Trigger payload and Basic Auth; returns only normalized answer", async () => {
  const { response, body, calls } = await run(request({ ...input, message: `  ${input.message}  ` }));
  assert.equal(response.status, 200);
  assert.deepEqual(body, { reply: answer, sessionId });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.href, env.N8N_CHAT_WEBHOOK_URL);
  const init = calls[0].init;
  assert.deepEqual(JSON.parse(init.body), { action: "sendMessage", sessionId, chatInput: input.message });
  assert.equal(init.headers.Authorization, `Basic ${Buffer.from("synthetic-user:synthetic-password").toString("base64")}`);
  assert.equal(init.redirect, "error");
  assert.equal(init.cache, "no-store");
  assert.ok(init.signal instanceof AbortSignal);
  assert.ok(!JSON.stringify(body).includes("synthetic-password"));
});

test("normalizes documented Agent/Chain and single n8n item shapes", () => {
  for (const body of [{ output: answer }, { text: answer }, [{ output: answer }], [{ json: { output: answer } }]]) assert.equal(normalizeChatReply(body), answer);
  for (const body of [null, [], [{ output: answer }, { output: answer }], { output: {} }, { output: " " }, { output: "x".repeat(64001) }, { error: "private details", output: answer }, { success: false, output: answer }, { message: "Workflow started" }]) assert.equal(normalizeChatReply(body), null);
});

test("invalid messages, sessions, and malformed bodies never call n8n", async () => {
  for (const body of [{ sessionId }, { ...input, message: " " }, { ...input, message: 7 }, { ...input, message: "x".repeat(4001) }, { message: "hello" }, { ...input, sessionId: "short" }, { ...input, sessionId: {} }, [], null]) {
    const result = await run(request(body));
    assert.equal(result.response.status, 400);
    assert.equal(result.calls.length, 0);
  }
  const malformed = request();
  const result = await run(new Request(malformed.url, { method: "POST", headers: malformed.headers, body: "{broken" }));
  assert.equal(result.response.status, 400);
  assert.equal(result.calls.length, 0);
  assert.equal((await run(request({ ...input, extra: "x".repeat(33000) }))).response.status, 400);
});

test("origin, custom header, JSON content type, and fetch metadata are enforced", async () => {
  for (const headers of [{ Origin: "https://untrusted.invalid" }, { "X-NileMart-Chat": "0" }, { "Sec-Fetch-Site": "cross-site" }]) {
    const result = await run(request(input, headers));
    assert.equal(result.response.status, 403);
    assert.equal(result.calls.length, 0);
  }
  assert.equal((await run(request(input, { "Content-Type": "text/plain" }))).response.status, 400);
});

test("missing settings and unsafe URLs fail closed without leaking configuration", async () => {
  for (const config of [{}, { ...env, N8N_CHAT_PASSWORD: "" }, { ...env, N8N_CHAT_USERNAME: "invalid:user" }, { ...env, N8N_CHAT_WEBHOOK_URL: "http://remote.invalid/chat" }, { ...env, N8N_CHAT_WEBHOOK_URL: "https://user:secret@remote.invalid/chat" }]) {
    const result = await run(request(), undefined, config);
    assert.equal(result.response.status, 503);
    assert.deepEqual(result.body, { error: "NOT_CONFIGURED" });
    assert.equal(result.calls.length, 0);
  }
});

test("upstream authentication, unavailable service, invalid response, and timeout are safe", async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    const result = await run(request(), () => new Response("private upstream diagnostic", { status }));
    assert.equal(result.response.status, 502);
    assert.deepEqual(result.body, { error: status === 401 || status === 403 ? "AUTH_FAILED" : "UNAVAILABLE" });
  }
  const offline = await run(request(), () => { throw new Error("private URL and credentials"); });
  assert.equal(offline.response.status, 503);
  assert.deepEqual(offline.body, { error: "UNAVAILABLE" });
  for (const upstream of [() => new Response("<html>private error</html>"), () => new Response("broken", { headers: { "Content-Type": "application/json" } }), () => Response.json({ output: {} }), () => Response.json({ output: "x".repeat(140000) })]) {
    assert.deepEqual((await run(request(), upstream)).body, { error: "INVALID_RESPONSE" });
  }
  const timeout = await run(request(), () => new Promise(() => {}), env, 10);
  assert.equal(timeout.response.status, 504);
  assert.equal(timeout.calls[0].init.signal.aborted, true);
  const stalledBody = await run(request(), () => new Response(new ReadableStream({ start() {} }), { headers: { "Content-Type": "application/json" } }), env, 10);
  assert.equal(stalledBody.response.status, 504);
});

test("client uses only /api/chat and preserves amount, filename, and session", async () => {
  const controller = new AbortController();
  const reply = await submitChat(input.message, sessionId, controller.signal, async (url, init) => {
    assert.equal(url, "/api/chat");
    assert.equal(init.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(init.body), input);
    return Response.json({ reply: answer, sessionId });
  });
  assert.match(reply.reply, /EGP 894,275/);
  assert.match(reply.reply, /NileMart_CAI_2026-10_Sales_Inventory\.pdf/);
  await assert.rejects(submitChat(input.message, sessionId, controller.signal, async () => Response.json({ reply: answer, sessionId: "wrong-session" })), { message: CHAT_ERRORS.INVALID_RESPONSE });
  await assert.rejects(submitChat(input.message, sessionId, controller.signal, async () => Response.json({ error: "private diagnostic" }, { status: 502 })), { message: CHAT_ERRORS.UNAVAILABLE });
  await assert.rejects(submitChat(input.message, sessionId, controller.signal, async () => Response.json({ error: "AUTH_FAILED" }, { status: 502 })), { message: CHAT_ERRORS.AUTH_FAILED });
});

test("tab history restores stable session and rejects corrupted storage", () => {
  const saved = { sessionId, messages: [{ id: "1", role: "assistant", text: answer }] };
  assert.deepEqual(restoreConversation(JSON.stringify(saved)), saved);
  for (const raw of [null, "invalid JSON", "{}", JSON.stringify({ ...saved, sessionId: "bad" }), JSON.stringify({ ...saved, messages: [null] })]) assert.equal(restoreConversation(raw), null);
});
