import type { FastifyPluginAsync } from 'fastify';

interface HealthRouteOptions {
  /** Returns false once shutdown has begun so load balancers drain this node. */
  isReady: () => boolean;
}

/**
 * Liveness (`/healthz`) and readiness (`/readyz`) probes. Readiness flips to 503
 * during graceful shutdown so the orchestrator stops routing new traffic here.
 */
export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (app, opts) => {
  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (_request, reply) => {
    if (!opts.isReady()) {
      return reply.code(503).send({ status: 'shutting_down' });
    }
    return { status: 'ready' };
  });
};
