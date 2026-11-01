import "server-only";
import { createChatHandler } from "@/lib/server/chat-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return createChatHandler({
    N8N_CHAT_WEBHOOK_URL: process.env.N8N_CHAT_WEBHOOK_URL,
    N8N_CHAT_USERNAME: process.env.N8N_CHAT_USERNAME,
    N8N_CHAT_PASSWORD: process.env.N8N_CHAT_PASSWORD,
    APP_ORIGIN: process.env.APP_ORIGIN,
  }, (url, init) => fetch(url, init))(request);
}
