import { type JwtVerifyConfig } from '@graft/auth';
import { createEncryptor } from '@graft/crypto';
import { createDb } from '@graft/db';
import { createLogger, createMetrics, type Tracing } from '@graft/observability';
import { AnswerService } from './ai/answer-service.js';
import { buildApp } from './app.js';
import { ConversationService } from './conversation/service.js';
import type { AiServiceEnv } from './env.js';
import { EscalationService } from './escalation/service.js';
import { createAnalysisQueue } from './queue/analysis-queue.js';
import { SERVICE_NAME } from './telemetry.js';

export interface StartOptions {
  env: AiServiceEnv;
  tracing: Tracing;
}

/**
 * Wires logging, metrics, the database, and the conversation service; builds the
 * app, listens, and installs graceful-shutdown handlers. On SIGTERM/SIGINT the
 * readiness probe flips to 503, in-flight requests drain (bounded by
 * SHUTDOWN_TIMEOUT_MS), then the server, DB, and tracing close.
 */
export async function start({ env, tracing }: StartOptions): Promise<void> {
  const serviceName = env.OTEL_SERVICE_NAME ?? SERVICE_NAME;
  const logger = createLogger({ serviceName, env: env.NODE_ENV, level: env.LOG_LEVEL });
  const metrics = createMetrics({ serviceName });

  const { db, close: closeDb } = createDb({ connectionString: env.DATABASE_URL });
  const conversations = new ConversationService(db);
  const encryptor = createEncryptor({
    keyBase64: env.AI_KEY_ENCRYPTION_KEY,
    keyId: env.AI_KEY_ENCRYPTION_KEY_ID,
  });
  const escalation = new EscalationService(db, metrics);
  const analysisQueue = createAnalysisQueue(env);
  const answerService = new AnswerService({
    db,
    encryptor,
    conversations,
    escalation,
    analysisQueue,
    topK: env.RETRIEVAL_TOP_K,
    analysisWaitTimeoutMs: env.ANALYSIS_WAIT_TIMEOUT_MS,
  });
  const jwtConfig: JwtVerifyConfig = { secret: env.JWT_SECRET, issuer: env.JWT_ISSUER };

  let ready = true;
  const app = await buildApp({
    logger,
    metrics,
    db,
    conversations,
    answerService,
    jwtConfig,
    isReady: () => ready,
  });

  await app.listen({ host: env.HOST, port: env.PORT });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    ready = false;
    logger.info({ signal }, 'shutdown initiated');

    const timer = setTimeout(() => {
      logger.error('shutdown timed out; forcing exit');
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    void (async () => {
      try {
        await app.close();
        await analysisQueue.close();
        await closeDb();
        await tracing.shutdown();
        logger.info('shutdown complete');
        clearTimeout(timer);
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'error during shutdown');
        clearTimeout(timer);
        process.exit(1);
      }
    })();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
