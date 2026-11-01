# Backend setup for a local demonstration

This guide configures copies of the five supplied workflows using resources you control. It does not migrate or alter an existing live installation. The application is a local demonstration, not an authenticated public service.

## Missing configuration information

The exports verify these database references: table `documents`, retrieval function `match_documents`, a file-ID lookup on `metadata->>file_id`, and document metadata prepared by Workflow 02. **The exact CREATE TABLE / function SQL, embedding dimension, indexes, grants, and row-level security configuration are not present in the project.** Obtain the owner's schema/function definitions and review them before running indexing or retrieval. Do not treat a generic tutorial schema as a verified project migration.

The n8n application version was not included with the exports. Node `typeVersion` values are preserved, but are not the n8n version. Record the source version from the owner's installation and use a compatible version in a separate local instance. The exact Ollama model digest was not supplied; the exported `latest` tag is mutable. Fresh-instance import and end-to-end execution remain manual validation items.

## 1. Run local n8n

If an appropriate local n8n instance is already running, reuse its editor without reinstalling or upgrading it. Do not start a second instance on the same port or reuse a production data volume for experiments.

For a new instance, use the official [n8n installation documentation](https://docs.n8n.io/hosting/installation/docker/). Choose a compatible version after confirming the source version above. A minimal local Docker command has this form; replace the version placeholder before using it:

```powershell
docker volume create nilemart_demo_n8n_data
docker run --name nilemart-demo-n8n -p 127.0.0.1:5678:5678 -e GENERIC_TIMEZONE=Africa/Cairo -e TZ=Africa/Cairo -v nilemart_demo_n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n:<compatible-version>
```

This is a configuration example, not a command executed or verified during preparation. Follow the selected version's task-runner requirements for JavaScript Code nodes. The volume contains n8n state and credential material; keep it private and backed up. For subsequent starts of this example container, use `docker start nilemart-demo-n8n`.

Open `http://localhost:5678`, complete local owner setup, and keep the editor bound to loopback. Do not enable tunnels or expose the editor/webhooks publicly for this portfolio.

## 2. Import the public workflows

Use **Import from File** in the n8n workflow menu, as described in the [official import guide](https://docs.n8n.io/workflows/export-import/). Import the five files listed in [workflows/README.md](../workflows/README.md), not legacy raw exports that may remain locally.

Each export has `active: false`, no credential assignments, and empty pinned data. Verify that each imported workflow remains inactive/unpublished. Check that all node types load, all connections are visible, and no node reports an unsupported version. Do not execute or activate it until the following configuration is complete.

## 3. Configure Google Drive and Google Sheets

1. Create a dedicated folder and spreadsheet for synthetic demonstration data.
2. Configure Google Drive OAuth2 and Google Sheets OAuth2 credentials in n8n using your own Google account/project. Use the callback URL displayed by your local n8n credential dialog; never reuse account identifiers from another installation. See [n8n Google OAuth2 setup](https://docs.n8n.io/integrations/builtin/credentials/google/oauth-generic/).
3. Create a sheet tab with these exact header names:

   ```text
   branch,report_month,file_name,uploaded_at,drive_file_id,file_link
   ```

4. Replace `REPLACE_WITH_DRIVE_FOLDER_ID` in Workflow 01's upload node and Workflow 02's Drive trigger with the same folder ID.
5. Replace `REPLACE_WITH_REPORTS_SPREADSHEET_ID` and `REPLACE_WITH_REPORTS_SHEET_TAB_ID` in every Google Sheets node in Workflows 01, 02, and 04A. Select the tab in the editor or use its numeric tab ID in the By ID field. These must all refer to the same metadata log.
6. Workflow 01 retains the generic **My Drive** selection. If using a shared drive, configure and verify the Drive nodes accordingly.
7. Assign your own credentials to each Drive/Sheets node. Confirm access to the intended folder and spreadsheet without publishing any credential screenshots.

`sample-data/report_index.csv` is a reconciliation fixture, not the production Sheets schema. Let the ingestion workflow populate the six-column log; do not import the reference CSV as that log.

## 4. Configure Supabase

Obtain the verified database definitions described under missing configuration information. Review and apply them only to your own demonstration project. Then configure a Supabase credential in n8n with your project's host and the credential required by its node. Keep privileged keys in n8n; never put them in the frontend or public files. See [Supabase credentials](https://docs.n8n.io/integrations/builtin/credentials/supabase/) and [the vector-store node](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstoresupabase/).

Assign this credential to Workflow 02's insert and existing-chunks nodes and the search tools in Workflows 03 and 03B. Confirm that `documents` and `match_documents` resolve to the verified schema. If your reviewed schema uses different names, configure all affected nodes and the function consistently.

Workflow 02 checks for any row with the current Drive file ID. An existing partial index can therefore cause a skip. Recovery or reindexing needs deliberate review; this guide does not supply destructive cleanup SQL.

## 5. Configure Ollama embeddings

Install and run Ollama using its [official instructions](https://docs.ollama.com/quickstart). Obtain the exported embedding model:

```text
ollama pull nomic-embed-text:latest
```

The model is documented in [Ollama's model library](https://ollama.com/library/nomic-embed-text). Configure an Ollama credential/base URL reachable from n8n, and assign it to the embedding nodes in Workflows 02, 03, and 03B.

When both services run on the host, the usual local Ollama URL is `http://localhost:11434`. From Docker Desktop, host access commonly uses `http://host.docker.internal:11434`; verify reachability from your container. Container-local `localhost` refers to the container itself. Configure networking for the local demonstration without exposing the embedding service publicly.

Use the same model and verified vector dimension for insertion and search. Record the installed model digest for reproducibility; changing embedding models is not a drop-in change to an existing vector collection.

## 6. Configure Gemini, memory, and approved email

Create your own Gemini credential in n8n and assign it to the language-model nodes in Workflows 03 and 03B. Both exports select `models/gemini-3.5-flash-lite`; verify that your account and n8n version support that model. This preparation preserves the supplied selection and does not claim provider availability. Follow [n8n Gemini credential setup](https://docs.n8n.io/integrations/builtin/credentials/googleai/).

Keep the chat trigger, conversation memory, calculator, and retrieval tool connections intact. Workflow 03B receives `sessionId` from Next.js. Validate a follow-up question in a new session before relying on conversational context.

Only Workflow 03 contains Gmail and Human Review nodes. Assign your own Gmail OAuth2 credential there if demonstrating email. Inspect the recipient, subject, and summary before approving a requested send. No email was sent during preparation. The web assistant has no connected email tool, despite inherited email instructions in its prompt.

## 7. Configure webhook authentication and URLs

| Workflow | Configuration |
| --- | --- |
| 01 | POST webhook with path `monthly-sales-upload`; source export has no webhook authentication, so keep it local |
| 03 | n8n-native chat with response nodes and the human-review path |
| 03B | Embedded Chat/webhook mode, Basic Auth, and When Last Node Finishes; select your own HTTP Basic Auth credential |
| 04A | GET webhook with path `nilemart-reports-catalog-v1`, Basic Auth, and Respond to Webhook nodes |

Assign a Basic Auth credential to both 03B and 04A, preferably distinct credentials. Keep the username/password out of URLs. After configuration and review, activate/publish only your own demo copies. Use the **Production URL** shown by the imported trigger. Chat URLs include an instance-generated identifier and should never be guessed from another export.

The expected loopback upload/catalog paths are `http://localhost:5678/webhook/monthly-sales-upload` and `http://localhost:5678/webhook/nilemart-reports-catalog-v1`. These are generic examples derived from workflow paths, not values copied from a private environment file. Test URLs require a listening editor and are not persistent production URLs.

## 8. Connect the frontend

Follow the root [installation instructions](../README.md#local-installation). Copy [frontend/.env.example](../frontend/.env.example) only when `.env.local` does not already exist, then fill your own local settings:

- `N8N_UPLOAD_WEBHOOK_URL`: Workflow 01 production URL.
- `N8N_CHAT_WEBHOOK_URL`, `N8N_CHAT_USERNAME`, `N8N_CHAT_PASSWORD`: Workflow 03B production Chat URL and its Basic Auth credential.
- `N8N_REPORTS_WEBHOOK_URL`, `N8N_REPORTS_USERNAME`, `N8N_REPORTS_PASSWORD`: Workflow 04A production URL and its Basic Auth credential.
- `APP_ORIGIN`: exact browser origin; use `http://localhost:3000` consistently with the documented browser URL.
- Leave the documented upload size/deadline defaults unless you intentionally need different limits.

Restart Next.js. The handlers allow HTTP only on loopback and reject credential-bearing URLs and redirects. They do not require Google, Gemini, Supabase, or Ollama secrets in the frontend environment.

## 9. Manual verification after configuration

Use [sample-data/README.md](../sample-data/README.md) and isolated resources. Confirm upload response, Drive file, and Sheets row separately. Confirm indexing before asking report-content questions. Compare answers to the scoped expected-answer JSON. Refresh the catalog, test search/filter/reset, and confirm each PDF link opens the matching file.

Do not retry a partial or uncertain upload until its existing effects are reconciled. Upload success does not prove indexing success. Duplicate detection and retrieval limitations are explained in [architecture](ARCHITECTURE.md).

Run the offline checks in [VALIDATION.md](VALIDATION.md). Record manual import/runtime results separately; the repository's automated checks do not call Google, Supabase, Gmail, or the LLM.
