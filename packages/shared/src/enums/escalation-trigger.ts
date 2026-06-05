import { z } from 'zod';

export const escalationTriggerSchema = z.enum([
  'THIRD_HUMAN_REQUEST',
  'WEAK_GROUNDING',
  'MODEL_INVOKED',
  'NEGATIVE_SENTIMENT',
  'PROVIDER_FAILURE',
  /** Credits org ran out of prepaid balance: hand off to a human instead of spending. */
  'INSUFFICIENT_CREDITS',
]);

export type EscalationTrigger = z.infer<typeof escalationTriggerSchema>;
export const EscalationTrigger = escalationTriggerSchema.enum;

export const ESCALATION_TRIGGERS = escalationTriggerSchema.options;
