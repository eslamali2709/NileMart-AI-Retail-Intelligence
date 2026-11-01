import { CHAT_ERRORS, isChatReply, type ChatErrorCode, type ChatReply } from "./chat.ts";

export async function submitChat(message: string, sessionId: string, signal: AbortSignal, transport: typeof fetch = fetch): Promise<ChatReply> {
  let response: Response;
  try {
    response = await transport("/api/chat", {
      method: "POST", credentials: "same-origin", cache: "no-store", signal,
      headers: { "Content-Type": "application/json", "X-NileMart-Chat": "1" },
      body: JSON.stringify({ message, sessionId }),
    });
  } catch {
    throw new Error(signal.aborted ? CHAT_ERRORS.TIMEOUT : CHAT_ERRORS.UNAVAILABLE);
  }
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error(CHAT_ERRORS.INVALID_RESPONSE); }
  if (!response.ok) {
    const code = data && typeof data === "object" && "error" in data ? data.error : null;
    throw new Error(typeof code === "string" && Object.hasOwn(CHAT_ERRORS, code)
      ? CHAT_ERRORS[code as ChatErrorCode] : CHAT_ERRORS.UNAVAILABLE);
  }
  if (!isChatReply(data, sessionId)) throw new Error(CHAT_ERRORS.INVALID_RESPONSE);
  return data;
}
