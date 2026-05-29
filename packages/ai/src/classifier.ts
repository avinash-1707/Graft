import type { ChatProvider } from '@graft/shared';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createChatModel } from './chat-model.js';
import { DEFAULT_RETRY_POLICY, withRetry, type RetryPolicy } from './generation.js';

export const sentimentLabelSchema = z.enum(['NEGATIVE', 'NEUTRAL', 'POSITIVE']);
export type SentimentLabel = z.infer<typeof sentimentLabelSchema>;
export const SentimentLabel = sentimentLabelSchema.enum;

/**
 * Single structured classification of one customer message, covering the two
 * inferred escalation signals at once (one LLM call instead of two): sentiment and
 * whether the customer is asking for a human. Each carries a [0,1] confidence so
 * ai-service can gate on a per-tenant threshold (`negativeSentimentThreshold`,
 * `humanRequestConfidenceThreshold`).
 */
const turnClassificationSchema = z.object({
  sentiment: z.object({
    label: sentimentLabelSchema,
    /** Confidence in the sentiment label, in [0, 1]. */
    score: z.number().min(0).max(1),
  }),
  humanRequest: z.object({
    /** True when the customer is explicitly asking to talk to a human/agent. */
    requested: z.boolean(),
    /** Confidence in the human-request judgement, in [0, 1]. */
    score: z.number().min(0).max(1),
  }),
});

export type TurnClassification = z.infer<typeof turnClassificationSchema>;

export interface ClassifyTurnInput {
  provider: ChatProvider;
  /** Tenant's API key for the chosen provider; decrypted in-memory at call time. */
  apiKey: string;
  /** Customer text to classify. */
  text: string;
  model?: string;
  signal?: AbortSignal;
  retry?: RetryPolicy;
}

const CLASSIFIER_SYSTEM =
  'You classify a single customer support message. Report two things via the ' +
  'structured schema: (1) overall sentiment as NEGATIVE, NEUTRAL, or POSITIVE with ' +
  'your confidence in [0,1] — treat frustration, anger, or complaints as NEGATIVE; ' +
  '(2) whether the customer is explicitly asking to talk to a human or live agent, ' +
  'with your confidence in [0,1]. Respond only via the structured schema.';

/**
 * Runs the combined turn classifier (sentiment + human-request) as a SEPARATE,
 * non-streamed LLM call on the tenant's chat key. ai-service runs this on the
 * BullMQ analysis queue (retry + parallel) concurrently with the streamed answer;
 * the escalation engine (unit 17) gates each signal on the tenant's thresholds.
 * Uses the same {@link withRetry} policy as generation; AI SDK retry is disabled.
 */
export async function classifyTurn(input: ClassifyTurnInput): Promise<TurnClassification> {
  const model = createChatModel({
    provider: input.provider,
    apiKey: input.apiKey,
    ...(input.model ? { model: input.model } : {}),
  });
  const policy = input.retry ?? DEFAULT_RETRY_POLICY;

  return withRetry(
    async (signal) => {
      const { object } = await generateObject({
        model,
        schema: turnClassificationSchema,
        system: CLASSIFIER_SYSTEM,
        prompt: input.text,
        abortSignal: signal,
        maxRetries: 0,
      });
      return object;
    },
    policy,
    input.signal,
  );
}
