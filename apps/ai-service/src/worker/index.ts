import { loadEnv } from '../env.js';
import { startAiServiceTracing } from '../telemetry.js';

/**
 * Analysis-worker entrypoint (separate process from the HTTP API). Tracing starts
 * before the worker runtime is imported so instrumentations patch the modules the
 * provider SDKs + OTLP exporter use; the runtime is then loaded dynamically.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const tracing = startAiServiceTracing(env);
  const { startWorker } = await import('./run.js');
  await startWorker({ env, tracing });
}

main().catch((err) => {
  console.error('ai-service analysis worker failed to start:', err);
  process.exit(1);
});
