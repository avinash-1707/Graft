import { KB_INGESTION_JOB, KB_INGESTION_QUEUE, type KbIngestionJob } from '@graft/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type { IngestionEnv } from '../env.js';

export interface IngestionQueue {
  /** Enqueues a document for processing; the job id is the documentId (idempotent). */
  enqueue(job: KbIngestionJob): Promise<void>;
  close(): Promise<void>;
}

/**
 * BullMQ producer for the KB ingestion queue. The worker lives in unit 13.
 * `maxRetriesPerRequest: null` is required by BullMQ for its blocking commands.
 * The job id is the documentId so re-enqueuing the same document is idempotent.
 */
export function createIngestionQueue(env: IngestionEnv): IngestionQueue {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue<KbIngestionJob, void, string>(KB_INGESTION_QUEUE, { connection });

  return {
    async enqueue(job) {
      await queue.add(KB_INGESTION_JOB, job, {
        jobId: job.documentId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      });
    },
    async close() {
      await queue.close();
      connection.disconnect();
    },
  };
}
