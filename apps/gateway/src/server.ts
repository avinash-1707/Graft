import { createEncryptor } from '@graft/crypto';
import { createDb } from '@graft/db';
import { createLogger, createMetrics, type Tracing } from '@graft/observability';
import { buildApp } from './app.js';
import { createAuth } from './auth/better-auth.js';
import { createMailer } from './auth/mailer.js';
import { AuthService } from './auth/service.js';
import type { GatewayEnv } from './env.js';
import { SERVICE_NAME } from './telemetry.js';

export interface StartOptions {
  env: GatewayEnv;
  tracing: Tracing;
}

/**
 * Wires logging + metrics, builds the app, starts listening, and installs
 * graceful-shutdown handlers for SIGTERM/SIGINT. On a signal the readiness probe
 * flips to 503, in-flight requests drain (bounded by SHUTDOWN_TIMEOUT_MS), then
 * the HTTP server and tracing SDK close.
 */
export async function start({ env, tracing }: StartOptions): Promise<void> {
  const logger = createLogger({
    serviceName: env.OTEL_SERVICE_NAME ?? SERVICE_NAME,
    env: env.NODE_ENV,
    level: env.LOG_LEVEL,
  });
  const metrics = createMetrics({ serviceName: env.OTEL_SERVICE_NAME ?? SERVICE_NAME });

  const { db, close: closeDb } = createDb({ connectionString: env.DATABASE_URL });
  const mailer = createMailer(env, logger);
  const auth = createAuth({
    db,
    mailer,
    logger,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.WEB_ORIGIN, env.DASHBOARD_ORIGIN],
    ...(env.AUTH_COOKIE_DOMAIN ? { cookieDomain: env.AUTH_COOKIE_DOMAIN } : {}),
    otp: {
      length: env.OTP_LENGTH,
      expiresInSeconds: Math.round(env.OTP_TTL_MS / 1000),
      maxAttempts: env.OTP_MAX_ATTEMPTS,
    },
  });
  const authService = new AuthService({ auth, db, mailer, logger });
  const encryptor = createEncryptor({
    keyBase64: env.AI_KEY_ENCRYPTION_KEY,
    keyId: env.AI_KEY_ENCRYPTION_KEY_ID,
  });

  let ready = true;
  const app = await buildApp({
    env,
    logger,
    metrics,
    db,
    auth,
    authService,
    encryptor,
    isReady: () => ready,
  });

  await app.listen({ host: env.HOST, port: env.PORT });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    ready = false;
    logger.info({ signal }, 'shutdown initiated');

    const timer = setTimeout(() => {
      logger.error('shutdown timed out; forcing exit');
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    void (async () => {
      try {
        await app.close();
        await closeDb();
        await tracing.shutdown();
        logger.info('shutdown complete');
        clearTimeout(timer);
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'error during shutdown');
        clearTimeout(timer);
        process.exit(1);
      }
    })();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
