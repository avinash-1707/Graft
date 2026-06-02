import {
  EMBED_TOKEN_HEADER,
  SESSION_HEADER,
  widgetConversationResponseSchema,
  widgetSessionResponseSchema,
  type WidgetConversationResponse,
} from '@graft/shared';

/**
 * Non-streaming widget HTTP calls against the public ingress: session mint (gateway,
 * unit 07) and the conversation resume read (ai-service, unit 22). The streaming AI
 * turn lives in {@link ./sse.ts}. All calls go through one `apiBaseUrl` — the gateway
 * is the single public origin and proxies `/widget/*` to the owning service.
 */
export interface ApiConfig {
  readonly apiBaseUrl: string;
  readonly embedToken: string;
  /** Optional direct chat-service origin for the WebSocket (unit 23); defaults to `apiBaseUrl`. */
  readonly chatBaseUrl?: string;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

/**
 * Confirms (or mints) the server-side session for this org. Sends the locally-stored
 * id as a hint; the returned id is authoritative and must be adopted by the caller.
 */
export async function mintSession(config: ApiConfig, sessionIdHint: string): Promise<string> {
  const res = await fetch(joinUrl(config.apiBaseUrl, '/widget/session'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [EMBED_TOKEN_HEADER]: config.embedToken,
    },
    body: JSON.stringify({ sessionId: sessionIdHint }),
  });
  if (!res.ok) throw new Error(`session mint failed: ${res.status}`);
  return widgetSessionResponseSchema.parse(await res.json()).sessionId;
}

/** Loads the session's active conversation snapshot (state + history) for resume. */
export async function fetchConversation(
  config: ApiConfig,
  sessionId: string,
): Promise<WidgetConversationResponse> {
  const res = await fetch(joinUrl(config.apiBaseUrl, '/widget/conversation'), {
    method: 'GET',
    headers: {
      [EMBED_TOKEN_HEADER]: config.embedToken,
      [SESSION_HEADER]: sessionId,
    },
  });
  if (!res.ok) throw new Error(`conversation load failed: ${res.status}`);
  return widgetConversationResponseSchema.parse(await res.json());
}
