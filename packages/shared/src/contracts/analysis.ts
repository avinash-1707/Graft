import { z } from 'zod';
import { escalationTriggerSchema } from '../enums/escalation-trigger.js';
import { uuidSchema } from './ids.js';

/** BullMQ queue + job names for the non-streamed turn classifier (sentiment + human-request). */
export const AI_ANALYSIS_QUEUE = 'ai-analysis' as const;
export const AI_ANALYSIS_JOB = 'classify-turn' as const;

/**
 * Payload enqueued per AI_ACTIVE turn and consumed by the ai-service analysis worker
 * (unit 17). The worker resolves the tenant chat key, runs the combined classifier
 * (sentiment + human-request), then evaluates + applies the NEGATIVE_SENTIMENT /
 * THIRD_HUMAN_REQUEST escalation triggers. The provider key is NEVER on the job —
 * the worker decrypts it in-memory at run time. Runs on the queue for retry +
 * parallel processing, concurrently with the streamed answer.
 */
export const aiAnalysisJobSchema = z.object({
  organizationId: uuidSchema,
  conversationId: uuidSchema,
  /** The customer message being classified (for correlation / idempotent jobId). */
  messageId: uuidSchema,
  text: z.string().min(1).max(8000),
});
export type AiAnalysisJob = z.infer<typeof aiAnalysisJobSchema>;

/**
 * The worker's job return value, awaited by the producing request (B-hybrid): the
 * worker owns the DURABLE transition; the handler uses this only for the best-effort
 * live `state_changed` emit on the SSE it holds.
 */
export const aiAnalysisResultSchema = z.object({
  escalated: z.boolean(),
  trigger: escalationTriggerSchema.nullable(),
});
export type AiAnalysisResult = z.infer<typeof aiAnalysisResultSchema>;
