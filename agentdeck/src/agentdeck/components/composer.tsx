import { useEffect, useRef, useState } from "react";

interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
}

const MAX_ROWS = 8;

export function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled || streaming) return;
    onSend(text);
    setValue("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const canSend = !disabled && !streaming && value.trim().length > 0;

  return (
    <div className="border-t border-contrast/10 bg-canvas-base px-4 py-3">
      <div className="flex items-end gap-2 rounded-2xl border border-contrast/10 bg-surface px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={
            disabled ? "Connect a provider to chat" : "Message AgentDeck..."
          }
          className="max-h-48 flex-1 resize-none bg-transparent text-sm leading-6 text-contrast outline-none placeholder:text-muted disabled:cursor-not-allowed"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="shrink-0 rounded-xl border border-contrast/20 px-3 py-1.5 text-xs font-medium text-contrast transition hover:bg-surface-raised"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-on-primary transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
