import cors from '@fastify/cors';
import { jwtAuthPlugin, type JwtVerifier } from '@graft/auth';
import type { Database } from '@graft/db';
import type { Logger, Metrics } from '@graft/observability';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import metricsPlugin from './plugins/metrics.js';
import type { OrgFeedHub } from './realtime/org-feed.js';
import { healthRoutes } from './routes/health.js';
import { metricsRoutes } from './routes/metrics.js';
import { notesRoutes } from './routes/notes.js';
import { orgFeedRoutes } from './routes/org-feed.js';

export interface BuildAppOptions {
  logger: Logger;
  metrics: Metrics;
  db: Database;
  /** Verifies dashboard JWTs (owner/agent) for the org-feed SSE route. */
  verifier: JwtVerifier;
  /** Live-feed connection registry (unit 27). */
  hub: OrgFeedHub;
  /** Browser origins allowed to open the org-feed SSE (dashboard + web). */
  corsOrigins: string[];
  /** Readiness gate; flips to false during graceful shutdown. */
  isReady: () => boolean;
}

/**
 * Builds the chat-service Fastify instance: observability, a stable error shape,
 * health/metrics, and the dashboard org-feed SSE route (unit 27). Socket.IO is
 * attached to this instance's underlying HTTP server by the caller (server.ts). Pure
 * builder — no listening or signal handling.
 */
export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { logger, metrics, db, verifier, hub, corsOrigins, isReady } = opts;

  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({ loggerInstance, trustProxy: true });

  await app.register(metricsPlugin, { metrics });

  // CORS for the dashboard, which opens the org-feed SSE directly (bearer JWT). The
  // SSE handler hijacks the reply, so the preflight is handled here before the route.
  await app.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400,
  });

  await app.register(jwtAuthPlugin, { verifier });

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
  await app.register(orgFeedRoutes, { db, hub });
  await app.register(notesRoutes, { db });

  return app;
}
