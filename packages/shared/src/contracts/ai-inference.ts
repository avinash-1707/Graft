import { z } from 'zod';
import { aiProviderSchema } from '../enums/ai-provider.js';
import { aiInferenceStatusSchema } from '../enums/ai-inference-status.js';
import { escalationTriggerSchema } from '../enums/escalation-trigger.js';
import { conversationIdSchema, messageIdSchema, organizationIdSchema, uuidSchema } from './ids.js';

export const aiInferenceIdSchema = uuidSchema.brand<'AiInferenceId'>();
export type AiInferenceId = z.infer<typeof aiInferenceIdSchema>;

export const aiInferenceSchema = z.object({
  id: aiInferenceIdSchema,
  organizationId: organizationIdSchema,
  conversationId: conversationIdSchema,
  messageId: messageIdSchema.nullable(),
  provider: aiProviderSchema,
  model: z.string().min(1).max(128),
  status: aiInferenceStatusSchema,
  latencyMs: z.int().nonnegative(),
  promptTokens: z.int().nonnegative().nullable(),
  completionTokens: z.int().nonnegative().nullable(),
  finishReason: z.string().min(1).max(64).nullable(),
  errorCode: z.string().min(1).max(128).nullable(),
  groundingScore: z.number().min(0).max(1).nullable(),
  retrievedChunksCount: z.int().nonnegative().nullable(),
  escalated: z.boolean(),
  escalationTrigger: escalationTriggerSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type AiInference = z.infer<typeof aiInferenceSchema>;

export const aiInferenceInsertSchema = aiInferenceSchema.omit({
  id: true,
  createdAt: true,
});
export type AiInferenceInsert = z.infer<typeof aiInferenceInsertSchema>;

export const aiMetricsBucket15mSchema = z.object({
  organizationId: organizationIdSchema,
  bucketStart: z.iso.datetime(),
  provider: aiProviderSchema,
  model: z.string().min(1).max(128),
  requestCount: z.int().nonnegative(),
  successCount: z.int().nonnegative(),
  errorCount: z.int().nonnegative(),
  cancelledCount: z.int().nonnegative(),
  escalationCount: z.int().nonnegative(),
  latencyP50Ms: z.int().nonnegative(),
  latencyP95Ms: z.int().nonnegative(),
  latencySumMs: z.int().nonnegative(),
  totalPromptTokens: z.int().nonnegative(),
  totalCompletionTokens: z.int().nonnegative(),
  groundingScoreSum: z.number(),
  groundingScoreCount: z.int().nonnegative(),
  computedAt: z.iso.datetime(),
});
export type AiMetricsBucket15m = z.infer<typeof aiMetricsBucket15mSchema>;

export const aiMetricsBucketDailySchema = aiMetricsBucket15mSchema;
export type AiMetricsBucketDaily = z.infer<typeof aiMetricsBucketDailySchema>;

export const AI_METRICS_WINDOWS = ['24h', '7d', '30d', '90d'] as const;
export const aiMetricsWindowSchema = z.enum(AI_METRICS_WINDOWS);
export type AiMetricsWindow = z.infer<typeof aiMetricsWindowSchema>;
