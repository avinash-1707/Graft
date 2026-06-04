import {
  agentSummarySchema,
  authUserSchema,
  type AcceptInviteRequest,
  type AgentSummary,
  type AuthUser,
  type InviteAgentRequest,
  type SignupRequest,
} from '@graft/shared';
import {
  createOrganization,
  deleteAgentForOrg,
  deleteOrganization,
  findUserByEmail,
  listAgentsByOrg,
  markEmailVerified,
  type Database,
  type UserRow,
} from '@graft/db';
import type { Logger } from '@graft/observability';
import { AuthErrors } from './errors.js';
import { randomInvitePassword, userCreateContext, type Auth } from './better-auth.js';
import type { Mailer } from './mailer.js';
import { generateEmbedToken } from '../org/embed-token.js';

export interface AuthServiceDeps {
  auth: Auth;
  db: Database;
  mailer: Mailer;
  logger: Logger;
}

function toAuthUser(row: UserRow): AuthUser {
  return authUserSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    name: row.name,
    role: row.role,
    emailVerified: row.emailVerified,
  });
}

function toAgentSummary(row: UserRow): AgentSummary {
  return agentSummarySchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.emailVerified ? 'ACTIVE' : 'PENDING',
    createdAt: row.createdAt.toISOString(),
  });
}

/**
 * Account flows that wrap Better Auth with Graft's tenancy. Better Auth owns the
 * primitives (password hashing, sessions, OTP, JWT issuance); this layer adds the
 * org-creation glue and the agent-invite lifecycle that the library has no built-in
 * equivalent for. Login / email verification / forgot-password are served directly
 * by Better Auth under `/api/auth/*` — they are not duplicated here.
 */
export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  /**
   * Creates the org and its owner. The `user.create.before` hook stamps the new
   * user's `organizationId` + `role` from {@link userCreateContext} so they land in
   * the same INSERT. Then a verification OTP is emailed. No auto sign-in — the owner
   * verifies first.
   */
  async signup(input: SignupRequest): Promise<{ user: AuthUser }> {
    const existing = await findUserByEmail(this.deps.db, input.email);
    if (existing) throw AuthErrors.emailInUse();

    const org = await createOrganization(this.deps.db, {
      name: input.organizationName,
      embedToken: generateEmbedToken(),
    });

    try {
      await userCreateContext.run({ organizationId: org.id, role: 'OWNER' }, async () => {
        await this.deps.auth.api.signUpEmail({
          body: { email: input.email, password: input.password, name: input.name },
        });
      });
    } catch (err) {
      await deleteOrganization(this.deps.db, org.id);
      this.deps.logger.warn({ err }, 'owner signup failed');
      throw AuthErrors.emailInUse();
    }

    const user = await findUserByEmail(this.deps.db, input.email);
    if (!user) {
      await deleteOrganization(this.deps.db, org.id);
      throw AuthErrors.badRequest('Could not create account.');
    }

    await this.deps.auth.api.sendVerificationOTP({
      body: { email: input.email, type: 'email-verification' },
    });
    return { user: toAuthUser(user) };
  }

  /** Lists an org's customer-support-agents (PENDING + ACTIVE). Owner-only caller. */
  async listAgents(organizationId: string): Promise<AgentSummary[]> {
    const rows = await listAgentsByOrg(this.deps.db, organizationId);
    return rows.map(toAgentSummary);
  }

  /**
   * Invites a customer-support-agent. Creates the user (random password) scoped to
   * the org via {@link userCreateContext}, then emails a password-set (OTP) code. If
   * the email already belongs to a PENDING agent in the same org the invite is
   * re-issued; any other existing account collides.
   */
  async inviteAgent(
    organizationId: string,
    input: InviteAgentRequest,
  ): Promise<{ agent: AgentSummary }> {
    const existing = await findUserByEmail(this.deps.db, input.email);
    let agent: UserRow;
    if (existing) {
      const reInvitable =
        existing.organizationId === organizationId &&
        existing.role === 'CUSTOMER_SUPPORT_AGENT' &&
        !existing.emailVerified;
      if (!reInvitable) throw AuthErrors.emailInUse();
      agent = existing;
    } else {
      await userCreateContext.run(
        { organizationId, role: 'CUSTOMER_SUPPORT_AGENT' },
        async () => {
          await this.deps.auth.api.signUpEmail({
            body: { email: input.email, password: randomInvitePassword(), name: input.name },
          });
        },
      );
      const created = await findUserByEmail(this.deps.db, input.email);
      if (!created) throw AuthErrors.badRequest('Could not create agent.');
      agent = created;
    }

    await this.deps.auth.api.requestPasswordResetEmailOTP({ body: { email: input.email } });
    return { agent: toAgentSummary(agent) };
  }

  /**
   * Activates an invited agent: setting the password via the OTP (sent to their
   * email) proves control of the address, so the password reset doubles as email
   * verification. The dashboard signs the agent in afterward.
   */
  async acceptInvite(input: AcceptInviteRequest): Promise<void> {
    const user = await findUserByEmail(this.deps.db, input.email);
    if (!user || user.role !== 'CUSTOMER_SUPPORT_AGENT' || user.emailVerified) {
      throw AuthErrors.invalidCode();
    }

    try {
      await this.deps.auth.api.resetPasswordEmailOTP({
        body: { email: input.email, otp: input.code, password: input.newPassword },
      });
    } catch {
      throw AuthErrors.invalidCode();
    }

    await markEmailVerified(this.deps.db, user.id);
  }

  /** Removes an agent from the org. Org + role scoped; 404 if no such agent. */
  async removeAgent(organizationId: string, agentId: string): Promise<void> {
    const removed = await deleteAgentForOrg(this.deps.db, organizationId, agentId);
    if (!removed) throw AuthErrors.agentNotFound();
  }
}
