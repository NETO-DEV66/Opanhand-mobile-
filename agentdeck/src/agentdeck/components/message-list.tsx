import { useEffect, useRef } from "react";
import type { StoredMessage } from "../storage";

interface MessageListProps {
  messages: StoredMessage[];
  streaming: boolean;
}

export function MessageList({ messages, streaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastContent = messages[messages.length - 1]?.content ?? "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastContent]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted">
        Send a message to start the conversation.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const isLast = index === messages.length - 1;
        const showCaret = streaming && !isUser && isLast && !message.error;
        return (
          <div
            key={message.id}
            className={isUser ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={[
                "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
                isUser
                  ? "bg-primary text-on-primary"
                  : message.error
                    ? "border border-danger/40 bg-danger/10 text-danger"
                    : "border border-contrast/10 bg-surface text-contrast",
              ].join(" ")}
            >
              {message.content}
              {showCaret ? (
                <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-contrast/70" />
              ) : null}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
