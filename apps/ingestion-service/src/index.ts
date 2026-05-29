import { loadEnv } from './env.js';
import { startIngestionTracing } from './telemetry.js';

/**
 * Ingestion-service entrypoint. Tracing starts before the server module is
 * imported so the HTTP/Fastify instrumentations patch those modules; the server
 * is then loaded dynamically and started.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const tracing = startIngestionTracing(env);
  const { start } = await import('./server.js');
  await start({ env, tracing });
}

main().catch((err) => {
  // Logger may not exist yet at boot failure; stderr is the only safe sink.
  console.error('ingestion-service failed to start:', err);
  process.exit(1);
});
