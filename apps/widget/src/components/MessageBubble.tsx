import { MessageRole } from '@graft/shared';
import type { WidgetMessage } from '../types';

/**
 * A single chat bubble. Customer turns align right with the tenant accent fill;
 * AI and agent turns align left on a subtle fill. System messages render as a
 * centered inline note (used for the transport-switch announcement in unit 23).
 */
export function MessageBubble({ message }: { readonly message: WidgetMessage }) {
  if (message.role === MessageRole.SYSTEM) {
    return (
      <div className="px-3 py-1 text-center text-xs text-[var(--graft-text-muted)]">
        {message.content}
      </div>
    );
  }

  const isCustomer = message.role === MessageRole.CUSTOMER;

  return (
    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap',
          isCustomer
            ? 'bg-[var(--graft-accent-primary)] text-[var(--graft-text-inverted)] rounded-br-md'
            : 'bg-[var(--graft-msg-ai)] text-[var(--graft-text-primary)] rounded-bl-md',
        ].join(' ')}
      >
        {message.content}
        {message.streaming ? (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 animate-pulse bg-current align-middle"
          />
        ) : null}
      </div>
    </div>
  );
}
