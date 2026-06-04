/**
 * Schema-generation entry point for the Better Auth CLI (`pnpm dlx auth@latest
 * generate`). It builds the auth instance with the SAME adapter, plugins, and
 * user additional-fields as the runtime config in `src/auth/better-auth.ts`, so the
 * generated tables match production. Secrets/URLs are placeholders — the generator
 * only introspects the schema shape and never opens a database connection.
 *
 * Not imported by the running server; the server builds its instance via
 * `createAuth(...)` with real dependencies.
 */
import { createDb } from '@graft/db';
import { createAuth } from './src/auth/better-auth.js';

const { db } = createDb({ connectionString: 'postgres://placeholder/placeholder' });

const noopMailer = {
  sendVerificationCode: async () => {},
  sendPasswordResetCode: async () => {},
  sendAgentInvite: async () => {},
};

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Parameters<typeof createAuth>[0]['logger'];

export const auth = createAuth({
  db,
  mailer: noopMailer,
  logger: noopLogger,
  secret: 'placeholder-secret-placeholder-secret-32',
  baseURL: 'http://localhost:8080',
  trustedOrigins: ['http://localhost:3000'],
  otp: { length: 6, expiresInSeconds: 600, maxAttempts: 5 },
});
