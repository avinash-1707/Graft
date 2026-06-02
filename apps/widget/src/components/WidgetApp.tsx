import { useState } from 'react';
import type { ResolvedWidgetConfig } from '../config';
import { useTransport } from '../transport/useTransport';
import { Launcher } from './Launcher';
import { Panel } from './Panel';

/**
 * Root widget component: owns open/closed state and places the launcher + panel per
 * the tenant's configured corner. The realtime transcript, responder, and send path
 * come from {@link useTransport} (AI-mode SSE connection manager); unit 23 adds the
 * WebSocket transport + silent switch behind the same hook.
 */
export function WidgetApp({ config }: { readonly config: ResolvedWidgetConfig }) {
  const { appearance } = config;
  const { messages, responder, status, sendMessage } = useTransport(config);

  const [open, setOpen] = useState(false);

  const alignment =
    appearance.launcherPosition === 'BOTTOM_LEFT'
      ? 'left-4 items-start sm:left-6'
      : 'right-4 items-end sm:right-6';

  return (
    <div className={`fixed bottom-4 flex flex-col gap-3 sm:bottom-6 ${alignment}`}>
      {open ? (
        <Panel
          botName={appearance.botName}
          responder={responder}
          status={status}
          messages={messages}
          onSend={sendMessage}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <Launcher open={open} unread={false} onToggle={() => setOpen((value) => !value)} />
    </div>
  );
}
