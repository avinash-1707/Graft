import type { ServerEvent } from '@graft/shared';

/** A locally-held customer SSE connection for one conversation turn. */
export interface SseConnection {
  /** Writes a server event to this connection's SSE stream. */
  write(event: ServerEvent): void;
  /** Aborts the in-flight generation feeding this connection (invariant 12). */
  abort(): void;
}

/**
 * In-process map of `conversationId → live SSE connections` this instance holds.
 * The Redis Pub/Sub subscriber dispatches incoming realtime messages here, so an
 * event published by any process (the analysis worker, another HTTP instance, a
 * future agent-takeover) is delivered to — or aborts — the connection wherever it
 * actually lives. Purely local state; nothing here is durable.
 */
export class ConnectionRegistry {
  private readonly byConversation = new Map<string, Set<SseConnection>>();

  register(conversationId: string, conn: SseConnection): void {
    let set = this.byConversation.get(conversationId);
    if (!set) {
      set = new Set();
      this.byConversation.set(conversationId, set);
    }
    set.add(conn);
  }

  unregister(conversationId: string, conn: SseConnection): void {
    const set = this.byConversation.get(conversationId);
    if (!set) return;
    set.delete(conn);
    if (set.size === 0) this.byConversation.delete(conversationId);
  }

  /** Delivers an event to every local connection for the conversation (no-op if none). */
  deliver(conversationId: string, event: ServerEvent): void {
    const set = this.byConversation.get(conversationId);
    if (!set) return;
    for (const conn of set) conn.write(event);
  }

  /** Aborts in-flight generation for every local connection for the conversation. */
  abort(conversationId: string): void {
    const set = this.byConversation.get(conversationId);
    if (!set) return;
    for (const conn of set) conn.abort();
  }
}
