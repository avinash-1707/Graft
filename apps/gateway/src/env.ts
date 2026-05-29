import { observabilityEnvSchema } from '@graft/observability';
import { z } from 'zod';

/**
 * Gateway runtime configuration. Composes the shared observability env schema
 * with gateway-specific networking and rate-limit settings. Parsed once at boot;
 * a missing or malformed required var fails fast (see {@link loadEnv}).
 */
export const gatewayEnvSchema = observabilityEnvSchema.extend({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  /** Max requests per window, per client key (default: IP). */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  /** Sliding window length in milliseconds. */
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  /** Body size cap in bytes for incoming requests. */
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576),
  /** Grace period (ms) to drain in-flight requests on SIGTERM/SIGINT. */
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): GatewayEnv {
  const parsed = gatewayEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid gateway environment:\n${issues}`);
  }
  return parsed.data;
}
