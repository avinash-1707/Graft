import {
  agentSummarySchema,
  authUserSchema,
  type AcceptInviteRequest,
  type AgentSummary,
  type AuthCodePurpose,
  type AuthTokenResponse,
  type AuthUser,
  type ForgotPasswordRequest,
  type InviteAgentRequest,
  type LoginRequest,
  type ResendVerificationRequest,
  type ResetPasswordRequest,
  type SignupRequest,
  type VerifyEmailRequest,
} from '@graft/shared';
import {
  consumeAuthCode,
  createAgentUser,
  createAuthCode,
  createOrganizationWithOwner,
  deleteAgentForOrg,
  findActiveAuthCode,
  findUserByEmail,
  getOrganizationName,
  incrementAuthCodeAttempts,
  listAgentsByOrg,
  markEmailVerified,
  updateUserPasswordHash,
  type Database,
  type UserRow,
} from '@graft/db';
import type { Logger } from '@graft/observability';
import type { GatewayEnv } from '../env.js';
import { AuthErrors } from './errors.js';
import { signAccessToken, type JwtConfig } from './jwt.js';
import type { Mailer } from './mailer.js';
import { generateOtp, hashOtp, verifyOtp } from './otp.js';
import { hashPassword, verifyPassword } from './password.js';
import { generateEmbedToken } from '../org/embed-token.js';

export interface AuthServiceDeps {
  db: Database;
  mailer: Mailer;
  logger: Logger;
  env: GatewayEnv;
}

function toAuthUser(row: UserRow): AuthUser {
  return authUserSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    name: row.name,
    role: row.role,
    emailVerified: row.emailVerifiedAt !== null,
  });
}

function toAgentSummary(row: UserRow): AgentSummary {
  return agentSummarySchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.emailVerifiedAt !== null ? 'ACTIVE' : 'PENDING',
    createdAt: row.createdAt.toISOString(),
  });
}

/**
 * Sentinel password hash for an invited-but-not-yet-activated agent. It is not a
 * valid `scrypt$salt$hash` triple, so {@link verifyPassword} always rejects it —
 * the agent cannot log in until they accept the invite and set a real password.
 */
const UNSET_PASSWORD_HASH = '!';

export class AuthService {
  private readonly jwtConfig: JwtConfig;

  constructor(private readonly deps: AuthServiceDeps) {
    this.jwtConfig = {
      secret: deps.env.JWT_SECRET,
      issuer: deps.env.JWT_ISSUER,
      accessTtlSeconds: deps.env.JWT_ACCESS_TTL_SECONDS,
    };
  }

  /** Creates the org + owner (email unverified) and emails a verification code. */
  async signup(input: SignupRequest): Promise<{ user: AuthUser }> {
    const existing = await findUserByEmail(this.deps.db, input.email);
    if (existing) throw AuthErrors.emailInUse();

    const passwordHash = await hashPassword(input.password);
    const embedToken = generateEmbedToken();
    const { user } = await createOrganizationWithOwner(this.deps.db, {
      organizationName: input.organizationName,
      embedToken,
      owner: { email: input.email, passwordHash, name: input.name },
    });

    await this.issueAndSendCode(user, 'EMAIL_VERIFICATION');
    return { user: toAuthUser(user) };
  }

  /** Verifies the email via OTP and returns an access token (auto sign-in). */
  async verifyEmail(input: VerifyEmailRequest): Promise<AuthTokenResponse> {
    const user = await findUserByEmail(this.deps.db, input.email);
    if (!user) throw AuthErrors.invalidCode();
    if (user.emailVerifiedAt !== null) throw AuthErrors.alreadyVerified();

    await this.consumeCode(user.id, 'EMAIL_VERIFICATION', input.code);
    await markEmailVerified(this.deps.db, user.id);

    return this.issueToken({ ...user, emailVerifiedAt: new Date() });
  }

  /** Re-issues a verification code. Always resolves (no account enumeration). */
  async resendVerification(input: ResendVerificationRequest): Promise<void> {
    const user = await findUserByEmail(this.deps.db, input.email);
    if (!user || user.emailVerifiedAt !== null) return;
    await this.issueAndSendCode(user, 'EMAIL_VERIFICATION');
  }

  async login(input: LoginRequest): Promise<AuthTokenResponse> {
    const user = await findUserByEmail(this.deps.db, input.email);
    if (!user) throw AuthErrors.invalidCredentials();

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw AuthErrors.invalidCredentials();
    if (user.emailVerifiedAt === null) throw AuthErrors.emailNotVerified();

    return this.issueToken(user);
  }

  /** Sends a password-reset code. Always resolves (no account enumeration). */
  async forgotPassword(input: ForgotPasswordRequest): Promise<void> {
    const user = await findUserByEmail(this.deps.db, input.email);
    if (!user) return;
    await this.issueAndSendCode(user, 'PASSWORD_RESET');
  }

  /** Resets the password via OTP. A successful reset also confirms the email. */
  async resetPassword(input: ResetPasswordRequest): Promise<void> {
    const user = await findUserByEmail(this.deps.db, input.email);
    if (!user) throw AuthErrors.invalidCode();

    await this.consumeCode(user.id, 'PASSWORD_RESET', input.code);
    await updateUserPasswordHash(this.deps.db, user.id, await hashPassword(input.newPassword));
    if (user.emailVerifiedAt === null) await markEmailVerified(this.deps.db, user.id);
  }

  /** Lists an org's customer-support-agents (PENDING + ACTIVE). Owner-only caller. */
  async listAgents(organizationId: string): Promise<AgentSummary[]> {
    const rows = await listAgentsByOrg(this.deps.db, organizationId);
    return rows.map(toAgentSummary);
  }

  /**
   * Invites a customer-support-agent by email and emails an invite code. If the
   * email already belongs to a PENDING agent in the same org, the invite is
   * re-issued; any other existing account collides ({@link AuthErrors.emailInUse}).
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
        existing.emailVerifiedAt === null;
      if (!reInvitable) throw AuthErrors.emailInUse();
      agent = existing;
    } else {
      agent = await createAgentUser(this.deps.db, {
        organizationId,
        email: input.email,
        name: input.name,
        passwordHash: UNSET_PASSWORD_HASH,
      });
    }

    await this.issueAndSendCode(agent, 'AGENT_INVITE', organizationId);
    return { agent: toAgentSummary(agent) };
  }

  /** Activates an invited agent: sets their password via the invite OTP, then signs in. */
  async acceptInvite(input: AcceptInviteRequest): Promise<AuthTokenResponse> {
    const user = await findUserByEmail(this.deps.db, input.email);
    if (!user || user.role !== 'CUSTOMER_SUPPORT_AGENT' || user.emailVerifiedAt !== null) {
      throw AuthErrors.invalidCode();
    }

    await this.consumeCode(user.id, 'AGENT_INVITE', input.code);
    await updateUserPasswordHash(this.deps.db, user.id, await hashPassword(input.newPassword));
    await markEmailVerified(this.deps.db, user.id);

    return this.issueToken({ ...user, emailVerifiedAt: new Date() });
  }

  /** Removes an agent from the org. Org + role scoped; 404 if no such agent. */
  async removeAgent(organizationId: string, agentId: string): Promise<void> {
    const removed = await deleteAgentForOrg(this.deps.db, organizationId, agentId);
    if (!removed) throw AuthErrors.agentNotFound();
  }

  private async issueToken(user: UserRow): Promise<AuthTokenResponse> {
    const authUser = toAuthUser(user);
    const { token, expiresAt } = await signAccessToken(authUser, this.jwtConfig);
    return { token, expiresAt, user: authUser };
  }

  private async issueAndSendCode(
    user: UserRow,
    purpose: AuthCodePurpose,
    organizationId?: string,
  ): Promise<void> {
    const code = generateOtp(this.deps.env.OTP_LENGTH);
    await createAuthCode(this.deps.db, {
      userId: user.id,
      purpose,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + this.deps.env.OTP_TTL_MS),
    });
    if (purpose === 'EMAIL_VERIFICATION') {
      await this.deps.mailer.sendVerificationCode(user.email, user.name, code);
    } else if (purpose === 'PASSWORD_RESET') {
      await this.deps.mailer.sendPasswordResetCode(user.email, user.name, code);
    } else {
      const orgName =
        (await getOrganizationName(this.deps.db, organizationId ?? user.organizationId)) ??
        this.deps.env.APP_NAME;
      await this.deps.mailer.sendAgentInvite(user.email, user.name, orgName, code);
    }
  }

  /** Validates a code: enforces the attempt cap, verifies, then single-use consumes it. */
  private async consumeCode(userId: string, purpose: AuthCodePurpose, code: string): Promise<void> {
    const row = await findActiveAuthCode(this.deps.db, userId, purpose);
    if (!row) throw AuthErrors.invalidCode();
    if (row.attempts >= this.deps.env.OTP_MAX_ATTEMPTS) throw AuthErrors.invalidCode();

    await incrementAuthCodeAttempts(this.deps.db, row.id);
    if (!verifyOtp(code, row.codeHash)) throw AuthErrors.invalidCode();

    await consumeAuthCode(this.deps.db, row.id);
  }
}
