import type { ChatProvider } from '@graft/shared';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createChatModel } from './chat-model.js';
import { DEFAULT_RETRY_POLICY, withRetry, type RetryPolicy } from './generation.js';

export const sentimentLabelSchema = z.enum(['NEGATIVE', 'NEUTRAL', 'POSITIVE']);
export type SentimentLabel = z.infer<typeof sentimentLabelSchema>;
export const SentimentLabel = sentimentLabelSchema.enum;

const sentimentObjectSchema = z.object({
  label: sentimentLabelSchema,
  /** Model's confidence in the label, in [0, 1]. */
  score: z.number().min(0).max(1),
});

export interface SentimentResult {
  label: SentimentLabel;
  /** Confidence in the label, in [0, 1]. */
  score: number;
}

export interface ScoreSentimentInput {
  provider: ChatProvider;
  /** Tenant's API key for the chosen provider; decrypted in-memory at call time. */
  apiKey: string;
  /** Customer text to classify. */
  text: string;
  model?: string;
  signal?: AbortSignal;
  retry?: RetryPolicy;
}

const SENTIMENT_SYSTEM =
  'You are a sentiment classifier for customer support messages. Classify the ' +
  'overall sentiment of the customer message as NEGATIVE, NEUTRAL, or POSITIVE, ' +
  'and report your confidence in [0, 1]. Treat frustration, anger, or complaints ' +
  'as NEGATIVE. Respond only via the structured schema.';

/**
 * Scores customer-message sentiment via a structured LLM call on the tenant's own
 * chat key (the locked approach for the NEGATIVE-sentiment escalation trigger). It
 * is a SEPARATE call from the answer generation; ai-service (unit 16) runs it
 * concurrently with the streamed answer so it adds no critical-path latency, and
 * may move it to the BullMQ queue (unit 16) for retry/spend control. Uses the same
 * {@link withRetry} policy as generation; AI SDK retry is disabled here too.
 */
export async function scoreSentiment(input: ScoreSentimentInput): Promise<SentimentResult> {
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
        schema: sentimentObjectSchema,
        system: SENTIMENT_SYSTEM,
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
