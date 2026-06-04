import { observabilityEnvSchema } from '@graft/observability';
import { z } from 'zod';

/**
 * Chat-service runtime configuration. Composes the shared observability env with
 * networking, the Socket.IO Redis adapter (cross-instance fan-out), JWT verification
 * (agent connections), and the database (tenant-scoped join validation). Parsed once
 * at boot; a missing/malformed required var fails fast.
 */
export const chatServiceEnvSchema = observabilityEnvSchema.extend({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8084),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // --- Database (tenant-scoped conversation lookups on join) ---
  DATABASE_URL: z.string().min(1),

  // --- Redis (Socket.IO adapter pub/sub for cross-instance fan-out) ---
  REDIS_URL: z.string().min(1),

  // --- Auth: verify gateway-issued agent JWTs via the gateway's JWKS endpoint ---
  AUTH_JWKS_URL: z.string().min(1).default('http://localhost:8080/api/auth/jwks'),
  AUTH_ISSUER: z.string().min(1).default('http://localhost:8080'),
  AUTH_AUDIENCE: z.string().min(1).default('http://localhost:8080'),
});

export type ChatServiceEnv = z.infer<typeof chatServiceEnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ChatServiceEnv {
  const parsed = chatServiceEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid chat-service environment:\n${issues}`);
  }
  return parsed.data;
}
