import { createEncryptor } from '@graft/crypto';
import { createDb, markKbDocumentFailed } from '@graft/db';
import { createLogger, type Tracing } from '@graft/observability';
import { KB_INGESTION_QUEUE, type KbIngestionJob } from '@graft/shared';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { IngestionEnv } from '../env.js';
import { createStorage } from '../storage/s3.js';
import { SERVICE_NAME } from '../telemetry.js';
import { createProcessor } from './processor.js';

export interface StartWorkerOptions {
  env: IngestionEnv;
  tracing: Tracing;
}

/**
 * Boots the BullMQ ingestion worker as its own process: wires DB, object storage,
 * the key decryptor, and the processor, then installs graceful shutdown. A job
 * that fails all its attempts marks the document FAILED.
 */
export async function startWorker({ env, tracing }: StartWorkerOptions): Promise<void> {
  const serviceName = `${env.OTEL_SERVICE_NAME ?? SERVICE_NAME}-worker`;
  const logger = createLogger({ serviceName, env: env.NODE_ENV, level: env.LOG_LEVEL });

  const { db, close: closeDb } = createDb({ connectionString: env.DATABASE_URL });
  const storage = createStorage(env);
  const encryptor = createEncryptor({
    keyBase64: env.AI_KEY_ENCRYPTION_KEY,
    keyId: env.AI_KEY_ENCRYPTION_KEY_ID,
  });
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const processor = createProcessor({ db, storage, encryptor, logger });
  const worker = new Worker<KbIngestionJob, void, string>(KB_INGESTION_QUEUE, processor, {
    connection,
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    logger.error(
      { err, documentId: job.data.documentId, attempt: job.attemptsMade, exhausted },
      'ingestion job failed',
    );
    if (exhausted) {
      void markKbDocumentFailed(db, job.data.documentId, err.message).catch((e: unknown) =>
        logger.error({ err: e }, 'failed to mark document FAILED'),
      );
    }
  });
  worker.on('error', (err) => logger.error({ err }, 'worker error'));

  logger.info('ingestion worker started');

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'worker shutdown initiated');

    const timer = setTimeout(() => {
      logger.error('worker shutdown timed out; forcing exit');
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    void (async () => {
      try {
        await worker.close();
        connection.disconnect();
        storage.close();
        await closeDb();
        await tracing.shutdown();
        logger.info('worker shutdown complete');
        clearTimeout(timer);
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'error during worker shutdown');
        clearTimeout(timer);
        process.exit(1);
      }
    })();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
