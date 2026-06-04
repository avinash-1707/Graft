import { ORG_FEED_EVENT_NAME, orgFeedEventSchema, type OrgFeedEvent } from "@graft/shared";

import { CHAT_URL } from "@/lib/env";
import { clearAccessToken, getAccessToken } from "@/lib/auth/access-token";

interface ConnectParams {
  /** Receives each decoded feed event (snapshot, conversation_upsert, message). */
  onEvent: (event: OrgFeedEvent) => void;
  /** Fired once the stream is established (after headers, before the first event). */
  onOpen?: () => void;
  /** Aborts the in-flight stream (component unmount / manual reconnect). */
  signal: AbortSignal;
}

function authHeaders(token: string | null): HeadersInit {
  const headers: Record<string, string> = { accept: "text/event-stream" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  return headers;
}

/**
 * Opens the chat-service org-feed SSE (unit 27). Uses `fetch` streaming rather than
 * `EventSource` so the minted bearer JWT travels in the Authorization header (verified
 * via JWKS). On a 401 it re-mints the token once and retries. Resolves when the stream
 * ends; throws on a failed connect so the caller can back off and reconnect.
 *
 * SSE frames mirror the widget's parser: `event:`/`data:` lines separated by a blank
 * line. A malformed or unknown frame is dropped rather than tearing down the stream.
 */
export async function connectOrgFeed({ onEvent, onOpen, signal }: ConnectParams): Promise<void> {
  const url = `${CHAT_URL}/org/feed`;

  let token = await getAccessToken();
  let res = await fetch(url, { headers: authHeaders(token), signal });
  if (res.status === 401) {
    clearAccessToken();
    token = await getAccessToken(true);
    res = await fetch(url, { headers: authHeaders(token), signal });
  }
  if (!res.ok || !res.body) throw new Error(`feed connect failed: ${res.status}`);
  onOpen?.();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        dispatchFrame(buffer.slice(0, boundary), onEvent);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function dispatchFrame(frame: string, onEvent: (event: OrgFeedEvent) => void): void {
  let eventName: string | undefined;
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (eventName !== ORG_FEED_EVENT_NAME || dataLines.length === 0) return;

  let json: unknown;
  try {
    json = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }
  const parsed = orgFeedEventSchema.safeParse(json);
  if (parsed.success) onEvent(parsed.data);
}
