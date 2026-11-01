import assert from "node:assert/strict";
import { test, after } from "node:test";
import { createUploadHandler } from "../src/lib/server/upload-handler.ts";
import { submitReport } from "../src/lib/submit-report.ts";
import { uploadResult, parseUploadResult } from "../src/lib/upload-result.ts";

// All upstream calls must be injected mocks, even if real env vars are present.
const realFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error("Network is forbidden in this test suite"); };
after(() => { globalThis.fetch = realFetch; });
const origin = "http://localhost:3000";
const env = { N8N_UPLOAD_WEBHOOK_URL: "https://sandbox.invalid/webhook/monthly-sales-upload", APP_ORIGIN: origin };
const pdf = () => new File(["%PDF-1.7\nSynthetic test only\n%%EOF"], "synthetic.pdf", { type: "application/pdf" });
function form() {
  const data = new FormData();
  data.set("file", pdf()); data.set("branch", "Cairo"); data.set("report_month", "2026-09");
  return data;
}
function request(data = form(), headers = {}) {
  return new Request(`${origin}/api/reports/upload`, { method: "POST", body: data, headers: { Origin: origin, "X-NileMart-Upload": "1", ...headers } });
}
const json = (status, body) => Response.json(body, { status });
async function run(req, response = () => json(201, { success: true }), config = env) {
  const calls = [];
  const handler = createUploadHandler(config, async (url, init) => { calls.push({ url, init }); return response(url, init); });
  const result = await handler(req);
  return { status: result.status, body: await result.json(), calls, headers: result.headers };
}

test("valid multipart is forwarded exactly once and success requires confirmation", async () => {
  const { status, body, calls, headers } = await run(request());
  assert.equal(status, 201); assert.deepEqual(body, uploadResult("UPLOADED"));
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url.href, env.N8N_UPLOAD_WEBHOOK_URL);
  assert.equal(init.method, "POST"); assert.equal(init.redirect, "error");
  assert.equal(init.headers["Content-Type"], undefined);
  assert.deepEqual([...init.body.keys()], ["file", "branch", "report_month"]);
  assert.equal(init.body.get("branch"), "Cairo");
  assert.equal(init.body.get("report_month"), "2026-09");
  assert.equal(await init.body.get("file").text(), await pdf().text());
  assert.equal(headers.get("cache-control"), "no-store");
});

test("invalid inputs never reach upstream", async (t) => {
  const cases = [
    ["missing file", (f) => f.delete("file"), "INVALID_REQUEST"],
    ["text instead of file", (f) => f.set("file", "fake.pdf"), "INVALID_FILE"],
    ["wrong extension", (f) => f.set("file", new File(["%PDF-"], "file.txt", {type:"application/pdf"})), "INVALID_FILE"],
    ["wrong MIME", (f) => f.set("file", new File(["%PDF-"], "file.pdf", {type:"text/plain"})), "INVALID_FILE"],
    ["fake header", (f) => f.set("file", new File(["not PDF"], "file.pdf", {type:"application/pdf"})), "INVALID_FILE"],
    ["empty file", (f) => f.set("file", new File([], "file.pdf", {type:"application/pdf"})), "INVALID_FILE"],
    ["invalid branch", (f) => f.set("branch", "Other"), "INVALID_BRANCH"],
    ["missing branch", (f) => f.delete("branch"), "INVALID_REQUEST"],
    ["file-valued branch", (f) => f.set("branch", pdf()), "INVALID_BRANCH"],
    ["month out of range", (f) => f.set("report_month", "2026-13"), "INVALID_REPORT_MONTH"],
    ["month malformed", (f) => f.set("report_month", "2026-1"), "INVALID_REPORT_MONTH"],
    ["zero year", (f) => f.set("report_month", "0000-01"), "INVALID_REPORT_MONTH"],
    ["missing month", (f) => f.delete("report_month"), "INVALID_REQUEST"],
    ["unexpected URL field", (f) => f.set("webhook_url", "https://untrusted.invalid"), "INVALID_REQUEST"],
    ...["file", "branch", "report_month"].map(key => [`duplicate ${key}`, (f) => f.append(key, f.get(key)), "INVALID_REQUEST"]),
  ];
  for (const [name, edit, code] of cases) await t.test(name, async () => {
    const data = form(); edit(data);
    const result = await run(request(data));
    assert.equal(result.status, 400); assert.equal(result.body.code, code); assert.equal(result.calls.length, 0);
  });
});

test("origin, fetch metadata, and required header protections", async (t) => {
  for (const [name, headers] of [
    ["cross-origin", {Origin:"https://untrusted.invalid"}],
    ["missing origin", {Origin:""}], ["null origin", {Origin:"null"}],
    ["missing custom header", {"X-NileMart-Upload":""}],
    ["same-site is not same-origin", {"Sec-Fetch-Site":"same-site"}],
    ["cross-site metadata", {"Sec-Fetch-Site":"cross-site"}],
  ]) await t.test(name, async () => {
    const r = await run(request(form(), headers)); assert.equal(r.status, 403); assert.equal(r.calls.length, 0);
  });
  const req = new Request("http://untrusted.invalid/api/reports/upload", {method:"POST",body:form(),headers:{Origin:origin,"X-NileMart-Upload":"1","X-Forwarded-Host":"localhost:3000"}});
  assert.equal((await run(req)).status, 403);
});

test("reject malformed multipart and non-multipart requests", async () => {
  for (const [body, type] of [["broken", "multipart/form-data; boundary=missing"], ["{}", "application/json"]]) {
    const r = await run(request(body, {"Content-Type":type})); assert.equal(r.status, 400); assert.equal(r.calls.length, 0);
  }
});

test("file and streamed envelope size limits cannot be bypassed by Content-Length", async () => {
  let r = await run(request(), undefined, {...env,UPLOAD_MAX_BYTES:"5"});
  assert.equal(r.status, 413); assert.equal(r.calls.length, 0);
  r = await run(request(form(), {"Content-Length":"999999999"}));
  assert.equal(r.status, 413); assert.equal(r.calls.length, 0);
  const data = form(); data.set("extra", "x".repeat(70 * 1024));
  r = await run(request(data, {"Content-Length":"1"}), undefined, {...env,UPLOAD_MAX_BYTES:"5"});
  assert.equal(r.status, 413); assert.equal(r.calls.length, 0);
  const large = form(); large.set("file",new File(["%PDF-",new Uint8Array(10*1024*1024)],"large.pdf",{type:"application/pdf"}));
  r = await run(request(large)); assert.equal(r.status, 413); assert.equal(r.calls.length, 0);
});

test("invalid/missing configuration never invokes fetch or leaks values", async (t) => {
  const cases = [
    {}, {...env,N8N_UPLOAD_WEBHOOK_URL:""},
    ...["garbage", "http://remote.invalid/webhook/monthly-sales-upload", "https://user:secret@sandbox.invalid/webhook/monthly-sales-upload", "https://sandbox.invalid/webhook/other", "https://sandbox.invalid/webhook/monthly-sales-upload?token=secret", "https://sandbox.invalid/webhook/monthly-sales-upload#secret"].map(url=>({...env,N8N_UPLOAD_WEBHOOK_URL:url})),
    ...["-1","0","NaN","9999999999"].map(n=>({...env,UPLOAD_MAX_BYTES:n})),
    {...env,UPLOAD_TIMEOUT_MS:"0"}, {...env,APP_ORIGIN:"http://localhost:3000/path"},
  ];
  for (const [i, config] of cases.entries()) await t.test(`configuration case ${i+1}`, async () => {
    const r=await run(request(),undefined,config); assert.equal(r.status,503);assert.equal(r.body.code,"CONFIGURATION_UNAVAILABLE");assert.equal(r.calls.length,0);assert.equal(JSON.stringify(r.body).includes("secret"),false);
  });
});

test("loopback sandbox and test webhook configuration are supported", async () => {
  const r=await run(request(),undefined,{...env,N8N_UPLOAD_WEBHOOK_URL:"http://127.0.0.1:5678/webhook-test/monthly-sales-upload"});assert.equal(r.status,201);
});

test("Phase 2C dedicated sandbox path is accepted only in local development", async (t) => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) await t.test(host, async () => {
    const url = `http://${host}:5678/webhook-test/monthly-sales-e2e-sandbox-test`;
    const config = {...env, NODE_ENV: "development", N8N_UPLOAD_WEBHOOK_URL: url};
    const result = await run(request(), undefined, config);
    assert.equal(result.status, 201);
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0].url.href, url);
    assert.equal(result.calls[0].init.redirect, "error");
    assert.equal(JSON.stringify(result.body).includes(url), false);

    // Configuration acceptance does not bypass origin or file validation.
    const forbidden = await run(request(form(), {Origin:"https://untrusted.invalid"}), undefined, config);
    assert.equal(forbidden.status, 403); assert.equal(forbidden.calls.length, 0);
    const invalid = form(); invalid.set("file", "not a file");
    const rejected = await run(request(invalid), undefined, config);
    assert.equal(rejected.status, 400); assert.equal(rejected.calls.length, 0);
  });
});

test("Phase 2C exception cannot authorize production mode or arbitrary destinations", async (t) => {
  const path = "/webhook-test/monthly-sales-e2e-sandbox-test";
  const local = `http://localhost:5678${path}`;
  const cases = [
    ["production mode", {NODE_ENV:"production", N8N_UPLOAD_WEBHOOK_URL:local}],
    ["test mode", {NODE_ENV:"test", N8N_UPLOAD_WEBHOOK_URL:local}],
    ["missing mode", {N8N_UPLOAD_WEBHOOK_URL:local}],
    ...[
      `http://remote.invalid:5678${path}`, `https://remote.invalid:5678${path}`,
      `http://localhost.remote.invalid:5678${path}`, `http://192.168.1.1:5678${path}`,
      `http://localhost:9999${path}`, `http://localhost${path}`,
      "http://localhost:5678/webhook/monthly-sales-e2e-sandbox-test",
      "http://localhost:5678/webhook-test/arbitrary-workflow",
      `${local}/unexpected`, `${local}?token=secret`, `${local}#fragment`,
      `http://user:secret@localhost:5678${path}`,
    ].map((url, index) => [`destination case ${index + 1}`, {NODE_ENV:"development", N8N_UPLOAD_WEBHOOK_URL:url}]),
  ];
  for (const [name, override] of cases) await t.test(name, async () => {
    const result = await run(request(), undefined, {...env, ...override});
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "CONFIGURATION_UNAVAILABLE");
    assert.equal(result.calls.length, 0);
    assert.equal(JSON.stringify(result.body).includes("secret"), false);
  });
});

test("n8n response semantics are normalized without reflecting upstream details", async (t) => {
  const cases = [
    [201,{success:true},"UPLOADED",201],
    [400,{success:false,error_code:"INVALID_PDF"},"INVALID_INPUT",400],
    [400,[{success:false,error_code:"INVALID_BRANCH"}],"INVALID_INPUT",400],
    [409,{success:false,error_code:"DUPLICATE_REPORT"},"DUPLICATE_REPORT",409],
    [502,{success:false,partial_success:true,file_uploaded:true,logging_status:"unconfirmed",error_code:"SHEETS_LOGGING_FAILED",retry_safe:false,requires_manual_review:true},"SHEETS_LOGGING_FAILED",502],
    [502,{success:false,error_code:"DRIVE_UPLOAD_FAILED"},"STORAGE_FAILED",502],
    [503,{success:false,error_code:"DUPLICATE_CHECK_FAILED",upload_performed:false},"LOOKUP_UNAVAILABLE",503],
    [503,{success:false},"SERVICE_UNAVAILABLE",503],
    [201,{success:false},"UNCONFIRMED",502],
    [201,{success:true,partial_success:true},"UNCONFIRMED",502],
    [201,{success:true,requires_manual_review:true},"UNCONFIRMED",502],
    [201,{success:true,upload_performed:false},"UNCONFIRMED",502],
    [201,{success:true,file_uploaded:false},"UNCONFIRMED",502],
    [200,{success:true},"UNCONFIRMED",502],
    [500,{success:false},"UNCONFIRMED",502],
    [302,{success:true},"UNCONFIRMED",502],
    [201,{},"UNCONFIRMED",502],
  ];
  for (const [i,[status,payload,code,http]] of cases.entries()) await t.test(`response case ${i+1}`,async()=>{
    const r=await run(request(),()=>json(status,Array.isArray(payload)?payload:{...payload,message:"secret internal URL",stack:"secret"}));
    assert.equal(r.status,http);assert.equal(r.body.code,code);assert.equal(r.calls.length,1);assert.equal(JSON.stringify(r.body).includes("secret"),false);
    if(code==="SHEETS_LOGGING_FAILED"){assert.equal(r.body.requires_manual_review,true);assert.equal(r.body.retry_safe,false);assert.equal(r.body.success,false);}
  });
});

test("malformed, oversized and non-JSON upstream responses remain unconfirmed", async () => {
  for(const response of [
    ()=>new Response("broken",{status:201,headers:{"Content-Type":"application/json"}}),
    ()=>new Response("<html>secret</html>",{status:502}),
    ()=>json(201,{success:true,message:"x".repeat(33*1024)}),
  ]) {const r=await run(request(),response);assert.equal(r.body.code,"UNCONFIRMED");assert.equal(r.body.requires_manual_review,true);assert.equal(r.calls.length,1);}
});

test("timeouts, stalled response bodies and connection failures never retry", async () => {
  const r=await run(request(),()=>new Promise(()=>{}),{...env,UPLOAD_TIMEOUT_MS:"10"});
  assert.equal(r.status,504);assert.equal(r.body.code,"UPSTREAM_TIMEOUT");assert.equal(r.calls.length,1);assert.equal(r.calls[0].init.signal.aborted,true);
  const stalled=await run(request(),()=>new Response(new ReadableStream({}),{status:201,headers:{"Content-Type":"application/json"}}),{...env,UPLOAD_TIMEOUT_MS:"10"});
  assert.equal(stalled.status,504);assert.equal(stalled.body.requires_manual_review,true);
  const failed=await run(request(),()=>{throw new Error("secret upstream token");});
  assert.equal(failed.status,502);assert.equal(failed.body.requires_manual_review,true);assert.equal(failed.body.retry_safe,false);assert.equal(failed.calls.length,1);
});

test("client sends only to same-origin API and preserves the draft on failure", async () => {
  const report={file:pdf(),branch:"Giza",report_month:"2026-09"};let calls=0;
  const result=await submitReport(report,async(url,init)=>{
    calls++;assert.equal(url,"/api/reports/upload");assert.equal(init.headers["X-NileMart-Upload"],"1");assert.equal(init.credentials,"same-origin");
    assert.equal(init.body.get("file").name,report.file.name);
    return json(502,uploadResult("SHEETS_LOGGING_FAILED"));
  });
  assert.equal(calls,1);assert.equal(result.state,"partial_success");assert.equal(report.file.name,"synthetic.pdf");assert.equal(report.branch,"Giza");
  const failure=await submitReport(report,async()=>{throw new Error("lost connection");});
  assert.equal(failure.requires_manual_review,true);assert.equal(failure.success,false);
});

test("client does not trust malformed or contradictory success responses", async () => {
  assert.equal(parseUploadResult(201,{...uploadResult("UPLOADED"),success:false}).code,"UNCONFIRMED");
  assert.equal(parseUploadResult(500,uploadResult("UPLOADED")).code,"UNCONFIRMED");
  assert.equal(parseUploadResult(201,{code:"__proto__"}).code,"UNCONFIRMED");
  assert.equal(parseUploadResult(201,{...uploadResult("UPLOADED"),message:"secret"}).message.includes("secret"),false);
  const r=await submitReport({file:pdf(),branch:"Cairo",report_month:"2026-09"},async()=>new Response("not json"));
  assert.equal(r.code,"UNCONFIRMED");
});
