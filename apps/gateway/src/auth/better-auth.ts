import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Database } from '@graft/db';
import type { Logger } from '@graft/observability';
import type { UserRole } from '@graft/shared';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, jwt } from 'better-auth/plugins';
import type { Mailer } from './mailer.js';

/**
 * Per-request context the signup / agent-invite flows set before they call
 * `auth.api.signUpEmail`. The `user.create.before` database hook reads it to stamp
 * the tenant scope (`organizationId`) and `role` onto the user row in the same
 * INSERT — both are server-managed (`input: false`) so a client can never set them,
 * and they are NOT NULL so the hook must run for every user creation we perform.
 */
export interface UserCreateContext {
  organizationId: string;
  role: UserRole;
}

export const userCreateContext = new AsyncLocalStorage<UserCreateContext>();

export interface CreateAuthDeps {
  db: Database;
  mailer: Mailer;
  logger: Logger;
  /** Secret for session/OTP signing (Better Auth `secret`). */
  secret: string;
  /** Public base URL Better Auth is served at; also the JWT issuer/audience. */
  baseURL: string;
  /** Origins allowed to drive the auth endpoints (the web + dashboard apps). */
  trustedOrigins: string[];
  /**
   * Parent domain to scope the session cookie to (e.g. `.graft.com`) so subdomains
   * share it. Unset in local dev — the host-only `localhost` cookie is already shared
   * across ports, so web (3000) and dashboard (3001) both see it.
   */
  cookieDomain?: string;
  otp: {
    length: number;
    expiresInSeconds: number;
    maxAttempts: number;
  };
}

/**
 * Builds the gateway's Better Auth instance: email+password with mandatory email
 * verification, OTP delivery via the shared {@link Mailer}, a bearer-token session
 * (dashboard stores it), and a JWKS-backed JWT (`/api/auth/token` + `/api/auth/jwks`)
 * whose payload carries `{ org, role, email }` so every downstream service can verify
 * identity + tenant scope without a shared secret. The gateway is the only signer.
 */
export function createAuth(deps: CreateAuthDeps) {
  const { db, mailer, secret, baseURL, trustedOrigins, cookieDomain, otp } = deps;

  return betterAuth({
    secret,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins,
    database: drizzleAdapter(db, { provider: 'pg' }),
    advanced: {
      // Let Postgres mint the uuid primary key (column default) instead of Better
      // Auth, so the existing uuid FKs to `users.id` stay valid.
      database: { generateId: false },
      // In prod, share the session cookie across subdomains of the parent domain so
      // the web app's login is seen by the dashboard. Omitted in dev (host-only
      // localhost cookie is already shared across ports).
      ...(cookieDomain
        ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    user: {
      modelName: 'users',
      additionalFields: {
        organizationId: { type: 'string', required: true, input: false },
        role: { type: 'string', required: true, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const ctx = userCreateContext.getStore();
            if (!ctx) return;
            return {
              data: { ...user, organizationId: ctx.organizationId, role: ctx.role },
            };
          },
        },
      },
    },
    plugins: [
      jwt({
        jwt: {
          definePayload: ({ user }) => {
            const u = user as unknown as {
              organizationId: string;
              role: UserRole;
              email: string;
            };
            return { org: u.organizationId, role: u.role, email: u.email };
          },
        },
      }),
      emailOTP({
        otpLength: otp.length,
        expiresIn: otp.expiresInSeconds,
        allowedAttempts: otp.maxAttempts,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp: code, type }) {
          if (type === 'forget-password') {
            await mailer.sendPasswordResetCode(email, email, code);
          } else {
            await mailer.sendVerificationCode(email, email, code);
          }
        },
      }),
    ],
  });
}

/** Concrete gateway auth instance type (carries the plugin api methods). */
export type Auth = ReturnType<typeof createAuth>;

/** Random throwaway password for an invited agent before they set their own. */
export function randomInvitePassword(): string {
  return `${randomUUID()}${randomUUID()}`;
}
