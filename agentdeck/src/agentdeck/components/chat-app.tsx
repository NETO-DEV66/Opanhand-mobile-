import { useState } from "react";
import { useChat } from "../use-chat";
import { getProvider } from "../providers";
import { ProviderSetup } from "./provider-setup";
import { MessageList } from "./message-list";
import { Composer } from "./composer";
import { SettingsSheet } from "./settings-sheet";

export function ChatApp() {
  const chat = useChat();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  if (!chat.connection) {
    return <ProviderSetup onConnect={chat.updateConnection} />;
  }

  const provider = getProvider(chat.connection.providerId);
  const model = chat.connection.model || provider?.defaultModel || "";

  const startRename = () => {
    if (!chat.activeConversation) return;
    setDraftTitle(chat.activeConversation.title);
    setRenaming(true);
  };

  const commitRename = () => {
    if (chat.activeConversation) {
      chat.renameConversation(chat.activeConversation.id, draftTitle);
    }
    setRenaming(false);
  };

  const sidebar = (
    <div className="flex h-full w-full flex-col border-r border-contrast/10 bg-canvas-base">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-sm font-semibold text-contrast">AgentDeck</span>
        <button
          type="button"
          onClick={() => {
            chat.newConversation();
            setDrawerOpen(false);
          }}
          className="rounded-lg border border-contrast/15 px-2.5 py-1 text-xs font-medium text-contrast transition hover:bg-surface-raised"
        >
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {chat.conversations.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted">No conversations yet.</p>
        ) : (
          chat.conversations.map((conversation) => {
            const active = conversation.id === chat.activeId;
            return (
              <div
                key={conversation.id}
                className={[
                  "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
                  active
                    ? "bg-surface-raised text-contrast"
                    : "text-muted hover:bg-surface hover:text-contrast",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => {
                    chat.selectConversation(conversation.id);
                    setDrawerOpen(false);
                  }}
                  className="flex-1 truncate text-left"
                >
                  {conversation.title || "Untitled"}
                </button>
                <button
                  type="button"
                  onClick={() => chat.deleteConversation(conversation.id)}
                  aria-label="Delete conversation"
                  className="shrink-0 text-muted opacity-0 transition hover:text-danger group-hover:opacity-100"
                >
                  &times;
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-contrast/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: provider?.accent ?? "#64748b" }}
            aria-hidden
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-contrast">
              {provider?.label ?? chat.connection.providerId}
            </span>
            <span className="truncate text-[11px] text-muted">{model}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-xs text-muted transition hover:text-contrast"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={chat.disconnect}
            className="text-xs text-muted transition hover:text-danger"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-canvas-base text-contrast">
      <aside className="hidden w-64 shrink-0 md:block">{sidebar}</aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-72">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-contrast/10 px-4 py-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open conversations"
            className="rounded-lg border border-contrast/15 px-2 py-1 text-xs text-contrast md:hidden"
          >
            Menu
          </button>
          {renaming && chat.activeConversation ? (
            <input
              // Renaming is an explicit user action on an input that replaces
              // the title in place, so focusing it is the expected behaviour.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="flex-1 rounded-lg border border-contrast/15 bg-surface px-2 py-1 text-sm text-contrast outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={startRename}
              disabled={!chat.activeConversation}
              className="flex-1 truncate text-left text-sm font-medium text-contrast disabled:cursor-default"
            >
              {chat.activeConversation?.title ?? "New chat"}
            </button>
          )}
        </header>

        {chat.error ? (
          <div className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger">
            {chat.error}
          </div>
        ) : null}

        <MessageList
          messages={chat.activeConversation?.messages ?? []}
          streaming={chat.isStreaming}
        />

        <Composer
          onSend={chat.send}
          onStop={chat.stop}
          streaming={chat.isStreaming}
          disabled={!chat.connection}
        />
      </div>

      {settingsOpen ? (
        <SettingsSheet
          connection={chat.connection}
          onSave={chat.updateConnection}
          onDisconnect={() => {
            chat.disconnect();
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}
