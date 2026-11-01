# Sales Reports catalog

The implemented `/sales-reports` destination displays the read-only Workflow 04A catalog. It retains every record returned by the API and provides dynamic summary cards, filename/branch/month search, branch and month filters, deterministic sorting, reset, refresh, retry, loading, empty, and no-results states. Upload times use Africa/Cairo. The table scrolls horizontally on narrow screens and wraps long filenames. Use the [public Workflow 04A export](../workflows/04A_Reports_Catalog_API.json) and [backend setup guide](BACKEND_SETUP.md) for your own local configuration.

## Server integration

The browser requests only `GET /api/reports`. The server route reads `N8N_REPORTS_WEBHOOK_URL`, `N8N_REPORTS_USERNAME`, and `N8N_REPORTS_PASSWORD` from the existing environment, and sends Basic Authentication to the configured production webhook. `.env.local` is unchanged. Example variable names are documented in `frontend/.env.example`.

The upstream URL must use `/webhook/nilemart-reports-catalog-v1` (optional trailing slash), HTTPS or HTTP on loopback, and contain no credentials, query, or fragment. Redirects are rejected. A 15-second deadline includes response-body reading, and streamed response data is limited to 5 MiB. Invalid or incomplete catalogs fail visibly rather than silently discarding records. Upstream error bodies and unknown JSON fields are not forwarded. Authentication failures become sanitized HTTP 502 responses, upstream 503 remains 503, connection errors become 502, and timeouts become 504. Missing configuration returns 503.

Both fetches and responses disable caching. The route is explicitly dynamic. Credentials and the Basic Authentication header are used only on the server. This follows the existing local-development application model; the catalog route does not add end-user authentication. Keep the application local unless application access controls are implemented separately.

Only HTTPS links on exactly `drive.google.com`, with `/file/d/{drive_file_id}/view` matching the record's ID, are enabled. Query strings and fragments are removed. Invalid links remain as rows with “Link unavailable”; they do not hide reports. Valid links use `target="_blank"` and `rel="noopener noreferrer"`.

## Multiple uploads and statistics

Grouping uses the normalized branch (Unicode NFKC, trimmed/collapsed whitespace, lowercase) and validated `YYYY-MM` month. Every member of a group larger than one receives “Multiple Uploads,” even when filters show only one member. This says nothing about PDF contents. Grouping never deduplicates, replaces, deletes, or modifies files.

Total files is the number of records; unique reporting periods is the number of branch/month groups; extra upload records is total files minus group count. Branches and months are derived from records. Summary cards always describe the complete catalog, while the results count reflects filters. Drive IDs provide row identity, with an occurrence suffix retaining rows even if the same ID is repeated upstream.

Default sorting is report month descending, upload instant descending, then Drive ID, filename, and source position for ties. Optional oldest-month sorting retains newest upload first within each month. Failed refreshes preserve the last successful catalog and visibly identify it as potentially out of date.

## Local testing

1. Keep the existing n8n service running on port 5678 and Workflow 04A published. Keep the three existing report environment settings in `frontend/.env.local`.
2. In PowerShell:

   ```powershell
   cd frontend
   npm.cmd run dev -- --hostname 127.0.0.1
   ```

3. Open `http://localhost:3000/sales-reports`. If a development server is already running on port 3000, use that server instead of starting a second one.
4. Clear filters and confirm all catalog records appear. Search a filename, select a branch/month, try a search with no results, reset filters, and refresh. Counts depend on your own metadata log. The automated fixture contains four Cairo September rows and checks every multiple-upload badge and individual link; that fixture is not seeded into the live service. Do not create duplicate records in external services merely to reproduce the fixture.
5. “View PDF” opens Google Drive in a new tab; access to the PDF still depends on the user's existing Google Drive permissions.

Run verification from `frontend`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

`npm.cmd` avoids this machine's PowerShell restriction on `npm.ps1`. Automated tests use injected mocks and synthetic Drive IDs; they do not call n8n or mutate external data.

## Historical implementation verification (2026-11-01)

These results describe the original Sales Reports implementation session. Current portfolio-preparation results are recorded separately in [VALIDATION.md](VALIDATION.md).

- All 122 tests passed, including 13 new catalog tests covering authentication, configuration, HTTP errors, timeouts/stalled bodies, malformed and oversized responses, empty catalogs, unsafe links, all-row rendering, grouping, search, filtering, sorting, and credential/error sanitization.
- ESLint, TypeScript, and production build passed after correcting the initial-fetch effect.
- A real authenticated request through the handler returned upstream HTTP 200 and a normalized HTTP 200 catalog: 16 files, 13 unique branch/month combinations, 3 extra uploads, 4 branches, latest month October 2026, and zero blocked links. These are observed values, not application constants.
- HTTP smoke checks of `/sales-reports` and `/api/reports` on port 3000 returned 200.
- Automated React rendering verified all 16 fixture rows, all four multiple-upload badges, individual safe links, and escaped metadata. Interactive desktop/mobile visual checks remain unverified: browser automation stopped because it could not establish Chrome's current URL safely.
- Node's existing strip-types test setup emits a non-failing module-type warning. No dependencies or package configuration were changed.

## Historical implementation file changes

- Modified: `frontend/src/app/sales-reports/page.tsx`, `frontend/.env.example`.
- Added: `frontend/src/app/api/reports/route.ts`, `frontend/src/lib/server/reports-handler.ts`, `frontend/src/lib/reports.ts`, `frontend/src/lib/fetch-reports.ts`, `frontend/src/components/reports/reports-catalog.tsx`, `frontend/src/components/reports/reports-table.tsx`, `frontend/tests/fixtures/reports.mjs`, `frontend/tests/reports-api.test.mjs`, `frontend/tests/reports.test.mjs`, and this document.

No workflow JSON, AI Assistant implementation, Upload Report implementation, environment credentials, Sheets data, or Drive files were edited. Nothing was committed or published. This workspace has no Git repository metadata, so Git-based change comparison was unavailable. TypeScript/Next.js checks can refresh generated build and type-cache files.
