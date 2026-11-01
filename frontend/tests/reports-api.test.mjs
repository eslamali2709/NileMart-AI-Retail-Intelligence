import assert from "node:assert/strict";
import { test, after } from "node:test";
import { Buffer } from "node:buffer";
import { createReportsHandler } from "../src/lib/server/reports-handler.ts";
import { fetchReports } from "../src/lib/fetch-reports.ts";
import { reportsFixture } from "./fixtures/reports.mjs";

const realFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error("Network forbidden in automated tests"); };
after(() => { globalThis.fetch = realFetch; });
const env = { N8N_REPORTS_WEBHOOK_URL: "https://catalog.invalid/webhook/nilemart-reports-catalog-v1", N8N_REPORTS_USERNAME: "mock-user", N8N_REPORTS_PASSWORD: "mock-secret" };
async function run(upstream = () => Response.json(reportsFixture()), config = env, timeout = 1000) {
  const calls = [];
  const response = await createReportsHandler(config, async (url, init) => { calls.push({ url, init }); return upstream(); }, timeout)();
  const body = await response.json();
  const serialized = JSON.stringify({ body, headers: [...response.headers] });
  for (const secret of [env.N8N_REPORTS_USERNAME, env.N8N_REPORTS_PASSWORD, Buffer.from(`${env.N8N_REPORTS_USERNAME}:${env.N8N_REPORTS_PASSWORD}`).toString("base64"), "secret-stack"]) assert.equal(serialized.includes(secret), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return { response, body, calls };
}

test("authenticated GET uses Basic auth only upstream and returns all normalized records", async () => {
  const fixture = { ...reportsFixture(), authorization: "secret-stack", stack: "secret-stack" };
  fixture.reports[0].internal = "secret-stack";
  const { response, body, calls } = await run(() => Response.json(fixture));
  assert.equal(response.status, 200);
  assert.equal(body.reports.length, 16);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.href, env.N8N_REPORTS_WEBHOOK_URL);
  assert.equal(calls[0].init.headers.Authorization, `Basic ${Buffer.from("mock-user:mock-secret").toString("base64")}`);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(body.authorization, undefined);
  assert.equal(body.reports[0].internal, undefined);
});

test("missing or unsafe configuration never calls upstream", async () => {
  const cases = [
    {}, ...Object.keys(env).map(key => ({ ...env, [key]: "" })), { ...env, N8N_REPORTS_USERNAME: "bad:user" },
    ...["garbage", "http://remote.invalid/webhook/nilemart-reports-catalog-v1", "https://user:secret@catalog.invalid/webhook/nilemart-reports-catalog-v1", `${env.N8N_REPORTS_WEBHOOK_URL}?secret=1`, `${env.N8N_REPORTS_WEBHOOK_URL}#secret`, "http://localhost:5678/webhook-test/nilemart-reports-catalog-v1", "https://catalog.invalid/webhook/other"].map(url => ({ ...env, N8N_REPORTS_WEBHOOK_URL: url })),
  ];
  for (const config of cases) {
    const r = await run(undefined, config);
    assert.equal(r.response.status, 503); assert.equal(r.body.code, "NOT_CONFIGURED"); assert.equal(r.calls.length, 0);
  }
  assert.equal((await run(undefined, { ...env, N8N_REPORTS_WEBHOOK_URL: "http://localhost:5678/webhook/nilemart-reports-catalog-v1" })).response.status, 200);
});

test("upstream HTTP errors are sanitized, including 401 and 503", async () => {
  for (const [status, expectedStatus, code] of [[401, 502, "UPSTREAM_AUTH"], [403, 502, "UPSTREAM_AUTH"], [503, 503, "UNAVAILABLE"], [500, 502, "UNAVAILABLE"], [302, 502, "UNAVAILABLE"]]) {
    const r = await run(() => new Response("mock-secret secret-stack", { status }));
    assert.equal(r.response.status, expectedStatus); assert.equal(r.body.code, code); assert.equal(r.calls.length, 1);
  }
});

test("connection failures, timeouts and stalled bodies terminate safely", async () => {
  const failed = await run(() => { throw new Error("mock-secret secret-stack"); });
  assert.equal(failed.response.status, 502); assert.equal(failed.body.code, "UNAVAILABLE");
  for (const upstream of [() => new Promise(() => {}), () => new Response(new ReadableStream({}), { headers: { "Content-Type": "application/json" } })]) {
    const r = await run(upstream, env, 10);
    assert.equal(r.response.status, 504); assert.equal(r.body.code, "TIMEOUT"); assert.equal(r.calls[0].init.signal.aborted, true);
  }
});

test("invalid JSON, shape, metadata and oversized payloads are rejected", async () => {
  const invalids = [null, [], {}, { ...reportsFixture(), success: false }, { ...reportsFixture(), total: 20 }, { ...reportsFixture(), branches: [4] }, { ...reportsFixture(), fetched_at: "invalid" }, { ...reportsFixture(), latest_report_month: "2026-13" }];
  for (const [field, value] of [["branch", ""], ["file_name", null], ["report_month", "2026-13"], ["report_month", "0000-01"], ["uploaded_at", "yesterday"], ["drive_file_id", ""]]) {
    const fixture = reportsFixture(); fixture.reports[0][field] = value; invalids.push(fixture);
  }
  for (const upstream of [
    ...invalids.map(body => () => Response.json(body)),
    () => new Response("broken", { headers: { "Content-Type": "application/json" } }),
    () => new Response("<html>mock-secret</html>"),
    () => Response.json({ ...reportsFixture(), extra: "x".repeat(5 * 1024 * 1024) }),
  ]) {
    const r = await run(upstream); assert.equal(r.response.status, 502); assert.equal(r.body.code, "INVALID_RESPONSE");
  }
});

test("empty catalog is successful and invalid links retain their rows", async () => {
  const empty = await run(() => Response.json({ ...reportsFixture(), total: 0, reports: [], branches: [], latest_report_month: null }));
  assert.equal(empty.response.status, 200); assert.deepEqual(empty.body.reports, []);
  const fixture = reportsFixture(); fixture.reports[0].file_link = "javascript:alert(1)";
  const r = await run(() => Response.json(fixture));
  assert.equal(r.body.reports.length, 16); assert.equal(r.body.reports[0].file_link, null);
});

test("client uses same-origin GET, validates success and never reflects upstream error strings", async () => {
  const signal = new AbortController().signal;
  const success = await fetchReports(signal, async (url, init) => {
    assert.equal(url, "/api/reports"); assert.equal(init.method, "GET"); assert.equal(init.credentials, "same-origin"); assert.equal(init.cache, "no-store"); assert.equal(init.signal, signal);
    assert.equal(init.headers, undefined);
    return Response.json(reportsFixture());
  });
  assert.equal(success.success, true); assert.equal(success.catalog.total, 16);
  for (const mock of [() => Response.json({ code: "UPSTREAM_AUTH", message: "mock-secret" }, { status: 502 }), () => Response.json({ code: "__proto__", message: "mock-secret" }, { status: 500 }), () => Response.json({}), () => new Response("mock-secret"), () => { throw new Error("mock-secret"); }]) {
    const result = await fetchReports(signal, async () => mock());
    assert.equal(result.success, false); assert.equal(result.message.includes("mock-secret"), false);
  }
});
