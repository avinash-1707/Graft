import { z } from 'zod';
import {
  DEFAULT_GROUNDING_THRESHOLD,
  DEFAULT_HUMAN_REQUEST_CONFIDENCE_THRESHOLD,
  DEFAULT_HUMAN_REQUEST_COUNT_TO_ESCALATE,
  DEFAULT_NEGATIVE_SENTIMENT_THRESHOLD,
} from '../constants.js';

export const groundingThresholdSchema = z.number().min(0).max(1);
/** Generic [0,1] classifier confidence threshold (sentiment / human-request). */
export const confidenceThresholdSchema = z.number().min(0).max(1);

export const escalationConfigSchema = z.object({
  thirdHumanRequestEnabled: z.boolean(),
  /** Number of explicit human requests that forces escalation. */
  humanRequestCountToEscalate: z.number().int().min(1).max(10),
  /** Min classifier confidence for a detected human request to count. */
  humanRequestConfidenceThreshold: confidenceThresholdSchema,
  weakGroundingEnabled: z.boolean(),
  weakGroundingThreshold: groundingThresholdSchema,
  modelInvokedEnabled: z.boolean(),
  negativeSentimentEnabled: z.boolean(),
  /** Min classifier confidence for a NEGATIVE label to escalate. */
  negativeSentimentThreshold: confidenceThresholdSchema,
  providerFailureEnabled: z.boolean(),
});

export type EscalationConfig = z.infer<typeof escalationConfigSchema>;

/** Effective config returned before a tenant customizes escalation. Mirrors the DB column defaults. */
export const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
  thirdHumanRequestEnabled: true,
  humanRequestCountToEscalate: DEFAULT_HUMAN_REQUEST_COUNT_TO_ESCALATE,
  humanRequestConfidenceThreshold: DEFAULT_HUMAN_REQUEST_CONFIDENCE_THRESHOLD,
  weakGroundingEnabled: true,
  weakGroundingThreshold: DEFAULT_GROUNDING_THRESHOLD,
  modelInvokedEnabled: true,
  negativeSentimentEnabled: false,
  negativeSentimentThreshold: DEFAULT_NEGATIVE_SENTIMENT_THRESHOLD,
  providerFailureEnabled: true,
};
