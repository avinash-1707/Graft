import type { AiInferenceInsert } from '@graft/shared';
import { aiInferences } from '../schema/ai-inferences.js';
import type { Database } from '../client.js';

export async function insertAiInference(db: Database, record: AiInferenceInsert): Promise<void> {
  await db.insert(aiInferences).values({
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
  });
}
