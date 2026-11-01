"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { AssistantMarkdown } from "@/components/chat/assistant-markdown";
import { CHAT_ERRORS, MAX_CHAT_MESSAGE_LENGTH, restoreConversation, type Conversation } from "@/lib/chat";
import { submitChat } from "@/lib/submit-chat";

const STORAGE_KEY = "nilemart.chat.v1";
const questions = [
  "What were Cairo's net sales in October 2026?",
  "Which branch had the highest net sales in September 2026?",
  "Summarize the inventory risks in the available reports.",
];
const newConversation = (): Conversation => ({ sessionId: crypto.randomUUID(), messages: [] });

// Render text through React only. Basic emphasis keeps answers readable without HTML or executable links.
function ReplyText({ text }: { text: string }) {
  return <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part.startsWith("`") && part.endsWith("`") ? <code key={index} className="rounded bg-stone-100 px-1 text-[0.9em] text-slate-800">{part.slice(1, -1)}</code>
        : part,
  )}</div>;
}

export function AssistantChat() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; question: string } | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let saved: Conversation | null = null;
    try { saved = restoreConversation(sessionStorage.getItem(STORAGE_KEY)); } catch { /* Continue in memory if storage is blocked. */ }
    // Browser-only storage must be read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversation(saved || newConversation());
    return () => { requestRef.current?.abort(); requestRef.current = null; };
  }, []);

  useEffect(() => {
    if (!conversation) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...conversation, messages: conversation.messages.slice(-100) })); }
    catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageUnavailable(true);
    }
  }, [conversation]);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [conversation, pending, error]);

  async function send(question = draft, retry = false) {
    const message = question.trim();
    if (!conversation || requestRef.current || !message || message.length > MAX_CHAT_MESSAGE_LENGTH) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    setError(null);
    if (!retry) {
      setDraft("");
      setConversation((current) => current && ({ ...current, messages: [...current.messages, { id: crypto.randomUUID(), role: "user", text: message }] }));
    }
    const timer = setTimeout(() => controller.abort(), 100_000);
    try {
      const result = await submitChat(message, conversation.sessionId, controller.signal);
      if (requestRef.current !== controller) return;
      setConversation((current) => current && ({ ...current, messages: [...current.messages, { id: crypto.randomUUID(), role: "assistant", text: result.reply }] }));
    } catch (cause) {
      if (requestRef.current !== controller) return;
      setError({ message: cause instanceof Error ? cause.message : CHAT_ERRORS.UNAVAILABLE, question: message });
    } finally {
      clearTimeout(timer);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPending(false);
        inputRef.current?.focus();
      }
    }
  }

  function startNewChat() {
    if (requestRef.current) return;
    setConversation(newConversation());
    setDraft("");
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <section aria-label="Report assistant" className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Icon name="assistant" /></span><div><h2 className="text-sm font-semibold text-slate-900">NileMart Assistant</h2><p className="mt-1 text-xs text-slate-500">Grounded in available sales and inventory reports</p></div></div>
        <button type="button" onClick={startNewChat} disabled={!conversation || pending} className="shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">New Chat</button>
      </div>

      <div ref={scrollRef} className="h-[min(55dvh,560px)] min-h-80 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7" tabIndex={0} aria-label="Scrollable conversation">
        {!conversation?.messages.length ? (
          <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center py-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-emerald-800 uppercase">From reports to answers</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">What would you like to understand?</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">Explore branch sales, compare reporting periods, or ask about inventory risks. Answers depend on the reports available to the assistant.</p>
            <div className="mt-6 grid gap-3">{questions.map((question) => <button key={question} type="button" disabled={!conversation || pending} onClick={() => void send(question)} className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3 text-left text-sm leading-6 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50 disabled:opacity-50"><span>{question}</span><Icon name="arrow" className="size-4 shrink-0 text-emerald-700" /></button>)}</div>
          </div>
        ) : null}
        <div role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions" className="space-y-5">
          {conversation?.messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><article className={`min-w-0 max-w-[95%] rounded-2xl px-4 py-3 sm:max-w-[85%] sm:px-5 ${message.role === "user" ? "rounded-tr-sm bg-emerald-900 text-white" : "rounded-tl-sm border border-stone-200 bg-stone-50 text-slate-800"}`}><p className={`mb-2 text-[11px] font-semibold tracking-wide ${message.role === "user" ? "text-emerald-100" : "text-emerald-800"}`}>{message.role === "user" ? "You" : "NileMart Assistant"}</p><div className="text-sm leading-7">{message.role === "assistant" ? <AssistantMarkdown text={message.text} /> : <ReplyText text={message.text} />}</div></article></div>)}
        </div>
        <div role="status" className={pending ? "mt-5 flex items-center gap-2 text-sm text-emerald-800" : "sr-only"}>{pending && <><span className="size-2 rounded-full bg-emerald-600" aria-hidden="true" />Thinking — checking the available reports…</>}</div>
        {error && <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><p>{error.message}</p><p className="mt-1 text-xs">Retry sends the same question again; a previous attempt may already be in conversation memory.</p><button type="button" disabled={pending} onClick={() => void send(error.question, true)} className="mt-3 rounded-lg border border-amber-300 bg-white px-4 py-2 font-semibold hover:bg-amber-100">Retry question</button></div>}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t border-stone-200 bg-stone-50/60 p-5 sm:px-7">
        <label htmlFor="chat-message" className="mb-2 block text-sm font-medium text-slate-800">Ask about your reports</label>
        <div className="flex flex-col items-end gap-3 sm:flex-row">
          <textarea ref={inputRef} id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} readOnly={pending} disabled={!conversation} maxLength={MAX_CHAT_MESSAGE_LENGTH} rows={3} aria-describedby="chat-input-help" placeholder="Ask a question about sales or inventory…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} className="w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 placeholder:text-slate-400 read-only:bg-stone-50 disabled:opacity-50" />
          <button type="submit" disabled={!conversation || pending || !draft.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-slate-500">{pending ? "Thinking…" : "Send"}<Icon name="arrow" className="size-4" /></button>
        </div>
        <div id="chat-input-help" className="mt-3 flex flex-wrap justify-between gap-2 text-xs leading-5 text-slate-500"><span>Enter to send · Shift+Enter for a new line</span><span>{draft.length.toLocaleString()} / 4,000</span></div>
        <p className="mt-2 text-xs leading-5 text-slate-500">Check source filenames and reporting periods before making decisions. New Chat starts a fresh conversation.</p>
        {storageUnavailable && <p role="status" className="mt-2 text-xs text-amber-800">Tab storage is unavailable. This conversation will reset if you reload or leave this page.</p>}
      </form>
    </section>
  );
}
