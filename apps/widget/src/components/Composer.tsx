import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { SendIcon } from './icons';

/**
 * Message input. Enter sends, Shift+Enter inserts a newline. Submitting an empty
 * or whitespace-only message is a no-op. The shell wires `onSend` to local state;
 * unit 22 swaps it for the SSE send path.
 */
export function Composer({
  onSend,
  disabled = false,
}: {
  readonly onSend: (text: string) => void;
  readonly disabled?: boolean;
}) {
  const [value, setValue] = useState('');

  function submit() {
    if (disabled) return;
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue('');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-[var(--graft-border-default)] p-2.5"
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={disabled}
        placeholder="Type a message…"
        aria-label="Message"
        className="max-h-28 min-h-[40px] flex-1 resize-none rounded-md bg-[var(--graft-bg-subtle)] px-3 py-2 text-sm text-[var(--graft-text-primary)] outline-none placeholder:text-[var(--graft-text-muted)] focus:ring-2 focus:ring-[var(--graft-accent-primary)] disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--graft-accent-primary)] text-[var(--graft-text-inverted)] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <SendIcon className="h-5 w-5" />
      </button>
    </form>
  );
}
