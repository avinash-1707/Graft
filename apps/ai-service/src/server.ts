import { createDb } from '@graft/db';
import { createLogger, createMetrics, type Tracing } from '@graft/observability';
import { buildApp } from './app.js';
import { ConversationService } from './conversation/service.js';
import type { AiServiceEnv } from './env.js';
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

  let ready = true;
  const app = await buildApp({ logger, metrics, conversations, isReady: () => ready });

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
