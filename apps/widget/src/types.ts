import type { ConversationState, MessageRole } from '@graft/shared';

/**
 * A message rendered in the widget. Mirrors the shared `Message` contract's
 * customer-facing fields. Two transient flags exist only on the client:
 * `pending` marks an optimistic customer bubble awaiting its server echo, and
 * `streaming` marks the AI bubble currently accumulating `ai_token` chunks. Both
 * clear once the authoritative `message_appended` lands.
 */
export interface WidgetMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  /** Server-assigned monotonic sequence; transient bubbles use a temporary value. */
  readonly sequence: number;
  readonly pending?: boolean;
  readonly streaming?: boolean;
}

/** Who the customer is currently talking to — drives the header status line. */
export type Responder = 'AI' | 'HUMAN';

/**
 * Connection lifecycle the composer/header surface to the customer (as plain copy,
 * never as transport internals). `offline` is the no-backend preview mode (the dev
 * harness or a misconfigured embed): the transcript works locally, sends are inert.
 */
export type ConnectionStatus = 'connecting' | 'ready' | 'sending' | 'error' | 'offline';

/** Maps a durable conversation state to the customer-facing responder. */
export function responderForState(state: ConversationState): Responder {
  return state === 'AGENT_ASSIGNED' || state === 'HUMAN_ACTIVE' ? 'HUMAN' : 'AI';
}
