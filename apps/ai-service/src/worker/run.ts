import { createEncryptor } from '@graft/crypto';
import { createDb } from '@graft/db';
import { createLogger, createMetrics, type Tracing } from '@graft/observability';
import { AI_ANALYSIS_QUEUE, type AiAnalysisJob, type AiAnalysisResult } from '@graft/shared';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { AiServiceEnv } from '../env.js';
import { EscalationService } from '../escalation/service.js';
import { createEventBus } from '../realtime/event-bus.js';
import { SERVICE_NAME } from '../telemetry.js';
import { processAnalysisJob } from './analysis-processor.js';
import { startBillingScheduler } from './billing-jobs.js';

export interface StartWorkerOptions {
  env: AiServiceEnv;
  tracing: Tracing;
}

/**
 * Boots the BullMQ analysis worker as its own process: wires DB, the key decryptor,
 * metrics, and the escalation service, then installs graceful shutdown. The worker
 * runs the turn classifier and owns the durable escalation transition for the
 * classifier-driven triggers. A job that fails all attempts simply yields no
 * escalation this turn (logged) — the answer the customer already received stands.
 */
export async function startWorker({ env, tracing }: StartWorkerOptions): Promise<void> {
  const serviceName = `${env.OTEL_SERVICE_NAME ?? SERVICE_NAME}-worker`;
  const logger = createLogger({ serviceName, env: env.NODE_ENV, level: env.LOG_LEVEL });
  const metrics = createMetrics({ serviceName });

  const { db, close: closeDb } = createDb({ connectionString: env.DATABASE_URL });
  const encryptor = createEncryptor({
    keyBase64: env.AI_KEY_ENCRYPTION_KEY,
    keyId: env.AI_KEY_ENCRYPTION_KEY_ID,
  });
  // Publish-only bus: the worker holds no SSE, so it never subscribes — it just
  // publishes the escalation `state_changed` for the HTTP instance to deliver.
  const bus = createEventBus(env.REDIS_URL, logger);
  const escalation = new EscalationService(db, metrics, bus);
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker<AiAnalysisJob, AiAnalysisResult, string>(
    AI_ANALYSIS_QUEUE,
    (job) =>
      processAnalysisJob(
        { db, encryptor, escalation, platformOpenRouterApiKey: env.PLATFORM_OPENROUTER_API_KEY },
        job,
      ),
    { connection, concurrency: env.ANALYSIS_WORKER_CONCURRENCY },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { err, conversationId: job?.data.conversationId, attempt: job?.attemptsMade },
      'analysis job failed',
    );
  });
  worker.on('error', (err) => logger.error({ err }, 'worker error'));

  // Billing background jobs (pricing refresh + free-tier monthly grants) share this process.
  const billingConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const billing = await startBillingScheduler({ db, connection: billingConnection, logger });

  logger.info({ concurrency: env.ANALYSIS_WORKER_CONCURRENCY }, 'analysis worker started');

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
        await billing.close();
        billingConnection.disconnect();
        connection.disconnect();
        await bus.close();
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
