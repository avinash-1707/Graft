import {
  EMBED_TOKEN_HEADER,
  SESSION_HEADER,
  SSE_EVENT_NAME,
  serverEventSchema,
  type ServerEvent,
} from '@graft/shared';
import { config } from '../config.js';

/** Mints an anonymous widget session against the gateway (embed token + allow-listed origin). */
export async function mintSession(): Promise<string> {
  const res = await fetch(`${config.gatewayUrl}/widget/session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [EMBED_TOKEN_HEADER]: config.embedToken,
      origin: config.origin,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`session mint failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { sessionId?: string };
  if (!data.sessionId) throw new Error('session mint returned no sessionId');
  return data.sessionId;
}

export interface TurnResult {
  /** Resolved from the first message_appended on the SSE stream. */
  conversationId: string | undefined;
  aiTokens: number;
}

/**
 * Sends one customer turn over the widget SSE endpoint and drains the stream,
 * counting ai_token frames and capturing the conversation id. Mirrors the widget's
 * own fetch-streaming SSE parser.
 */
export async function sendTurn(
  sessionId: string,
  content: string,
  onEvent?: (event: ServerEvent) => void,
): Promise<TurnResult> {
  const res = await fetch(`${config.aiUrl}/widget/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      [EMBED_TOKEN_HEADER]: config.embedToken,
      [SESSION_HEADER]: sessionId,
      origin: config.origin,
    },
    body: JSON.stringify({ content, clientNonce: crypto.randomUUID() }),
  });
  if (!res.ok || !res.body) throw new Error(`turn failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let aiTokens = 0;
  let conversationId: string | undefined;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const event = parseFrame(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (event) {
        if (event.type === 'ai_token') aiTokens += 1;
        if (event.type === 'message_appended') conversationId = event.message.conversationId;
        onEvent?.(event);
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
  return { conversationId, aiTokens };
}

function parseFrame(frame: string): ServerEvent | undefined {
  let eventName: string | undefined;
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (eventName !== SSE_EVENT_NAME || dataLines.length === 0) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(dataLines.join('\n'));
  } catch {
    return undefined;
  }
  const parsed = serverEventSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}
