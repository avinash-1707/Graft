import { WIDGET_SESSION_STORAGE_KEY } from '@graft/shared';

/**
 * The anonymous customer session UUID. Generated once and persisted in
 * `localStorage` so a returning visitor resumes the same conversation. Reads are
 * synchronous and cheap, so this never blocks the UI (code-standards: widget).
 * If `localStorage` is unavailable (private mode, blocked cookies), we fall back
 * to a per-load in-memory id rather than throwing — the widget still works, it
 * just won't resume across reloads.
 */
let inMemorySessionId: string | undefined;

function readStored(): string | undefined {
  try {
    return window.localStorage.getItem(WIDGET_SESSION_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStored(id: string): void {
  try {
    window.localStorage.setItem(WIDGET_SESSION_STORAGE_KEY, id);
  } catch {
    // Storage blocked — keep the id in memory for this page load only.
  }
}

export function getOrCreateSessionId(): string {
  const stored = readStored();
  if (stored) return stored;
  if (inMemorySessionId) return inMemorySessionId;

  const id = crypto.randomUUID();
  inMemorySessionId = id;
  writeStored(id);
  return id;
}

/**
 * Persists the server-confirmed session id. `POST /widget/session` is authoritative:
 * if the locally-generated id is unknown to the org the server mints a fresh one, and
 * we must adopt it so subsequent message/history calls carry the id the server knows.
 */
export function setSessionId(id: string): void {
  inMemorySessionId = id;
  writeStored(id);
}
