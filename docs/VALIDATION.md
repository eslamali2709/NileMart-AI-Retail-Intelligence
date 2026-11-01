# Validation history

## Portfolio preparation — 2026-11-01

Fresh checks were run on the prepared repository with Node.js 24.14.0 and npm 11.9.0. These are new results, separate from the earlier Dashboard and Sales Reports implementation records.

| Check | Current result |
| --- | --- |
| `npm.cmd test` | **125 tests/subtests passed**, zero failures or skips |
| `npm.cmd run lint` | Passed with zero errors/warnings |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed; all four page routes and three API routes retained |
| `node scripts/validate-portfolio.mjs` | Passed for all five public exports, sample reconciliation, ignore rules, and local documentation references |
| Workflow executable syntax | Eight Code-node bodies and 34 complete expressions parsed without executing them |
| Public-file security review | 70 non-ignored files checked; zero matches against 138 private-identifier/credential fingerprints after excluding generic schema field names and public webhook path contracts |
| Protected-file integrity | SHA-256 comparison: all 57 protected files unchanged, including private originals, `.env.local`, frontend source/tests, and legacy raw exports |
| Selected sample PDFs | Two pages per PDF rendered with the local Windows PDF renderer; all four pages visually reviewed, with text and metadata checks |

All public workflow JSONs are inactive, credential-free, and structurally consistent. Node counts are 14, 17, 10, 7, and 5 for 01, 02, 03, 03B, and 04A respectively. Connections and executable content were compared with the supplied originals. Public sample checks reconcile two report rows, 24 sales rows, 24 inventory rows, and the scoped expected answers.

No new live n8n execution, upload, Gmail send, Drive/Sheets mutation, or Supabase operation was performed. No fresh-instance n8n import or frontend browser interaction was claimed. Exact database definitions, source n8n version, model digest, screenshots, and demo recording remain handoff items. The existing Node strip-types module-detection warning is informational; no dependencies were added or upgraded.

Build/typecheck generated ignored artifacts as expected. The working directory still has no Git repository metadata; no commits, remotes, or history were created or reviewed. See [publication review](PUBLICATION_REVIEW.md) for the file inventory and limitations.

The sections below retain earlier phase records. Statements about absent environment files, placeholders, unconfigured services, or unexecuted integrations describe those past phases, not the current project. See [README](../README.md), [architecture](ARCHITECTURE.md), and [publication review](PUBLICATION_REVIEW.md) for the current state.

## Phase 2C — Local sandbox configuration fix

Confirmed root cause: `configuration()` accepted only the standard `monthly-sales-upload` paths. The user's dedicated `monthly-sales-e2e-sandbox-test` path failed that allowlist; `createUploadHandler()` caught the exception and returned 503 `CONFIGURATION_UNAVAILABLE` before forwarding.

The Next.js environment loader successfully loaded `frontend/.env.local`. Both URL settings matched the requested configuration, size/timeout settings were valid, and there were no duplicate definitions or relevant inherited shell overrides in the inspected environment. `NODE_ENV` was unset in the shell and absent from `.env.local`. A no-body in-process request with a fetch mock reproduced 503 and zero upstream calls before the fix. After the fix, the same loaded configuration in development mode passed configuration checks and correctly rejected the empty body with 400 `INVALID_REQUEST`, again with zero upstream calls. No actual HTTP requests or PDFs were sent during this diagnostic.

Changes are limited to the server URL allowlist, passing Next.js `NODE_ENV` to that validator, regression tests, template guidance, and documentation. The exact sandbox test path is allowed only with development mode, HTTP, a recognized loopback host, and port 5678. Standard path behavior is unchanged. Production/test/unset modes, arbitrary hosts/ports/paths, credentials, query strings, and fragments remain rejected for the exception. Same-origin checks, multipart validation, limits, redirects, and sanitized responses are unchanged. `.env.local` was not modified; `.env.example` was restored to an empty webhook value with explanatory comments.

Validation: 90 tests/subtests passed, including regression coverage for the sandbox path, restricted destinations/modes, and preserved origin/file checks. TypeScript, ESLint (zero errors/warnings), and the production build all passed. Tests use injected mocks with global fetch blocked; no external services or real workflows were contacted. The existing informational Node module-detection warning remains. No private reference files, workflows, or credentials were changed; nothing was committed or pushed. See [the local sandbox instructions](UPLOAD_API.md#historical-phase-2c-sandbox-configuration) to resume testing manually.

## Phase 2B — Server-side upload integration

Validated on 2026-10-25 with Node.js 24.14.0 and npm 11.9.0:

| Check | Result |
| --- | --- |
| `npm.cmd test` | 70 tests/subtests passed; zero failures. |
| `npm.cmd run lint` | Passed with zero errors or warnings. |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run build` | Passed; Node.js upload API emitted as a dynamic route and all page routes preserved. |
| Built application smoke check | All four pages returned HTTP 200. With the upstream URL explicitly unset, an empty local POST returned 503 `CONFIGURATION_UNAVAILABLE`; unsupported GET returned 405. No file was sent during this check. |
| Private reference integrity | SHA-256 comparison confirmed zero changes to the original reference files. |

Tests cover the complete three-field upstream FormData contract; valid and invalid files; empty content and signature checks; invalid branch/month; missing, extra, and duplicated fields; file and streamed-body limits including dishonest Content-Length; missing/invalid configuration; same-origin/header protections; confirmed 201; 400/409/502/503 semantics; Sheets partial-success/manual-review; timeouts and connection failures; oversized/malformed/non-JSON responses; contradictory success flags; response redaction; client response handling and draft preservation. Fetch mocks record exactly one attempt where forwarding occurs. The test file overrides global fetch to fail closed; tests use only injected mocked upstream responses, synthetic in-memory files, and a reserved `.invalid` hostname.

**No production or sandbox n8n execution was performed.** The local HTTP check ran without an upstream URL, sent no file, and could not forward to n8n. No service credentials, workflows, schemas, or Google/Supabase resources were changed. Only `.env.example` exists in the frontend; no real environment configuration was created. No commit or push was performed.

The existing Node test runner prints an informational module-detection warning when importing TypeScript directly; all tests pass. The pre-existing ESLint 9 support warning remains documented below. Browser-level interaction and visual testing were not performed; mocked client transport tests do not replace a future browser/sandbox acceptance test. Follow [the safe sandbox procedure](UPLOAD_API.md#safe-sandbox-procedure) before connecting any service.

### Phase 2B file inventory

Created:

- `frontend/.env.example`
- `frontend/src/app/api/reports/upload/route.ts`
- `frontend/src/lib/server/upload-handler.ts`
- `frontend/src/lib/upload-result.ts`
- `frontend/src/lib/submit-report.ts`
- `frontend/tests/upload-api.test.mjs`
- `docs/UPLOAD_API.md`

Modified:

- `frontend/src/components/upload/report-upload-form.tsx`
- `frontend/src/components/upload/pdf-file-picker.tsx`
- `frontend/src/lib/report-upload.ts`
- `frontend/src/app/upload-report/page.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/layout.tsx`
- `frontend/package.json`
- `frontend/tsconfig.json`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/VALIDATION.md`

## Phase 2A — Report upload UI

Validated on 2026-10-25 with the existing Node.js 24.14.0 environment:

- ESLint: passed with zero errors or warnings.
- TypeScript: passed.
- Production build: passed; all existing routes preserved.
- Four focused Node tests passed for branch/month boundaries, PDF extension/MIME/header and empty-file screening, read failures, and file-size formatting. Run from `frontend/` with `node --experimental-strip-types --test tests/report-upload.test.mjs` on Node.js 24. Node may print an informational module-detection warning for the directly imported TypeScript helper.
- Production HTTP smoke checks: all four routes returned 200; the upload page includes the expected field names, Phase 2B notice, and initially disabled action.

No browser automation surface was available, so rendered desktop/mobile layouts, drag/drop, focus behavior, and client interactions were not independently exercised in a browser. These remain manual preview checks. Local validation does not verify PDF text extraction, duplicate status, upload limits, or backend acceptance. No external integration was called. No private resources were modified or copied. No commits or pushes were performed.

## Phase 1 — Foundation

Validated on 2026-10-25 with Node.js 24.14.0 and npm 11.9.0 on Windows.

| Check | Result |
| --- | --- |
| `npm.cmd ci` | Passed; lockfile installation completed, audit reported zero vulnerabilities. |
| `npm.cmd run lint` | Passed with zero errors and zero warnings. |
| `npm.cmd run build` | Passed; all four application routes prerendered successfully. |
| `npm.cmd run typecheck` | Passed. |
| Production HTTP smoke check | `/`, `/sales-reports`, `/upload-report`, and `/ai-assistant` returned 200, included all navigation labels and placeholder/disconnected indicators, and contained no forms, inputs, or textareas. |
| Private reference integrity | SHA-256 comparison found no changes to the original reference files. |
| Ignore rules | Git ignore checks covered both private-directory casings, environment files, dependencies, build output, and local key files. `.env.example` remained allowed. |
| Public artifact scan | No exact matches for private workflow identifiers or resource URLs in public source, documentation, or package files. This targeted scan does not replace review before future publication. |

The temporary production server used port 3100 for smoke checks and was stopped afterward. The documented development command uses the default port 3000.

Known tooling warning: ESLint 9.39.5 is marked unsupported by npm but remains compatible with the bundled Next.js lint plugins. ESLint 10 was checked and rejected because those plugins do not declare compatible peers. Upgrade the lint dependencies together in future maintenance.

Responsive layouts and keyboard affordances are implemented; no manual browser visual or assistive-technology audit was performed in this phase. No n8n workflow, Google service, Supabase instance, or AI provider was called or runtime-tested. No commits, pushes, or deployments were performed.
