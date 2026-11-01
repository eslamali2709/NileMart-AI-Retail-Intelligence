# Report upload API

The implemented upload page calls the server-only `POST /api/reports/upload` route, which validates and forwards to Workflow 01. The public [ingestion export](../workflows/01_Monthly_Sales_Ingestion.json) preserves the existing validation, Drive storage, Sheets logging, duplicate rejection, and partial-failure paths. Configure your own local resources using [backend setup](BACKEND_SETUP.md).

The original Phase 2B implementation was mock-tested without executing a workflow. Those historical results remain in [VALIDATION.md](VALIDATION.md). Portfolio preparation does not perform new live uploads or change the application.

## Local setup

Use Node.js 24 and npm. From the repository root:

```powershell
cd frontend
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd run dev -- --hostname 127.0.0.1
```

Preserve an existing `.env.local`. Configure `N8N_UPLOAD_WEBHOOK_URL` with the Production URL of your own reviewed, isolated Workflow 01 copy. Until configured, submission returns `503 CONFIGURATION_UNAVAILABLE` without forwarding. Browse to `http://localhost:3000/upload-report` to match the default origin. The development command above binds the server to loopback.

| Server-only setting | Default / rule |
| --- | --- |
| `N8N_UPLOAD_WEBHOOK_URL` | Empty in the template. Requires HTTPS, except HTTP on exact loopback hosts `localhost`, `127.0.0.1`, or `[::1]`. Standard paths: `/webhook/monthly-sales-upload` or `/webhook-test/monthly-sales-upload`, optionally with a trailing slash. Development-only exception: HTTP loopback port 5678 with the exact path `/webhook-test/monthly-sales-e2e-sandbox-test`. Credentials, query strings, and fragments are rejected for all paths. |
| `APP_ORIGIN` | `http://localhost:3000`. Exact trusted browser origin. Change it when using a different hostname, port, or scheme; do not mix localhost and 127.0.0.1. |
| `UPLOAD_MAX_BYTES` | `10485760`: 10 MiB, commonly called 10 MB. Positive integer, at most 100 MiB. |
| `UPLOAD_TIMEOUT_MS` | `30000`: upstream confirmation deadline including response reading. Positive integer, at most 120000 ms. |

Restart the server after changing settings. None of these variables uses `NEXT_PUBLIC_`. Keep private webhook identifiers and service credentials out of browser code, screenshots, documentation, and committed environments. Generic local path examples in the setup guide are not private endpoint values. The browser does not choose the upstream URL. Syntax checks do not verify resource isolation: use only your own demonstration workflow and synthetic data for testing.

### Historical Phase 2C sandbox configuration

The local sandbox's `monthly-sales-e2e-sandbox-test` path differs from the selected production export's `monthly-sales-upload` path. Previously the hardcoded standard-path allowlist rejected it before any upstream request, producing the same generic 503 used for missing configuration. Environment loading and loopback HTTP were not the cause.

That exact sandbox test path is now accepted only on HTTP loopback port 5678 when Next.js runs in development mode. Use `npm.cmd run dev -- --hostname 127.0.0.1` and browse at `http://localhost:3000` to match `APP_ORIGIN`. Let Next.js set `NODE_ENV`; do not put a manual override in `.env.local`. `npm.cmd start` runs production mode and intentionally rejects this exception, even though `npm.cmd run build` succeeds.

This exception remains in the source for compatibility with the earlier isolated sandbox. It is not required for the public Workflow 01 production path. If deliberately using that old test path, start the sandbox listener before submitting and verify all resources are disposable. An expired listener is not evidence of a failed file write; inspect uncertain outcomes before retrying. The configuration fix alone did not establish n8n reachability.

## Request contract

`POST /api/reports/upload`, Node.js runtime, `multipart/form-data`:

| Field | Value |
| --- | --- |
| `file` | Exactly one nonempty PDF file, MIME `application/pdf`, `.pdf` filename, starting with `%PDF-`, within the configured file limit. |
| `branch` | Exactly one string: `Cairo`, `Alexandria`, `Mansoura`, or `Giza`. |
| `report_month` | Exactly one string: four-digit nonzero year and valid month, `YYYY-MM`. |

No unexpected or duplicate fields are accepted. The UI normalizes missing browser MIME metadata to `application/pdf` only after its local PDF checks. The server independently validates the file.

The request must include `Origin` equal to `APP_ORIGIN` and `X-NileMart-Upload: 1`. The request URL origin must also match. If `Sec-Fetch-Site` is supplied, only `same-origin` is allowed. The route does not trust forwarded origin headers or send permissive CORS headers. A browser sets Origin automatically; JavaScript sets the custom header. Non-browser tools must explicitly send both for a later authorized sandbox test.

Use `FormData` without manually setting `Content-Type`; the runtime supplies the multipart boundary. Only the three validated fields are forwarded. Client cookies, authorization headers, and arbitrary client headers are not forwarded. Redirect following and automatic retries are disabled.

## Response contract

Every handled response is JSON with `Cache-Control: no-store` and the same shape:

```json
{
  "success": false,
  "code": "SHEETS_LOGGING_FAILED",
  "state": "partial_success",
  "message": "A fixed, human-readable explanation with review instructions.",
  "requires_manual_review": true,
  "retry_safe": false
}
```

`message` is selected locally from a fixed catalog; raw upstream messages, errors, headers, URLs, IDs, and stack traces are never returned. The browser also validates the response code, HTTP status, state, and flags before rendering a known local message.

| HTTP | Codes / meaning |
| --- | --- |
| 201 | `UPLOADED`: n8n returned 201 with `success: true` and no contradictory failure flags. Confirms upload and metadata logging, not indexing. |
| 400 | `INVALID_REQUEST`, `INVALID_FILE`, `INVALID_BRANCH`, `INVALID_REPORT_MONTH`: local rejection before forwarding. `INVALID_INPUT`: n8n explicitly rejected the input. |
| 403 | `FORBIDDEN`: origin/custom-header/fetch-metadata check failed. |
| 409 | `DUPLICATE_REPORT`: n8n explicitly rejected the duplicate branch/month report. |
| 413 | `TOO_LARGE`: file or total request exceeds the configured limit. |
| 502 | `SHEETS_LOGGING_FAILED`: the PDF may already be in Drive; logging is unconfirmed. `STORAGE_FAILED`: storage failure requiring review before retry. `UNCONFIRMED`: network failure, malformed or oversized response, redirect, contradictory response, or unexpected upstream status. |
| 503 | `CONFIGURATION_UNAVAILABLE`: no request sent because server settings are missing/invalid. `LOOKUP_UNAVAILABLE`: duplicate lookup explicitly stopped before upload. `SERVICE_UNAVAILABLE`: other unconfirmed upstream unavailability. |
| 504 | `UPSTREAM_TIMEOUT`: no timely confirmation; upload may already have occurred. |

The selected n8n export can serialize a single item as an object or single-item array; both are accepted. Empty/non-JSON bodies never establish success. No result triggers an automatic retry. `retry_safe: true` means the recognized outcome permits a deliberate corrected retry; it does not schedule one. Review outcomes and duplicate/success outcomes lock the form until the user explicitly starts a different report, clearing all inputs. Recoverable errors preserve selected file and metadata.

## Resource and deployment limits

Incoming bytes are bounded while reading, independently of `Content-Length`, at the PDF limit plus 64 KiB for multipart framing/metadata. The parsed file is checked again against its own limit. A 15-second inbound read deadline, 32 KiB upstream response cap, and configurable upstream timeout bound ordinary operations. Buffered multipart parsing still uses memory proportional to the configured limit; this is not a streaming archival service. Signature checks do not validate an entire PDF or scan for malware.

This is an **unauthenticated local development application, not ready for internet exposure**. Same-origin checks protect browser requests but are not authentication; non-browser callers can forge headers. Before public deployment, implement authentication, authorization, rate limiting, concurrency and resource controls, trustworthy proxy/origin configuration, request limits at the ingress layer, secure webhook access, operational logging without secrets, and review of upload abuse/content risks. No credentials or backend schemas were changed here.

There is no durable idempotency/reconciliation mechanism in this app. A lost response, browser refresh, or timeout does not undo an upload. Do not retry an uncertain or partial outcome before checking the workflow and target resources. The existing workflow's branch/month lookup is not a guarantee against concurrent races. Report listing and AI chat are implemented separately; this upload route does not own them or establish indexing success.

## Safe sandbox procedure

1. Keep production unmodified. Prepare a dedicated sandbox n8n instance/workflow with the same upload contract and path, using only disposable sandbox Drive/Sheets resources and credentials. Ensure any downstream Drive triggers/indexing are isolated too. A `/webhook-test/` URL alone does **not** isolate resource writes.
2. Inspect the sandbox configuration and confirm that no node references production resources. Do not reuse an unreviewed original export as a ready-to-run sandbox. Record the sandbox ownership and disposable test branch/month before proceeding.
3. Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run typecheck`, and `npm.cmd run build` from `frontend/`. These tests inject mocked upstream calls and block global network fetch; they do not use `.env.local` or real workflow files.
4. Set `N8N_UPLOAD_WEBHOOK_URL` **only in** `frontend/.env.local` to that verified sandbox URL. Set `APP_ORIGIN` to the browser address. Keep the default size/timeout initially. Restart the loopback-bound application and open `/upload-report`.
5. Manually choose a new synthetic PDF created for the sandbox, select its matching branch/month, and click Upload Report once. Confirm the UI's 201 result against the sandbox execution, Drive file, and Sheets row. Do not regard indexing as part of the upload confirmation.
6. Deliberately submit that same branch/month once more to verify 409 with no new file. Check invalid and oversized files. Simulate service and Sheets logging failures only in the disposable sandbox. For partial/uncertain outcomes, inspect the sandbox resources before any further attempt; do not blindly retry.
7. Record observed results separately from the mocked results. Leave production testing unperformed. Clear the sandbox URL and restart when finished. Never commit `.env.local`, private exports, or resource identifiers.

Implementation references: [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) and [Node.js Fetch/FormData APIs](https://nodejs.org/docs/latest/api/globals.html).
