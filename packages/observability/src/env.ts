import { z } from 'zod';

export const nodeEnvSchema = z.enum(['development', 'production', 'test']).default('development');

export const logLevelSchema = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  .default('info');

export const observabilityEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  OTEL_SERVICE_NAME: z.string().min(1).optional(),
  OTEL_SERVICE_VERSION: z.string().min(1).default('0.0.0'),
});

export type ObservabilityEnv = z.infer<typeof observabilityEnvSchema>;
