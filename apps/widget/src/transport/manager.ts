import type { ConversationState, ServerEvent } from '@graft/shared';
import type { ApiConfig } from './api';
import { SseTransport } from './sse';
import { WsTransport } from './ws';

/**
 * TransportManager state machine (transport-architecture.md §The widget
 * TransportManager). All seven states are now reachable: SSE carries the AI turn,
 * the WS carries human chat, and the SWITCHING_* states bracket the silent SSE↔WS
 * switch.
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
  /** The resumed conversation id, or null for a fresh session with no open conversation. */
  readonly conversationId: string | null;
  /** Durable conversation state — the switch follows this, never a live event alone (rule 3). */
  readonly state: ConversationState;
  /** Highest sequence already known to the client; seeds the render cursor. */
  readonly lastSequence: number;
}

export type ServerEventHandler = (event: ServerEvent) => void;

/**
 * States in which a WebSocket to chat-service must be live. The WS is opened at
 * ESCALATION_PENDING — before a human controls the conversation — so the customer is
 * already in the room (make-before-break, rule 1) when the agent's first message lands.
 */
function wantsWebSocket(state: ConversationState): boolean {
  return state === 'ESCALATION_PENDING' || state === 'AGENT_ASSIGNED' || state === 'HUMAN_ACTIVE';
}

/** States in which a human controls the conversation, so customer sends go over the WS. */
function humanControls(state: ConversationState): boolean {
  return state === 'AGENT_ASSIGNED' || state === 'HUMAN_ACTIVE';
}

/**
 * Owns the realtime transport for one conversation and presents a single ordered,
 * already-deduped event stream to the widget UI — which never touches a raw transport.
 *
 * The switch's fragility is concentrated here (transport-architecture.md §five rules):
 *   - **Sequence is the only source of order/dedup (rule 2):** a `message_appended`
 *     renders iff its sequence exceeds `lastRenderedSeq`. Loss/dup/reorder are
 *     structurally impossible at the render layer, so the brief make-before-break
 *     overlap (both transports live) is harmless.
 *   - **Make-before-break (rule 1):** {@link activateWs} stands up + joins + drains the
 *     WS before the SSE turn is dropped; the SSE turn is left to finish on its own.
 *   - **State-driven (rule 3):** the transport is reconciled from the durable
 *     conversation state, not from catching one live `state_changed`. A missed live
 *     event is recovered on the next event/reconnect, which replays from the cursor.
 *   - **Idempotent reconnect = one path (rule 4):** first connect, a blip, and the
 *     switch all run `join(lastSeq) → replay_batch → resume` — owned by {@link WsTransport}.
 *   - **`ai_token` is a live partial,** superseded by the final deduped `message_appended`.
 */
export class TransportManager {
  private readonly sse: SseTransport;
  private readonly handlers = new Set<ServerEventHandler>();

  private lastRenderedSeq = 0;
  private _state: ManagerState = 'IDLE';
  private conversationId: string | null = null;
  private conversationState: ConversationState = 'AI_ACTIVE';
  private sseInflight: AbortController | undefined;
  /** Set as soon as a WS exists (connecting or open) so a handback can cancel a pending connect. */
  private ws: WsTransport | undefined;
  /** True only once the WS is connected, joined, and replay-drained. */
  private wsOpen = false;

  constructor(
    private readonly config: ApiConfig,
    private readonly sessionId: string,
  ) {
    this.sse = new SseTransport(config, sessionId);
  }

  get state(): ManagerState {
    return this._state;
  }

  /** Connects for the current conversation state, seeding the cursor from the snapshot. */
  start(snapshot: ConversationSnapshot): void {
    if (this._state === 'CLOSED') return;
    this.lastRenderedSeq = Math.max(this.lastRenderedSeq, snapshot.lastSequence);
    this.conversationId = snapshot.conversationId;
    this.conversationState = snapshot.state;
    if (this._state === 'IDLE') this._state = 'SSE_ACTIVE';
    // Resume directly onto the WS if the conversation is already in (or heading into) human control.
    this.reconcileTransport();
  }

  /** Subscribe to the ordered event stream. Returns an unsubscribe fn. */
  onEvent(handler: ServerEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Sends a customer message and pumps its turn. While a human controls the
   * conversation it emits over the live WS (resolves on the persisted-row ack); otherwise
   * it opens a fresh `POST /widget/messages` SSE turn (AI mode).
   */
  async send(content: string, clientNonce: string): Promise<void> {
    if (this._state === 'CLOSED') throw new Error('transport closed');

    if (humanControls(this.conversationState)) {
      if (!this.ws || !this.wsOpen) throw new Error('connecting to agent');
      await this.ws.send(content, clientNonce);
      return;
    }

    const controller = new AbortController();
    this.sseInflight = controller;
    try {
      await this.sse.send({
        content,
        clientNonce,
        signal: controller.signal,
        onEvent: (event) => this.ingest(event),
      });
    } finally {
      if (this.sseInflight === controller) this.sseInflight = undefined;
    }
  }

  /** Idempotent teardown: aborts any in-flight turn, drops the WS, and stops emitting. */
  stop(): void {
    this._state = 'CLOSED';
    this.sseInflight?.abort();
    this.sseInflight = undefined;
    this.ws?.disconnect();
    this.ws = undefined;
    this.wsOpen = false;
    this.handlers.clear();
  }

  /** Applies sequence dedup, drives the transport switch, then fans the event out. */
  private ingest(event: ServerEvent): void {
    this.learnConversationId(event);

    switch (event.type) {
      case 'message_appended':
        if (event.message.sequence <= this.lastRenderedSeq) return; // rule 2: drop dup
        this.lastRenderedSeq = event.message.sequence;
        break;
      case 'replay_batch': {
        // Re-emit only the newer messages, in order (rule 2 advances the cursor per message).
        for (const message of event.messages) {
          if (message.sequence <= this.lastRenderedSeq) continue;
          this.lastRenderedSeq = message.sequence;
          this.emit({ type: 'message_appended', message });
        }
        return;
      }
      case 'state_changed':
        this.conversationState = event.state;
        this.emit(event);
        this.reconcileTransport(); // open/close the WS off the durable state (rule 3)
        return;
      case 'transport_switch':
        // The explicit switch signal; reconcile again in case the `state_changed` was missed.
        this.emit(event);
        this.reconcileTransport();
        return;
      default:
        // ai_token (live partial) and typing pass straight through.
        break;
    }
    this.emit(event);
  }

  /**
   * A fresh session has no conversation id until its first turn persists one. Learn it
   * from any event that carries it so the WS can be opened the moment escalation fires.
   */
  private learnConversationId(event: ServerEvent): void {
    if (this.conversationId !== null) return;
    this.conversationId =
      event.type === 'message_appended' ? event.message.conversationId : event.conversationId;
  }

  /** Opens or tears down the WS to match the durable conversation state (rule 3). */
  private reconcileTransport(): void {
    if (this._state === 'CLOSED') return;
    const wantWs = this.conversationId !== null && wantsWebSocket(this.conversationState);
    if (wantWs) {
      if (!this.ws) void this.activateWs();
    } else if (this.ws) {
      this.activateSse();
    } else if (this._state === 'IDLE') {
      this._state = 'SSE_ACTIVE';
    }
  }

  /** Make-before-break: stand up + join + drain the WS before relying on it (rule 1). */
  private async activateWs(): Promise<void> {
    const conversationId = this.conversationId;
    if (conversationId === null || this.ws) return;

    this._state = 'SWITCHING_TO_WS';
    const ws = new WsTransport({
      config: this.config,
      sessionId: this.sessionId,
      conversationId,
      getLastSequence: () => this.lastRenderedSeq,
      onEvent: (event) => this.ingest(event),
    });
    this.ws = ws; // track immediately so a concurrent handback can cancel this pending connect

    try {
      await ws.connect();
      // `stop()`/a handback may have run during the await; bail if we're no longer the WS.
      if (this.isClosed() || this.ws !== ws) {
        ws.disconnect();
        return;
      }
      this.wsOpen = true;
      this._state = 'WS_ACTIVE';
      // The old SSE turn (if any) is left to finish on its own; rule 2 dedups the overlap.
    } catch {
      if (this.ws === ws) {
        this.ws = undefined;
        this.wsOpen = false;
        if (!this.isClosed()) this._state = 'SSE_ACTIVE';
      }
      ws.disconnect();
      // The next state_changed (e.g. AGENT_ASSIGNED → HUMAN_ACTIVE) retries the switch (rule 3).
    }
  }

  /** Reads the state fresh (avoids literal narrowing from the in-method assignment across `await`). */
  private isClosed(): boolean {
    return this._state === 'CLOSED';
  }

  /** Tears the WS down and returns to the per-turn SSE path (handback, or resume into AI). */
  private activateSse(): void {
    if (this.ws) {
      this._state = 'SWITCHING_TO_SSE';
      this.ws.disconnect();
      this.ws = undefined;
      this.wsOpen = false;
    }
    if (this._state !== 'CLOSED') this._state = 'SSE_ACTIVE';
  }

  private emit(event: ServerEvent): void {
    for (const handler of this.handlers) handler(event);
  }
}
