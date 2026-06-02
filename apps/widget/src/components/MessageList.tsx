import { useEffect, useRef } from 'react';
import type { WidgetMessage } from '../types';
import { MessageBubble } from './MessageBubble';

/**
 * Scrollable transcript. Auto-scrolls to the newest message whenever the list
 * grows so the latest turn is always in view.
 */
export function MessageList({ messages }: { readonly messages: readonly WidgetMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  // Follow both new turns and streaming token growth on the latest bubble.
  const lastContentLength = messages.at(-1)?.content.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, lastContentLength]);

  return (
    <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
