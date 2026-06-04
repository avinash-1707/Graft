import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createJwtVerifier, jwtAuthPlugin } from '@graft/auth';
import type { Encryptor } from '@graft/crypto';
import type { Database } from '@graft/db';
import type { Logger, Metrics } from '@graft/observability';
import { fromNodeHeaders } from 'better-auth/node';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import type { Auth } from './auth/better-auth.js';
import type { AuthService } from './auth/service.js';
import type { GatewayEnv } from './env.js';
import metricsPlugin from './plugins/metrics.js';
import widgetAuthPlugin from './plugins/widget-auth.js';
import { agentRoutes } from './routes/agents.js';
import { authRoutes } from './routes/auth.js';
import { downstreamRoutes } from './routes/downstream.js';
import { healthRoutes } from './routes/health.js';
import { aiCredentialRoutes } from './routes/ai-credentials.js';
import { aiSettingsRoutes } from './routes/ai-settings.js';
import { metricsRoutes } from './routes/metrics.js';
import { orgAdminRoutes } from './routes/org-admin.js';
import { orgConfigRoutes } from './routes/org-config.js';
import { widgetRoutes } from './routes/widget.js';

export interface BuildAppOptions {
  env: GatewayEnv;
  logger: Logger;
  metrics: Metrics;
  db: Database;
  /** Better Auth instance; serves `/api/auth/*` and issues JWTs. */
  auth: Auth;
  authService: AuthService;
  encryptor: Encryptor;
  /** Readiness gate; flips to false during graceful shutdown. */
  isReady: () => boolean;
}

/**
 * Constructs the gateway Fastify instance: observability, CORS for the dashboard,
 * the Better Auth handler (`/api/auth/*`), JWKS-backed bearer auth, global rate
 * limiting, health/metrics, and the application routes. Pure builder: no listening,
 * no signal handling — the caller owns the lifecycle.
 */
export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { env, logger, metrics, db, auth, authService, encryptor, isReady } = opts;

  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({
    loggerInstance,
    bodyLimit: env.BODY_LIMIT_BYTES,
    trustProxy: true,
    disableRequestLogging: false,
  });

  await app.register(metricsPlugin, { metrics });

  // CORS for the browser apps (credentials so the session cookie round-trips). Web
  // hosts auth; dashboard is the post-login app — both call the gateway.
  await app.register(cors, {
    origin: [env.WEB_ORIGIN, env.DASHBOARD_ORIGIN],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86_400,
  });

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

  // Better Auth owns everything under /api/auth/* (sign-in, OTP, session, JWKS,
  // /token). Bridge the Fastify request into a WHATWG Request and stream the
  // Better Auth Response back out.
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, env.BETTER_AUTH_URL);
      const headers = fromNodeHeaders(request.raw.headers);
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : null);
    },
  });

  // Gateway-local protected routes verify the same JWKS-backed JWT the dashboard
  // sends (the gateway is the signer; it verifies against its own JWKS endpoint).
  const verifier = createJwtVerifier({
    jwksUrl: `${env.BETTER_AUTH_URL}/api/auth/jwks`,
    issuer: env.BETTER_AUTH_URL,
    audience: env.BETTER_AUTH_URL,
  });
  await app.register(jwtAuthPlugin, { verifier });
  await app.register(widgetAuthPlugin, { db });

  await app.register(healthRoutes, { isReady });
  await app.register(metricsRoutes, { metrics });
  await app.register(authRoutes, { authService });
  await app.register(agentRoutes, { authService });
  await app.register(orgAdminRoutes, { db });
  await app.register(aiCredentialRoutes, { db, encryptor });
  await app.register(aiSettingsRoutes, { db });
  await app.register(orgConfigRoutes, { db });
  await app.register(widgetRoutes, { db, env });
  await app.register(downstreamRoutes);

  return app;
}
