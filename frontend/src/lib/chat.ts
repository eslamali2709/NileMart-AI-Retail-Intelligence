export const MAX_CHAT_MESSAGE_LENGTH = 4_000;
export const MAX_CHAT_REPLY_LENGTH = 64_000;
export const CHAT_ERRORS = {
  INVALID_REQUEST: "Enter a message of up to 4,000 characters and try again.",
  FORBIDDEN: "This request was blocked. Open the assistant from the local NileMart app.",
  NOT_CONFIGURED: "The assistant is not configured. Ask the local operator to check the chat settings.",
  AUTH_FAILED: "The assistant could not authenticate. Ask the local operator to check the n8n chat credentials.",
  UNAVAILABLE: "The assistant is unavailable. Check that n8n is running and Workflow 03B is published, then retry.",
  INVALID_RESPONSE: "The assistant returned an unreadable response. Please try again.",
  TIMEOUT: "The assistant took too long to respond. It may still be processing your question. Wait a moment before retrying.",
} as const;
export type ChatErrorCode = keyof typeof CHAT_ERRORS;
export type ChatReply = { reply: string; sessionId: string };
export type ChatMessage = { id: string; role: "user" | "assistant"; text: string };
export type Conversation = { sessionId: string; messages: ChatMessage[] };

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
}

export function isChatReply(value: unknown, sessionId: string): value is ChatReply {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ChatReply>;
  return data.sessionId === sessionId && typeof data.reply === "string"
    && data.reply.trim().length > 0 && data.reply.length <= MAX_CHAT_REPLY_LENGTH;
}

export function restoreConversation(raw: string | null): Conversation | null {
  try {
    const data: unknown = JSON.parse(raw || "null");
    if (!data || typeof data !== "object") return null;
    const saved = data as Conversation;
    if (!isSessionId(saved.sessionId) || !Array.isArray(saved.messages) || saved.messages.length > 100) return null;
    if (!saved.messages.every((message) => message && typeof message.id === "string"
      && (message.role === "user" || message.role === "assistant")
      && typeof message.text === "string" && message.text.length <= MAX_CHAT_REPLY_LENGTH)) return null;
    return { sessionId: saved.sessionId, messages: saved.messages };
  } catch { return null; }
}
