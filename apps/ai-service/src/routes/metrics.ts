import type { Metrics } from '@graft/observability';
import type { FastifyPluginAsync } from 'fastify';

interface MetricsRouteOptions {
  metrics: Metrics;
}

/** Prometheus scrape endpoint. */
export const metricsRoutes: FastifyPluginAsync<MetricsRouteOptions> = async (app, opts) => {
  app.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', opts.metrics.registry.contentType);
    return opts.metrics.registry.metrics();
  });
};
