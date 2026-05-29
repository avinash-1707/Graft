import { observabilityEnvSchema } from '@graft/observability';
import { z } from 'zod';

/** Parses 'true'/'false' (and 1/0) from env strings without z.coerce's truthiness traps. */
const boolFromEnv = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

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

  // --- Database ---
  DATABASE_URL: z.string().min(1),

  // --- Auth / JWT ---
  /** HS256 signing secret; must be long enough to be unguessable. */
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('graft-gateway'),
  /** Access-token lifetime in seconds (default 12h). */
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(43_200),

  // --- One-time codes (email verification / password reset) ---
  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_TTL_MS: z.coerce.number().int().positive().default(600_000),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  // --- Tenant AI provider key encryption (app-level AES-256-GCM envelope) ---
  /** Active master key, base64-encoded; must decode to 32 bytes (AES-256). */
  AI_KEY_ENCRYPTION_KEY: z.string().refine((v) => {
    try {
      return Buffer.from(v, 'base64').length === 32;
    } catch {
      return false;
    }
  }, 'must be a base64-encoded 32-byte key'),
  /** Label recorded on each encrypted row; identifies the key for rotation. */
  AI_KEY_ENCRYPTION_KEY_ID: z.string().min(1).default('v1'),

  // --- Public widget endpoints ---
  /** Max widget requests per window, keyed per (embed token, session). */
  WIDGET_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  WIDGET_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  // --- Email (nodemailer) ---
  APP_NAME: z.string().min(1).default('Graft'),
  EMAIL_FROM: z.string().min(1).default('Graft <no-reply@graft.local>'),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_SECURE: boolFromEnv.default(false),
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
