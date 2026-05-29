import { classifyTurn } from '@graft/ai';
import type { Encryptor } from '@graft/crypto';
import {
  getEscalationConfig,
  incrementHumanRequestCount,
  type Database,
} from '@graft/db';
import { resolveChatModel } from '@graft/keyring';
import {
  aiAnalysisJobSchema,
  DEFAULT_ESCALATION_CONFIG,
  EscalationTrigger,
  type AiAnalysisJob,
  type AiAnalysisResult,
} from '@graft/shared';
import type { Job } from 'bullmq';
import type { EscalationService } from '../escalation/service.js';
import { isHumanRequest, isNegativeSentiment } from '../escalation/triggers.js';

export interface AnalysisProcessorDeps {
  db: Database;
  encryptor: Encryptor;
  escalation: EscalationService;
}

/**
 * Processes one turn-classifier job: resolve the tenant chat key, run the combined
 * classifier, then evaluate the two classifier-driven escalation triggers against
 * the tenant config. THIRD_HUMAN_REQUEST takes priority over NEGATIVE_SENTIMENT (an
 * explicit ask beats inferred mood). The worker owns the durable transition; it
 * returns whether it escalated + which trigger for the handler's live emit.
 *
 * Idempotency note: a BullMQ retry re-runs this. `incrementHumanRequestCount` is the
 * only side effect that is not naturally idempotent — a retried job after a partial
 * failure could double-count. Acceptable for a soft escalation signal; the count is
 * not a hard ledger.
 */
export async function processAnalysisJob(
  deps: AnalysisProcessorDeps,
  job: Job<AiAnalysisJob, AiAnalysisResult>,
): Promise<AiAnalysisResult> {
  const data = aiAnalysisJobSchema.parse(job.data);
  const config = (await getEscalationConfig(deps.db, data.organizationId)) ?? DEFAULT_ESCALATION_CONFIG;

  // No classifier-driven trigger enabled → skip the LLM call entirely.
  if (!config.thirdHumanRequestEnabled && !config.negativeSentimentEnabled) {
    return { escalated: false, trigger: null };
  }

  const { provider, apiKey } = await resolveChatModel(deps.db, deps.encryptor, data.organizationId);
  const classification = await classifyTurn({ provider, apiKey, text: data.text });

  let trigger: EscalationTrigger | null = null;

  if (config.thirdHumanRequestEnabled && isHumanRequest(classification, config.humanRequestConfidenceThreshold)) {
    const newCount = await incrementHumanRequestCount(deps.db, data.conversationId, data.organizationId);
    if (newCount !== undefined && newCount >= config.humanRequestCountToEscalate) {
      trigger = EscalationTrigger.THIRD_HUMAN_REQUEST;
    }
  }

  if (
    trigger === null &&
    config.negativeSentimentEnabled &&
    isNegativeSentiment(classification, config.negativeSentimentThreshold)
  ) {
    trigger = EscalationTrigger.NEGATIVE_SENTIMENT;
  }

  if (trigger === null) return { escalated: false, trigger: null };

  const { transitioned } = await deps.escalation.escalate({
    organizationId: data.organizationId,
    conversationId: data.conversationId,
    trigger,
  });
  return { escalated: transitioned, trigger };
}
