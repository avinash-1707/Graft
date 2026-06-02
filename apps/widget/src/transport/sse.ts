import {
  EMBED_TOKEN_HEADER,
  SESSION_HEADER,
  SSE_EVENT_NAME,
  serverEventSchema,
  type ServerEvent,
} from '@graft/shared';
import type { ApiConfig } from './api';

/**
 * The SSE half of the transport (AI mode). `POST /widget/messages` hijacks the
 * response into a Server-Sent Events stream for the duration of one customer turn:
 * the persisted customer `message_appended`, the AI `ai_token` chunks, the final AI
 * `message_appended`, and any `state_changed` (escalation) that fires while the turn
 * is still open. There is no idle SSE between turns — each `send` opens a fresh stream.
 *
 * Because the endpoint is a POST, `EventSource` (GET-only) cannot be used; we read the
 * `fetch` body stream and parse SSE frames by hand. The stream is cancellable via the
 * caller's `AbortSignal` (a customer disconnect aborts in-flight generation server-side,
 * invariant 12).
 */
export interface SseSendParams {
  readonly content: string;
  readonly clientNonce: string;
  readonly signal: AbortSignal;
  readonly onEvent: (event: ServerEvent) => void;
}

export class SseTransport {
  constructor(
    private readonly config: ApiConfig,
    private readonly sessionId: string,
  ) {}

  /** Opens the turn stream and pumps decoded {@link ServerEvent}s to `onEvent` until it ends. */
  async send({ content, clientNonce, signal, onEvent }: SseSendParams): Promise<void> {
    const res = await fetch(`${this.config.apiBaseUrl.replace(/\/+$/, '')}/widget/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        [EMBED_TOKEN_HEADER]: this.config.embedToken,
        [SESSION_HEADER]: this.sessionId,
      },
      body: JSON.stringify({ content, clientNonce }),
      signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`message send failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Frames are separated by a blank line; keep the trailing partial in the buffer.
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          this.dispatchFrame(frame, onEvent);
          boundary = buffer.indexOf('\n\n');
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Parses one `event:`/`data:` SSE frame and forwards a valid `graft` event. */
  private dispatchFrame(frame: string, onEvent: (event: ServerEvent) => void): void {
    let eventName: string | undefined;
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (eventName !== SSE_EVENT_NAME || dataLines.length === 0) return;

    let json: unknown;
    try {
      json = JSON.parse(dataLines.join('\n'));
    } catch {
      return; // Drop a malformed frame rather than tearing down the stream.
    }
    const parsed = serverEventSchema.safeParse(json);
    if (parsed.success) onEvent(parsed.data);
  }
}
