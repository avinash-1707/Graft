import type { Logger, Metrics } from '@graft/observability';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import metricsPlugin from './plugins/metrics.js';
import { healthRoutes } from './routes/health.js';
import { metricsRoutes } from './routes/metrics.js';

export interface BuildAppOptions {
  logger: Logger;
  metrics: Metrics;
  /** Readiness gate; flips to false during graceful shutdown. */
  isReady: () => boolean;
}

/**
 * Builds the chat-service Fastify instance: observability, a stable error shape, and
 * health/metrics. Socket.IO is attached to this instance's underlying HTTP server by
 * the caller (server.ts). Pure builder — no listening or signal handling.
 */
export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { logger, metrics, isReady } = opts;

  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({ loggerInstance, trustProxy: true });

  await app.register(metricsPlugin, { metrics });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'request failed');
    }
    reply.code(status).send({
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: status >= 500 ? 'Internal server error.' : error.message,
      },
    });
  });

  await app.register(healthRoutes, { isReady });
  await app.register(metricsRoutes, { metrics });

  return app;
}
