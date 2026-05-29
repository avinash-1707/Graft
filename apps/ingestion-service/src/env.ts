import { observabilityEnvSchema } from '@graft/observability';
import { z } from 'zod';

/** Parses 'true'/'false' (and 1/0) from env strings without z.coerce's truthiness traps. */
const boolFromEnv = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

/**
 * Ingestion-service runtime configuration. Composes the shared observability env
 * with networking, database, Redis/BullMQ, object storage, JWT verification, and
 * upload limits. Parsed once at boot; a missing/malformed required var fails fast.
 */
export const ingestionEnvSchema = observabilityEnvSchema.extend({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8082),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // --- Database ---
  DATABASE_URL: z.string().min(1),

  // --- Redis / BullMQ ---
  REDIS_URL: z.string().min(1),

  // --- JWT verification (same secret/issuer the gateway signs with) ---
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('graft-gateway'),

  // --- Object storage (S3-compatible: AWS S3 or MinIO) ---
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1).default('us-east-1'),
  /** Custom endpoint for MinIO/self-hosted; omit for real AWS S3. */
  S3_ENDPOINT: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /** MinIO needs path-style addressing; AWS S3 uses virtual-hosted style. */
  S3_FORCE_PATH_STYLE: boolFromEnv.default(false),

  // --- Upload limits ---
  /** Max accepted upload size in bytes (default 25 MiB). */
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(26_214_400),
});

export type IngestionEnv = z.infer<typeof ingestionEnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): IngestionEnv {
  const parsed = ingestionEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid ingestion-service environment:\n${issues}`);
  }
  return parsed.data;
}
