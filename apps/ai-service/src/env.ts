import { observabilityEnvSchema } from '@graft/observability';
import { z } from 'zod';

/**
 * AI-service runtime configuration. Composes the shared observability env with
 * networking and database settings. Parsed once at boot; a missing/malformed
 * required var fails fast. (Provider keyring decryption, Redis/BullMQ, and JWT
 * verification arrive with the SSE/escalation units.)
 */
export const aiServiceEnvSchema = observabilityEnvSchema.extend({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8083),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // --- Database ---
  DATABASE_URL: z.string().min(1),
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
