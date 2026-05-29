import { startTracing, type Tracing } from '@graft/observability';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import type { AiServiceEnv } from './env.js';

export const SERVICE_NAME = 'ai-service';

/**
 * Boots OpenTelemetry tracing. Must run before Fastify is imported so the HTTP
 * and Fastify instrumentations can patch those modules.
 */
export function startAiServiceTracing(env: AiServiceEnv): Tracing {
  return startTracing({
    serviceName: env.OTEL_SERVICE_NAME ?? SERVICE_NAME,
    serviceVersion: env.OTEL_SERVICE_VERSION,
    env: env.NODE_ENV,
    ...(env.OTEL_EXPORTER_OTLP_ENDPOINT ? { otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT } : {}),
    instrumentations: [new HttpInstrumentation(), new FastifyInstrumentation()],
  });
}
