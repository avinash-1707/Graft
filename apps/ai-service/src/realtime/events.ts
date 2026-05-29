import { stateChangedEventSchema, type EscalationTrigger, type ServerEvent } from '@graft/shared';

/**
 * Builds the ESCALATION_PENDING `state_changed` server event for a conversation.
 * Parses through the shared schema so the plain `conversationId` string is branded
 * — both the request handler (inline triggers) and the analysis worker use this.
 */
export function escalationStateChangedEvent(
  conversationId: string,
  trigger: EscalationTrigger,
): ServerEvent {
  return stateChangedEventSchema.parse({
    type: 'state_changed',
    conversationId,
    state: 'ESCALATION_PENDING',
    trigger,
  });
}
