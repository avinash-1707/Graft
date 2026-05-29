import { observabilityEnvSchema } from '@graft/observability';
import { z } from 'zod';

/**
 * AI-service runtime configuration. Composes the shared observability env with
 * networking, database, JWT verification, and tenant AI-key decryption settings.
 * Parsed once at boot; a missing/malformed required var fails fast. (Redis/BullMQ
 * for background sentiment/spend-caps arrives with the escalation unit.)
 */
export const aiServiceEnvSchema = observabilityEnvSchema.extend({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8083),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // --- Database ---
  DATABASE_URL: z.string().min(1),

  // --- Redis / BullMQ (non-streamed analysis queue) ---
  REDIS_URL: z.string().min(1),
  /** Worker concurrency for the analysis (classifier) queue. */
  ANALYSIS_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  /** How long a turn handler waits for the analysis result before giving up the live emit. */
  ANALYSIS_WAIT_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),

  // --- JWT verification (same secret/issuer the gateway signs with) ---
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('graft-gateway'),

  // --- Retrieval tuning ---
  /** Max KB chunks retrieved per turn for grounding the answer. */
  RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(50).default(6),

  // --- Tenant AI key decryption (same envelope key the gateway seals with) ---
  /** Active master key, base64-encoded; must decode to 32 bytes (AES-256). */
  AI_KEY_ENCRYPTION_KEY: z.string().refine((v) => {
    try {
      return Buffer.from(v, 'base64').length === 32;
    } catch {
      return false;
    }
  }, 'must be a base64-encoded 32-byte key'),
  /** Label identifying the active key; must match a key the gateway sealed with. */
  AI_KEY_ENCRYPTION_KEY_ID: z.string().min(1).default('v1'),
});

export type AiServiceEnv = z.infer<typeof aiServiceEnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AiServiceEnv {
  const parsed = aiServiceEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid ai-service environment:\n${issues}`);
  }
  return parsed.data;
}
