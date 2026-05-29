import type { Metrics } from '@graft/observability';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

interface MetricsPluginOptions {
  metrics: Metrics;
}

/**
 * Records HTTP request latency into the shared Prometheus histogram on every
 * response. Route label uses the matched route template (not the raw URL) to
 * keep cardinality bounded.
 */
const metricsPlugin: FastifyPluginAsync<MetricsPluginOptions> = async (app, opts) => {
  const { metrics } = opts;

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unmatched';
    metrics.httpRequestDuration.observe(
      {
        method: request.method,
        route,
        status: String(reply.statusCode),
      },
      reply.elapsedTime / 1000,
    );
  });
};

export default fp(metricsPlugin, { name: 'gateway-metrics' });
