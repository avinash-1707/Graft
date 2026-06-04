import { createJwtVerifier } from '@graft/auth';
import { createDb } from '@graft/db';
import { createLogger, createMetrics, type Tracing } from '@graft/observability';
import { Redis } from 'ioredis';
import { buildApp } from './app.js';
import { ClaimService } from './claim/service.js';
import type { ChatServiceEnv } from './env.js';
import { MessagingService } from './messaging/service.js';
import { createAiAbortPublisher } from './realtime/ai-bus.js';
import { createSocketServer } from './realtime/io.js';
import { SERVICE_NAME } from './telemetry.js';

export interface StartOptions {
  env: ChatServiceEnv;
  tracing: Tracing;
}

/**
 * Wires logging, metrics, the database, the Socket.IO server (with the Redis adapter
 * for cross-instance fan-out), builds the Fastify app, listens, and installs graceful
 * shutdown. On SIGTERM/SIGINT readiness flips to 503, connected sockets are dropped,
 * then the adapter Redis pair, server, DB, and tracing close (bounded by
 * SHUTDOWN_TIMEOUT_MS).
 */
export async function start({ env, tracing }: StartOptions): Promise<void> {
  const serviceName = env.OTEL_SERVICE_NAME ?? SERVICE_NAME;
  const logger = createLogger({ serviceName, env: env.NODE_ENV, level: env.LOG_LEVEL });
  const metrics = createMetrics({ serviceName });

  const { db, close: closeDb } = createDb({ connectionString: env.DATABASE_URL });
  const verifier = createJwtVerifier({
    jwksUrl: env.AUTH_JWKS_URL,
    issuer: env.AUTH_ISSUER,
    audience: env.AUTH_AUDIENCE,
  });

  let ready = true;
  const app = await buildApp({ logger, metrics, isReady: () => ready });

  // Socket.IO adapter needs two Redis connections (one subscribes, so it can't also
  // issue normal commands). Attach io to Fastify's HTTP server before listening.
  const pub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const sub = pub.duplicate();
  // ioredis throws on the process if no 'error' listener is attached; log instead so a
  // Redis blip degrades fan-out rather than crashing the service.
  pub.on('error', (err) => logger.error({ err }, 'socket.io adapter redis error (pub)'));
  sub.on('error', (err) => logger.error({ err }, 'socket.io adapter redis error (sub)'));

  // Reuse the adapter's publisher connection to also emit takeover aborts onto
  // ai-service's realtime bus (a separate channel; independent of the adapter's own).
  const abortPublisher = createAiAbortPublisher(pub);
  const claimService = new ClaimService({ db, metrics, abortPublisher, logger });
  const messagingService = new MessagingService({ db, metrics, logger });

  const io = createSocketServer({
    httpServer: app.server,
    db,
    verifier,
    metrics,
    logger,
    serviceName,
    pub,
    sub,
    claimService,
    messagingService,
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
        // Drop sockets, release the adapter Redis pair, then let Fastify close the
        // shared HTTP server (avoids io.close() racing Fastify for the same server).
        io.disconnectSockets(true);
        pub.disconnect();
        sub.disconnect();
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
