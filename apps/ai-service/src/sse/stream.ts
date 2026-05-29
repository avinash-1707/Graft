import { SSE_EVENT_NAME, type ServerEvent } from '@graft/shared';
import type { ServerResponse } from 'node:http';

/**
 * Writes one {@link ServerEvent} as an SSE frame under the project's single event
 * name (`SSE_EVENT_NAME`). The payload is the JSON-encoded discriminated-union
 * event; the widget parses it and dispatches on `type`.
 */
export function writeServerEvent(res: ServerResponse, event: ServerEvent): void {
  res.write(`event: ${SSE_EVENT_NAME}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/** SSE response headers: stream, no buffering (proxies/Nginx), keep-alive. */
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Disable proxy buffering so tokens flush immediately (Nginx and similar).
  'X-Accel-Buffering': 'no',
};
