import { z } from 'zod';
import {
  DEFAULT_GROUNDING_THRESHOLD,
  DEFAULT_HUMAN_REQUEST_COUNT_TO_ESCALATE,
} from '../constants.js';

export const groundingThresholdSchema = z.number().min(0).max(1);

export const escalationConfigSchema = z.object({
  thirdHumanRequestEnabled: z.boolean(),
  /** Number of explicit human requests that forces escalation. */
  humanRequestCountToEscalate: z.number().int().min(1).max(10),
  weakGroundingEnabled: z.boolean(),
  weakGroundingThreshold: groundingThresholdSchema,
  modelInvokedEnabled: z.boolean(),
  negativeSentimentEnabled: z.boolean(),
  providerFailureEnabled: z.boolean(),
});

export type EscalationConfig = z.infer<typeof escalationConfigSchema>;

/** Effective config returned before a tenant customizes escalation. Mirrors the DB column defaults. */
export const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
  thirdHumanRequestEnabled: true,
  humanRequestCountToEscalate: DEFAULT_HUMAN_REQUEST_COUNT_TO_ESCALATE,
  weakGroundingEnabled: true,
  weakGroundingThreshold: DEFAULT_GROUNDING_THRESHOLD,
  modelInvokedEnabled: true,
  negativeSentimentEnabled: false,
  providerFailureEnabled: true,
};
