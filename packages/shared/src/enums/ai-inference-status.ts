import { z } from 'zod';

export const aiInferenceStatusSchema = z.enum([
  'SUCCESS',
  'PROVIDER_ERROR',
  'TIMEOUT',
  'CANCELLED',
  'RATE_LIMITED',
]);

export type AiInferenceStatus = z.infer<typeof aiInferenceStatusSchema>;
export const AiInferenceStatus = aiInferenceStatusSchema.enum;

export const AI_INFERENCE_STATUSES = aiInferenceStatusSchema.options;
