# Web AI Assistant (Workflow 03B)

The implemented assistant at `/ai-assistant` sends JSON to the same-origin `POST /api/chat` route. Only the Node.js server reads the n8n Chat URL and Basic Auth credentials. No chat credentials or upstream diagnostics are returned to the browser or logged by this implementation. Use the sanitized [Workflow 03B export](../workflows/03B_Web_AI_Assistant.json) and [backend setup guide](BACKEND_SETUP.md) for a separate local configuration.

Workflow 03B provides RAG, memory, and calculator access. It has no connected Gmail or approval node. Its inherited prompt still mentions email, but email sending is provided only by the separate [Workflow 03](../workflows/03_AI_Assistant_RAG_Gmail.json). Portfolio preparation preserves that source behavior rather than adding tools.

## Local setup

In the existing `frontend/.env.local`, ensure these server-only variables are nonempty (do not overwrite existing settings):

```dotenv
N8N_CHAT_WEBHOOK_URL=<production Chat URL from Workflow 03B>
N8N_CHAT_USERNAME=<Chat Trigger Basic Auth username>
N8N_CHAT_PASSWORD=<Chat Trigger Basic Auth password>
```

Never prefix them with `NEXT_PUBLIC_`. Keep `APP_ORIGIN=http://localhost:3000` when using the URL below. Restart Next.js after changing environment settings. The server permits HTTPS upstream URLs, or HTTP on loopback for local n8n; it refuses URL-embedded credentials, query strings, fragments, and redirects.

Workflow **NileMart — 03B Web AI Assistant — RAG** must be published with Embedded Chat, Basic Auth, and **When Last Node Finishes**. Use its production Chat URL, not an editor-only test URL. Gemini, Supabase retrieval, Ollama embeddings, and the existing conversation memory must be working. No workflow changes are performed by this frontend.

The server forwards `{ action: "sendMessage", sessionId, chatInput }`. It accepts a nonempty `output` or `text` from the last node, including a single-item array or n8n `{ json: ... }` wrapper, and returns `{ reply, sessionId }`. These fields follow the [n8n Chat Trigger documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.chattrigger/). Unknown structures, empty answers, and HTML responses are rejected rather than presented as answers.

## Test the chat

1. Start local n8n at `http://localhost:5678` and confirm Workflow 03B is published.
2. From the repository root, run `cd frontend`, then `npm.cmd run dev -- --hostname 127.0.0.1`.
3. Open **http://localhost:3000/ai-assistant** (use `localhost` consistently with `APP_ORIGIN`).
4. After the included sample is uploaded and indexed, ask **What were Cairo's net sales in September 2026?** The synthetic reference answer is **EGP 922,573**, with source **NileMart_CAI_2026-09_Sales_Inventory.pdf**. See [sample-data](../sample-data/README.md). This is a fixture expectation, never a fallback answer. The existing UI also suggests an October question; October PDFs are not included in this public sample set, so an unavailable-report response is appropriate unless you independently add those reports.
5. Ask **Which report did that answer come from?** to check conversation memory. Reload the tab: the session ID and recent displayed messages should persist. **New Chat** clears displayed history and creates a fresh session ID; it does not delete old n8n memory.
6. Check Enter sends, Shift+Enter inserts a newline, and sending is disabled while waiting. Check a narrow window for wrapping, including long source filenames.
7. In browser Network tools, verify the request goes to `/api/chat`, contains only `message` and `sessionId`, and carries no upstream URL or Basic Auth header.

The route bounds messages to 4,000 characters, bodies to 32 KiB, upstream response bodies to 128 KiB, and replies to 64,000 characters. It waits up to 90 seconds for n8n; the browser deadline is 100 seconds. Retry is explicit and may repeat a question already processed by n8n after a timeout.

Assistant responses use `react-markdown`, `remark-gfm`, and `remark-breaks` for emphasis, paragraphs, line breaks, lists, headings, inline/fenced code, and tables. Styling is scoped to assistant messages, with wrapping filenames and scrollable tables/code blocks. Raw HTML is skipped and code is escaped; no HTML injection is used. Source links permit HTTP(S), root-relative paths, and local anchors with `noopener noreferrer`; unsafe or unsupported URLs remain plain text. Images render only their alt text, preventing automatic remote requests. User messages keep their existing rendering. The focused renderer tests exercise the real component through React's server renderer.

Up to 100 recent displayed messages and the session ID are stored in `sessionStorage` for the current browser tab. Closing the tab ends that browser session. If storage is blocked or full, the current page continues in memory and shows a notice. n8n may retain server-side conversation memory independently.

## Checks

From `frontend`, run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, then `npm.cmd run typecheck`. Chat unit tests inject mocked upstream requests and use synthetic credentials. They cover missing/invalid input, origin checks, configuration, Basic Auth, Agent/Chain response formats, offline n8n, authentication failures, malformed responses, timeouts, client transport, and session restoration. The Cairo amount/source fixture alone does not establish live integration success.

**Local development only:** origin/header checks are not user authentication. Public deployment requires user authentication, authorization for reports and conversation sessions, rate limiting, and appropriate data retention controls. Do not expose this local endpoint publicly as-is.
