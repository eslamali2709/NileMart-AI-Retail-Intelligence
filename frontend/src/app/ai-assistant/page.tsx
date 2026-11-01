import type { Metadata } from "next";
import { AssistantChat } from "@/components/chat/assistant-chat";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AiAssistantPage() {
  return <><PageHeading title="AI Assistant" description="Ask questions, explore performance, and understand the story behind your retail reports." badge="Report assistant" /><AssistantChat /></>;
}
