import multipart from '@fastify/multipart';
import { jwtAuthPlugin, type JwtVerifier } from '@graft/auth';
import type { Database } from '@graft/db';
import type { Logger, Metrics } from '@graft/observability';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import type { IngestionEnv } from './env.js';
import metricsPlugin from './plugins/metrics.js';
import type { IngestionQueue } from './queue/ingestion-queue.js';
import { healthRoutes } from './routes/health.js';
import { kbUploadRoutes } from './routes/kb-upload.js';
import { metricsRoutes } from './routes/metrics.js';
import type { Storage } from './storage/s3.js';

export interface BuildAppOptions {
  env: IngestionEnv;
  logger: Logger;
  metrics: Metrics;
  db: Database;
  storage: Storage;
  queue: IngestionQueue;
  verifier: JwtVerifier;
  /** Readiness gate; flips to false during graceful shutdown. */
  isReady: () => boolean;
}

/**
 * Builds the ingestion-service Fastify instance: observability, multipart upload,
 * JWT auth, health/metrics, and the KB upload route. Pure builder — no listening
 * or signal handling; the caller owns the lifecycle.
 */
export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { env, logger, metrics, db, storage, queue, verifier, isReady } = opts;

  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({ loggerInstance, trustProxy: true });

  await app.register(metricsPlugin, { metrics });
  await app.register(multipart, {
    limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  });

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

  await app.register(jwtAuthPlugin, { verifier });

  await app.register(healthRoutes, { isReady });
  await app.register(metricsRoutes, { metrics });
  await app.register(kbUploadRoutes, { db, storage, queue });

  return app;
}
