import { z } from 'zod';

export const escalationTriggerSchema = z.enum([
  'THIRD_HUMAN_REQUEST',
  'WEAK_GROUNDING',
  'MODEL_INVOKED',
  'NEGATIVE_SENTIMENT',
  'PROVIDER_FAILURE',
]);

export type EscalationTrigger = z.infer<typeof escalationTriggerSchema>;
export const EscalationTrigger = escalationTriggerSchema.enum;

export const ESCALATION_TRIGGERS = escalationTriggerSchema.options;
