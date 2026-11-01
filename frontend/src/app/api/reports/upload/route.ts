import "server-only";
import { createUploadHandler } from "@/lib/server/upload-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const handler = createUploadHandler({
    NODE_ENV: process.env.NODE_ENV,
    N8N_UPLOAD_WEBHOOK_URL: process.env.N8N_UPLOAD_WEBHOOK_URL,
    APP_ORIGIN: process.env.APP_ORIGIN,
    UPLOAD_MAX_BYTES: process.env.UPLOAD_MAX_BYTES,
    UPLOAD_TIMEOUT_MS: process.env.UPLOAD_TIMEOUT_MS,
  }, (url, init) => fetch(url, init));
  return handler(request);
}
