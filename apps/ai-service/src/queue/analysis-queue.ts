import {
  AI_ANALYSIS_JOB,
  AI_ANALYSIS_QUEUE,
  aiAnalysisResultSchema,
  type AiAnalysisJob,
  type AiAnalysisResult,
} from '@graft/shared';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import type { AiServiceEnv } from '../env.js';

export interface AnalysisQueue {
  /**
   * Enqueues the turn-classifier job and awaits its result up to `timeoutMs`
   * (B-hybrid). Returns the worker's result for the best-effort live `state_changed`
   * emit, or `undefined` on timeout/failure — the worker still owns the durable
   * transition, so a timed-out escalation surfaces on the customer's next reconnect.
   */
  enqueueAndWait(job: AiAnalysisJob, timeoutMs: number): Promise<AiAnalysisResult | undefined>;
  close(): Promise<void>;
}

/**
 * BullMQ producer for the non-streamed analysis (classifier) queue. The worker lives
 * in `worker/`. `jobId = messageId` makes a re-enqueue of the same customer turn
 * idempotent. `maxRetriesPerRequest: null` is required by BullMQ's blocking commands;
 * `QueueEvents` needs its own connection.
 */
export function createAnalysisQueue(env: AiServiceEnv): AnalysisQueue {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const eventsConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue<AiAnalysisJob, AiAnalysisResult, string>(AI_ANALYSIS_QUEUE, {
    connection,
  });
  const queueEvents = new QueueEvents(AI_ANALYSIS_QUEUE, { connection: eventsConnection });

  return {
    async enqueueAndWait(job, timeoutMs) {
      const added = await queue.add(AI_ANALYSIS_JOB, job, {
        jobId: job.messageId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      });
      try {
        const result = await added.waitUntilFinished(queueEvents, timeoutMs);
        return aiAnalysisResultSchema.parse(result);
      } catch {
        // Timeout or job failure: no live emit this turn (worker transition, if it
        // eventually succeeds, is durable and replays on reconnect).
        return undefined;
      }
    },
    async close() {
      await queueEvents.close();
      await queue.close();
      connection.disconnect();
      eventsConnection.disconnect();
    },
  };
}
