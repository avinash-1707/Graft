import type { ConnectionStatus, Responder, WidgetMessage } from '../types';
import { Header } from './Header';
import { MessageList } from './MessageList';
import { Composer } from './Composer';

/**
 * The open chat panel: header, scrollable transcript, and composer. Sizing is
 * mobile-first — near full-viewport on small screens (with safe-area insets),
 * a floating ~360px card from the `sm:` breakpoint up (ui-context.md).
 */
export function Panel({
  botName,
  responder,
  status,
  messages,
  onSend,
  onClose,
}: {
  readonly botName: string;
  readonly responder: Responder;
  readonly status: ConnectionStatus;
  readonly messages: readonly WidgetMessage[];
  readonly onSend: (text: string) => void;
  readonly onClose: () => void;
}) {
  return (
    <div
      data-graft-interactive
      role="dialog"
      aria-label={`${botName} chat`}
      className="fixed inset-0 flex flex-col overflow-hidden bg-[var(--graft-bg-surface)] shadow-2xl sm:static sm:inset-auto sm:h-[70vh] sm:max-h-[600px] sm:w-[360px] sm:rounded-xl sm:border sm:border-[var(--graft-border-default)]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <Header botName={botName} responder={responder} onClose={onClose} />
      <MessageList messages={messages} />
      {status === 'error' ? (
        <p className="px-4 pb-1 text-center text-xs text-[var(--graft-text-muted)]">
          Couldn’t reach support. Check your connection and try again.
        </p>
      ) : null}
      <Composer onSend={onSend} disabled={status === 'connecting'} />
    </div>
  );
}
