import { startTracing, type Tracing } from '@graft/observability';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import type { ChatServiceEnv } from './env.js';

export const SERVICE_NAME = 'chat-service';

/**
 * Boots OpenTelemetry tracing. Must run before Fastify/Socket.IO are imported so the
 * HTTP and Fastify instrumentations can patch those modules.
 */
export function startChatServiceTracing(env: ChatServiceEnv): Tracing {
  return startTracing({
    serviceName: env.OTEL_SERVICE_NAME ?? SERVICE_NAME,
    serviceVersion: env.OTEL_SERVICE_VERSION,
    env: env.NODE_ENV,
    ...(env.OTEL_EXPORTER_OTLP_ENDPOINT ? { otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT } : {}),
    instrumentations: [new HttpInstrumentation(), new FastifyInstrumentation()],
  });
}
