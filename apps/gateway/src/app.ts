import rateLimit from '@fastify/rate-limit';
import type { Logger, Metrics } from '@graft/observability';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyInstance,
} from 'fastify';
import type { JwtConfig } from './auth/jwt.js';
import type { AuthService } from './auth/service.js';
import type { GatewayEnv } from './env.js';
import authPlugin from './plugins/auth.js';
import metricsPlugin from './plugins/metrics.js';
import { authRoutes } from './routes/auth.js';
import { downstreamRoutes } from './routes/downstream.js';
import { healthRoutes } from './routes/health.js';
import { metricsRoutes } from './routes/metrics.js';

export interface BuildAppOptions {
  env: GatewayEnv;
  logger: Logger;
  metrics: Metrics;
  authService: AuthService;
  jwtConfig: JwtConfig;
  /** Readiness gate; flips to false during graceful shutdown. */
  isReady: () => boolean;
}

/**
 * Constructs the gateway Fastify instance with observability, global rate
 * limiting, health/metrics endpoints, and the downstream routing stub. Pure
 * builder: no listening, no signal handling — the caller owns the lifecycle.
 */
export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { env, logger, metrics, authService, jwtConfig, isReady } = opts;

  // Widen to FastifyBaseLogger so the instance keeps Fastify's default logger
  // generic (the concrete pino type would diverge under exactOptionalPropertyTypes).
  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({
    loggerInstance,
    bodyLimit: env.BODY_LIMIT_BYTES,
    trustProxy: true,
    disableRequestLogging: false,
  });

  await app.register(metricsPlugin, { metrics });

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_request, context) => ({
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Retry in ${context.after}.`,
      },
    }),
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    });
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

  await app.register(authPlugin, { jwtConfig });

  await app.register(healthRoutes, { isReady });
  await app.register(metricsRoutes, { metrics });
  await app.register(authRoutes, { authService });
  await app.register(downstreamRoutes);

  return app;
}
