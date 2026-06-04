"use client";

import { useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const TYPING_STOP_MS = 2_000;

/**
 * Agent message composer. Enter sends, Shift+Enter inserts a newline. Emits a throttled
 * typing indicator while composing and clears it on send / idle. Disabled until the
 * agent owns the conversation (the parent gates `disabled`).
 */
export function Composer({
  disabled,
  placeholder,
  onSend,
  onTyping,
}: {
  disabled: boolean;
  placeholder: string;
  onSend: (content: string) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function signalTyping() {
    onTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), TYPING_STOP_MS);
  }

  function stopTyping() {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    onTyping(false);
  }

  async function submit() {
    const content = value.trim();
    if (!content || sending || disabled) return;
    setSending(true);
    stopTyping();
    try {
      await onSend(content);
      setValue("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border p-3">
      <Textarea
        value={value}
        disabled={disabled || sending}
        placeholder={placeholder}
        rows={1}
        className="max-h-32 min-h-9 resize-none"
        onChange={(e) => {
          setValue(e.target.value);
          if (e.target.value) signalTyping();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <Button
        size="icon"
        aria-label="Send message"
        disabled={disabled || sending || value.trim() === ""}
        onClick={() => void submit()}
      >
        <SendHorizontal />
      </Button>
    </div>
  );
}
