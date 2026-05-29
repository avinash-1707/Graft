import type { Metrics } from '@graft/observability';
import type { FastifyPluginAsync } from 'fastify';

interface MetricsRouteOptions {
  metrics: Metrics;
}

/**
 * Prometheus scrape endpoint. Exempt from rate limiting so a scraper is never
 * throttled, and excluded from the request-duration histogram would be ideal but
 * is harmless here given fixed low cardinality.
 */
export const metricsRoutes: FastifyPluginAsync<MetricsRouteOptions> = async (app, opts) => {
  app.get('/metrics', { config: { rateLimit: false } }, async (_request, reply) => {
    reply.header('Content-Type', opts.metrics.registry.contentType);
    return opts.metrics.registry.metrics();
  });
};
