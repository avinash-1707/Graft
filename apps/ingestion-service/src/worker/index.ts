import { loadEnv } from '../env.js';
import { startIngestionTracing } from '../telemetry.js';

/**
 * Ingestion-worker entrypoint (separate process from the HTTP API). Tracing
 * starts before the worker runtime is imported so the HTTP instrumentation patches
 * the modules the S3 SDK + OTLP exporter use; the runtime is then loaded
 * dynamically and started.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const tracing = startIngestionTracing(env);
  const { startWorker } = await import('./run.js');
  await startWorker({ env, tracing });
}

main().catch((err) => {
  console.error('ingestion worker failed to start:', err);
  process.exit(1);
});
