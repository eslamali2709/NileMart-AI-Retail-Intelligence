import "server-only";
import { createReportsHandler } from "@/lib/server/reports-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return createReportsHandler({
    N8N_REPORTS_WEBHOOK_URL: process.env.N8N_REPORTS_WEBHOOK_URL,
    N8N_REPORTS_USERNAME: process.env.N8N_REPORTS_USERNAME,
    N8N_REPORTS_PASSWORD: process.env.N8N_REPORTS_PASSWORD,
  }, (url, init) => fetch(url, init))();
}
