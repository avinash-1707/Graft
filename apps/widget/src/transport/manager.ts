import type { ServerEvent } from '@graft/shared';
import type { ApiConfig } from './api';
import { SseTransport } from './sse';

/**
 * TransportManager state machine (transport-architecture.md §The widget
 * TransportManager). Unit 22 implements the SSE half, so only `SSE_ACTIVE` and
 * `CLOSED` are reachable; the switching/WS/reconnecting states are scaffolded here
 * for unit 23 (WS client + silent SSE↔WS switch) to fill in.
 */
export type ManagerState =
  | 'IDLE'
  | 'SSE_ACTIVE'
  | 'SWITCHING_TO_WS'
  | 'WS_ACTIVE'
  | 'SWITCHING_TO_SSE'
  | 'RECONNECTING'
  | 'CLOSED';

export interface ConversationSnapshot {
  /** Highest sequence already known to the client; seeds the render cursor. */
  readonly lastSequence: number;
}

export type ServerEventHandler = (event: ServerEvent) => void;

/**
 * Owns the realtime transport for one conversation and presents a single ordered,
 * already-deduped event stream to the widget UI — which never touches a raw transport.
 *
 * Two invariants from the transport doc live here, not in the UI:
 *   - **Sequence is the only source of order/dedup (rule 2):** a `message_appended`
 *     renders iff its sequence exceeds `lastRenderedSeq`, which then advances. This
 *     makes loss/dup/reorder structurally impossible at the render layer and is the
 *     primitive unit 23 leans on for the SSE↔WS switch (a switch is "a reconnect that
 *     also changes endpoint").
 *   - **`ai_token` is a live partial,** not a sequenced message: it streams the AI
 *     bubble in progress and is superseded by the final deduped `message_appended`.
 */
export class TransportManager {
  private readonly sse: SseTransport;
  private readonly handlers = new Set<ServerEventHandler>();
  private lastRenderedSeq = 0;
  private _state: ManagerState = 'IDLE';
  private inflight: AbortController | undefined;

  constructor(config: ApiConfig, sessionId: string) {
    this.sse = new SseTransport(config, sessionId);
  }

  get state(): ManagerState {
    return this._state;
  }

  /** Connects for the current conversation state, seeding the cursor from the snapshot. */
  start(snapshot: ConversationSnapshot): void {
    if (this._state === 'CLOSED') return;
    this.lastRenderedSeq = Math.max(this.lastRenderedSeq, snapshot.lastSequence);
    // Unit 22 is AI mode only; WS modes arrive with unit 23.
    this._state = 'SSE_ACTIVE';
  }

  /** Subscribe to the ordered event stream. Returns an unsubscribe fn. */
  onEvent(handler: ServerEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Sends a customer message and pumps its turn stream. Resolves when the turn ends.
   * In AI mode this is the `POST /widget/messages` SSE stream; unit 23 routes to WS
   * while a human controls the conversation.
   */
  async send(content: string, clientNonce: string): Promise<void> {
    if (this._state === 'CLOSED') throw new Error('transport closed');
    const controller = new AbortController();
    this.inflight = controller;
    try {
      await this.sse.send({
        content,
        clientNonce,
        signal: controller.signal,
        onEvent: (event) => this.ingest(event),
      });
    } finally {
      if (this.inflight === controller) this.inflight = undefined;
    }
  }

  /** Idempotent teardown: aborts any in-flight turn and stops emitting. */
  stop(): void {
    this._state = 'CLOSED';
    this.inflight?.abort();
    this.inflight = undefined;
    this.handlers.clear();
  }

  /** Applies sequence dedup, then fans the event out to subscribers. */
  private ingest(event: ServerEvent): void {
    switch (event.type) {
      case 'message_appended':
        if (event.message.sequence <= this.lastRenderedSeq) return; // rule 2: drop dup
        this.lastRenderedSeq = event.message.sequence;
        break;
      case 'replay_batch': {
        // Scaffold for unit 23: re-emit only the newer messages, in order.
        for (const message of event.messages) {
          if (message.sequence <= this.lastRenderedSeq) continue;
          this.lastRenderedSeq = message.sequence;
          this.emit({ type: 'message_appended', message });
        }
        return;
      }
      default:
        // ai_token (live partial), state_changed, transport_switch, typing pass through.
        break;
    }
    this.emit(event);
  }

  private emit(event: ServerEvent): void {
    for (const handler of this.handlers) handler(event);
  }
}
