import type { AiInferenceInsert } from '@graft/shared';
import { aiInferences } from '../schema/ai-inferences.js';
import type { Database } from '../client.js';

/**
 * Inserts one inference row. An explicit `id` may be supplied so the caller can reference
 * it (e.g. as the idempotency source for a credit debit) before the write; omit it to let
 * the DB generate one.
 */
export async function insertAiInference(
  db: Database,
  record: AiInferenceInsert,
  id?: string,
): Promise<void> {
  await db.insert(aiInferences).values({
    ...(id ? { id } : {}),
    organizationId: record.organizationId,
    conversationId: record.conversationId,
    messageId: record.messageId,
    provider: record.provider,
    model: record.model,
    status: record.status,
    latencyMs: record.latencyMs,
    promptTokens: record.promptTokens,
    completionTokens: record.completionTokens,
    finishReason: record.finishReason,
    errorCode: record.errorCode,
    groundingScore: record.groundingScore,
    retrievedChunksCount: record.retrievedChunksCount,
    escalated: record.escalated,
    escalationTrigger: record.escalationTrigger,
    costMicroUsd: record.costMicroUsd,
    chargedMicroUsd: record.chargedMicroUsd,
  });
}
