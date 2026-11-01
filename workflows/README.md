# Public n8n workflows

These five JSON files are sanitized copies of the user-supplied current exports. All are **inactive**, have **no credential assignments**, and contain no pinned execution data. They are configuration templates, not turnkey integrations or proof of live service health.

Import through n8n's **Import from File** menu, configure your own resources, and review before activation. See [backend setup](../docs/BACKEND_SETUP.md) for installation and the missing Supabase definitions.

## Inventory

| File | Nodes | Trigger | Role |
| --- | ---: | --- | --- |
| [01_Monthly_Sales_Ingestion.json](01_Monthly_Sales_Ingestion.json) | 14 | POST webhook | PDF validation, archive, metadata logging |
| [02_Document_Processing.json](02_Document_Processing.json) | 17 | Drive file-created event | Extraction, metadata, embeddings, vector indexing |
| [03_AI_Assistant_RAG_Gmail.json](03_AI_Assistant_RAG_Gmail.json) | 10 | n8n chat | RAG with calculator, memory, and approved Gmail |
| [03B_Web_AI_Assistant.json](03B_Web_AI_Assistant.json) | 7 | Basic-authenticated Chat webhook | Web RAG assistant |
| [04A_Reports_Catalog_API.json](04A_Reports_Catalog_API.json) | 5 | Basic-authenticated GET webhook | Read-only metadata catalog |

## Configuration map

| Placeholder or setting | Where to configure |
| --- | --- |
| `REPLACE_WITH_DRIVE_FOLDER_ID` | 01: Upload Sales Report to Drive; 02: Google Drive Trigger |
| `REPLACE_WITH_REPORTS_SPREADSHEET_ID` | Both Sheets nodes in 01; Lookup Report in Sheets in 02; Read Reports from Google Sheets in 04A |
| `REPLACE_WITH_REPORTS_SHEET_TAB_ID` | The same Sheets nodes; choose your tab or its numeric ID |
| Google Drive OAuth2 | Drive upload, trigger, and download nodes |
| Google Sheets OAuth2 | Every Sheets node in 01, 02, and 04A |
| Supabase | Existing-chunks and vector-insert nodes in 02; vector-search tools in 03 and 03B |
| Ollama | All three embedding nodes in 02, 03, and 03B |
| Gemini / Google AI | Language-model nodes in 03 and 03B |
| Gmail OAuth2 | Gmail - Send Approved Summary in 03 only |
| HTTP Basic Auth | Chat trigger in 03B and catalog webhook in 04A |

Resource placeholders use explicit ID selectors. Cached selector labels/URLs were removed. Select the intended resource in the editor after import. The generic `My Drive`, `documents`, and `match_documents` references are retained because they express the existing design, not a private account identity.

## 01 — Monthly Sales Ingestion

**Purpose:** accept a monthly PDF and record its metadata.

**Trigger and input:** POST webhook at `monthly-sales-upload`; multipart `file`, `branch`, and `report_month`. Branch must be Cairo, Alexandria, Giza, or Mansoura; month uses YYYY-MM. The frontend adds its own stricter checks and size limits.

**Processing:** validate file and metadata, check existing branch/month rows, preserve the binary PDF, upload to Drive, and append the six-column report log. Invalid data, duplicates, lookup failures, storage failures, and partial Sheets failures have separate paths.

**Output:** 201 confirmed success; 400 validation rejection; 409 duplicate; 503 duplicate-check failure; 502 Drive/Sheets errors. Sheets failure can occur after storage and requires manual review.

**Services/credentials:** Google Drive OAuth2 and Google Sheets OAuth2.

**Configuration:** set the folder, spreadsheet, and sheet tab; assign credentials; confirm the six headers in the backend guide. The source webhook has no authentication configured. Keep this workflow local and controlled. No authentication behavior was added during sanitization.

## 02 — Document Processing

**Purpose:** prepare archived report text for retrieval.

**Trigger and input:** Google Drive file-created event in the configured folder. The file must be PDF by MIME and extension; extracted text must be usable. Metadata lookup uses the Drive ID.

**Processing:** download, extract text, look up metadata in Sheets, fall back to filename/text when appropriate, check existing chunks by file ID, split text, embed with Ollama, and insert into Supabase. Existing file IDs are skipped; non-PDFs and processing errors have explicit paths.

**Output:** indexed/skipped metadata or a processing error. This is an asynchronous workflow, not part of the upload HTTP confirmation.

**Services/credentials:** Google Drive OAuth2, Google Sheets OAuth2, Supabase, and Ollama.

**Configuration:** use the same Drive folder and metadata sheet as 01. Set up the verified Supabase schema before running. The export uses `documents`, `match_documents`, `nomic-embed-text:latest`, chunk size 1800, and overlap 250. The exact SQL and vector dimension are not supplied.

## 03 — AI Assistant RAG & Gmail

**Purpose:** answer report questions in n8n chat and send a requested summary only through human review.

**Trigger and input:** n8n Chat Trigger with response nodes. User questions supply the request; an email request also needs an explicit recipient.

**Processing:** Gemini agent with Supabase retrieval, Ollama query embeddings, conversation memory, and calculator. The Gmail tool is connected to Human Review in Chat, which is connected to the agent; it is not a direct unreviewed agent tool.

**Output:** chat response, or a reviewed email action and its outcome.

**Services/credentials:** Gemini, Supabase, Ollama, and Gmail OAuth2.

**Configuration:** assign credentials, confirm retrieval uses the same indexed corpus, and test the approval interaction before any real send. Preserve review of recipient, subject, and summary. The example email address in the prompt uses a reserved documentation domain and must not be used as a destination.

## 03B — Web AI Assistant

**Purpose:** expose the RAG assistant to the Next.js application.

**Trigger and input:** Embedded Chat/webhook mode with Basic Auth. Next.js forwards `{ action: "sendMessage", sessionId, chatInput }`.

**Processing:** Gemini agent, memory, calculator, and Supabase search with Ollama embeddings. The export uses topK 40, memory context length 8, and maximum 8 agent iterations.

**Output:** the last-node response, normalized by Next.js from `output` or `text`. The frontend returns a safe reply and session ID.

**Services/credentials:** HTTP Basic Auth, Gemini, Supabase, and Ollama.

**Configuration:** assign credentials; verify When Last Node Finishes; copy the production Chat URL generated by your imported workflow into the private frontend environment.

**Known source discrepancy:** the inherited system prompt discusses approved email, but this seven-node workflow has no Gmail or Human Review tool. Web email sending is not implemented. Sanitization preserves the prompt; Workflow 03 is the actual email demonstration.

## 04A — Reports Catalog API

**Purpose:** provide report metadata without changing reports.

**Trigger and input:** GET webhook at `nilemart-reports-catalog-v1`, protected by Basic Auth; no request body required.

**Processing:** read Google Sheets, retain rows with the required branch/month/PDF-name/file-ID shape, normalize six metadata fields, construct per-file Drive links, and sort by reporting month and upload time. It does not deduplicate valid rows.

**Output:** `success`, `total`, `branches`, `latest_report_month`, `reports`, and `fetched_at`. Sheets read failure returns 503. Next.js independently validates the response and applies safe links and dynamic grouping.

**Services/credentials:** HTTP Basic Auth and Google Sheets OAuth2.

**Configuration:** use the same metadata log as 01 and 02; assign Basic Auth; copy the production webhook URL to the frontend. No Drive write, Sheets write, or deletion node exists in this workflow.

## Provenance and sanitization

The five files were selected by purpose, node types, triggers, and topology from the current-export directory. The first three matched the earlier local public candidates; 03B and 04A supplied the missing exports. This selection does not independently prove that the live instance has remained unchanged since export.

Public copies remove credential objects, cached resource labels/URLs, workflow IDs, webhook IDs, version/instance metadata, and execution samples. Public node/condition identifiers are regenerated. Activation is false. Private Google selectors become explicit placeholders. Node names/types/versions, positions, connections, JavaScript, expressions, prompts, and error behavior are preserved.

The three older raw exports remain unchanged on the owner's disk and are explicitly ignored by root `.gitignore`. They are not part of the public workflow set. Private originals and test/sandbox references are also excluded.

## Offline validation and import limits

From the repository root, run:

```powershell
node scripts/validate-portfolio.mjs
```

The validator checks JSON shape, expected nodes, unique identifiers, connection targets, code/expression syntax, inactive status, absence of credentials/cached identifiers, and key architectural contracts. Preparation also compared executable text and topology against private source exports.

A static pass is not a completed n8n import or runtime test. Import the templates into a separate compatible instance, resolve credentials/placeholders, and inspect the canvas before activation. Exact database SQL and source n8n version remain documented configuration gaps.
