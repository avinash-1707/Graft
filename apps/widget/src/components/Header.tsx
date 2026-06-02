import { WIDGET_AI_STATUS_COPY, WIDGET_HUMAN_STATUS_COPY } from '@graft/shared';
import type { Responder } from '../types';
import { CloseIcon } from './icons';

/**
 * Panel header: tenant bot name plus a status line announcing the active
 * responder. Only customer-facing copy is shown — never internal state names or
 * transport details (code-standards: widget). The status dot is green for a
 * human agent, accent for AI.
 */
export function Header({
  botName,
  responder,
  onClose,
}: {
  readonly botName: string;
  readonly responder: Responder;
  readonly onClose: () => void;
}) {
  const isHuman = responder === 'HUMAN';
  const statusCopy = isHuman ? WIDGET_HUMAN_STATUS_COPY : WIDGET_AI_STATUS_COPY;

  return (
    <header className="flex items-center justify-between gap-3 border-b border-[var(--graft-border-default)] px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--graft-text-primary)]">{botName}</p>
        <p className="flex items-center gap-1.5 text-xs text-[var(--graft-text-muted)]">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              backgroundColor: isHuman ? '#16a34a' : 'var(--graft-accent-primary)',
            }}
          />
          {statusCopy}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close chat"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--graft-text-muted)] transition-colors hover:bg-[var(--graft-bg-subtle)] hover:text-[var(--graft-text-primary)]"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
    </header>
  );
}
