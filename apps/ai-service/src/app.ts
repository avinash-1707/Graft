import { jwtAuthPlugin, widgetAuthPlugin, type JwtVerifyConfig } from '@graft/auth';
import type { Database } from '@graft/db';
import type { Logger, Metrics } from '@graft/observability';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyInstance,
} from 'fastify';
import type { AnswerService } from './ai/answer-service.js';
import type { ConversationService } from './conversation/service.js';
import metricsPlugin from './plugins/metrics.js';
import { healthRoutes } from './routes/health.js';
import { metricsRoutes } from './routes/metrics.js';
import { widgetMessageRoutes } from './routes/widget-messages.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Conversation persistence + sequencing; consumed by the SSE/escalation units. */
    conversations: ConversationService;
  }
}

export interface BuildAppOptions {
  logger: Logger;
  metrics: Metrics;
  db: Database;
  conversations: ConversationService;
  answerService: AnswerService;
  jwtConfig: JwtVerifyConfig;
  /** Readiness gate; flips to false during graceful shutdown. */
  isReady: () => boolean;
}

/**
 * Builds the ai-service Fastify instance: observability, a stable error shape, and
 * health/metrics. The conversation service is decorated onto the instance for the
 * message/SSE routes that land in later units. Pure builder — no listening or
 * signal handling; the caller owns the lifecycle.
 */
export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { logger, metrics, db, conversations, answerService, jwtConfig, isReady } = opts;

  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({ loggerInstance, trustProxy: true });

  app.decorate('conversations', conversations);

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

  // Auth: dashboard/agent JWT verify (for later agent-facing routes) + widget
  // embed-token validation (the SSE customer path). Both are shared via @graft/auth.
  await app.register(jwtAuthPlugin, { jwtConfig });
  await app.register(widgetAuthPlugin, { db });

  await app.register(healthRoutes, { isReady });
  await app.register(metricsRoutes, { metrics });
  await app.register(widgetMessageRoutes, { db, answerService });

  return app;
}
