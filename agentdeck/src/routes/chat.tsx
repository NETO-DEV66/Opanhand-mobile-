import type { MetaFunction } from "react-router";
import { ChatApp } from "#/agentdeck/components/chat-app";

export const meta: MetaFunction = () => [{ title: "AgentDeck" }];

export default function ChatRoute() {
  return <ChatApp />;
}
