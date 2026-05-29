import { z } from 'zod';
import { userRoleSchema } from '../enums/user-role.js';
import { emailSchema, otpCodeSchema, passwordSchema } from './auth.js';
import { organizationIdSchema, userIdSchema } from './ids.js';

/** Lifecycle of an invited agent, derived from whether the email is verified. */
export const agentStatusSchema = z.enum(['PENDING', 'ACTIVE']);
export type AgentStatus = z.infer<typeof agentStatusSchema>;
export const AgentStatus = agentStatusSchema.enum;
export const AGENT_STATUSES = agentStatusSchema.options;

/** Owner invites a customer-support-agent by email. */
export const inviteAgentRequestSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(120),
});
export type InviteAgentRequest = z.infer<typeof inviteAgentRequestSchema>;

/** Invited agent activates their account: sets a password via the invite OTP. */
export const acceptInviteRequestSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  newPassword: passwordSchema,
});
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;

/** Safe agent projection returned to owners — never includes the password hash. */
export const agentSummarySchema = z.object({
  id: userIdSchema,
  organizationId: organizationIdSchema,
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
  status: agentStatusSchema,
  createdAt: z.string(),
});
export type AgentSummary = z.infer<typeof agentSummarySchema>;
