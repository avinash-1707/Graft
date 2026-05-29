import { z } from 'zod';
import { userRoleSchema } from '../enums/user-role.js';
import { organizationIdSchema, userIdSchema } from './ids.js';

/** Minimum password length enforced at every auth boundary. */
export const PASSWORD_MIN_LENGTH = 8;

export const emailSchema = z.email().toLowerCase().trim();
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(256);
/** One-time codes are numeric strings; length is configured at issue time. */
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,10}$/, 'Code must be 4–10 digits');

export const signupRequestSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: passwordSchema,
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const verifyEmailRequestSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const resendVerificationRequestSchema = z.object({
  email: emailSchema,
});
export type ResendVerificationRequest = z.infer<typeof resendVerificationRequestSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  newPassword: passwordSchema,
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

/** Safe user projection returned to clients — never includes the password hash. */
export const authUserSchema = z.object({
  id: userIdSchema,
  organizationId: organizationIdSchema,
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
  emailVerified: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authTokenResponseSchema = z.object({
  token: z.string(),
  /** Unix epoch seconds at which the access token expires. */
  expiresAt: z.number().int(),
  user: authUserSchema,
});
export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>;

/** Decoded JWT payload carried on every authenticated request. */
export const jwtClaimsSchema = z.object({
  sub: userIdSchema,
  org: organizationIdSchema,
  role: userRoleSchema,
  email: z.string(),
});
export type JwtClaims = z.infer<typeof jwtClaimsSchema>;
