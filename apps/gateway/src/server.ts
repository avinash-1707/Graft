import { createLogger, createMetrics, type Tracing } from '@graft/observability';
import { buildApp } from './app.js';
import type { GatewayEnv } from './env.js';
import { SERVICE_NAME } from './telemetry.js';

export interface StartOptions {
  env: GatewayEnv;
  tracing: Tracing;
}

/**
 * Wires logging + metrics, builds the app, starts listening, and installs
 * graceful-shutdown handlers for SIGTERM/SIGINT. On a signal the readiness probe
 * flips to 503, in-flight requests drain (bounded by SHUTDOWN_TIMEOUT_MS), then
 * the HTTP server and tracing SDK close.
 */
export async function start({ env, tracing }: StartOptions): Promise<void> {
  const logger = createLogger({
    serviceName: env.OTEL_SERVICE_NAME ?? SERVICE_NAME,
    env: env.NODE_ENV,
    level: env.LOG_LEVEL,
  });
  const metrics = createMetrics({ serviceName: env.OTEL_SERVICE_NAME ?? SERVICE_NAME });

  let ready = true;
  const app = await buildApp({ env, logger, metrics, isReady: () => ready });

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
