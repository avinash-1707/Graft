import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  resendVerificationRequestSchema,
  resetPasswordRequestSchema,
  signupRequestSchema,
  verifyEmailRequestSchema,
} from '@graft/shared';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { z } from 'zod';
import { AuthErrors } from '../auth/errors.js';
import type { AuthService } from '../auth/service.js';

interface AuthRouteOptions {
  authService: AuthService;
}

/** Parses a request body; on failure sends a 400 in the stable error shape and returns undefined. */
function parseOr400<T extends z.ZodType>(
  schema: T,
  body: unknown,
  reply: FastifyReply,
): z.infer<T> | undefined {
  const result = schema.safeParse(body);
  if (!result.success) {
    reply.code(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request.',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return undefined;
  }
  return result.data;
}

const GENERIC_OK = { message: 'If an account exists, an email has been sent.' };

/**
 * Owner auth flows: signup (org + owner), email verification via OTP, login,
 * resend verification, and OTP-based password reset. Errors surface through the
 * gateway's global handler using {@link AuthError}'s code + status.
 */
export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (app, opts) => {
  const { authService } = opts;

  app.post('/auth/signup', async (request, reply) => {
    const data = parseOr400(signupRequestSchema, request.body, reply);
    if (!data) return;
    const result = await authService.signup(data);
    return reply.code(201).send(result);
  });

  app.post('/auth/verify-email', async (request, reply) => {
    const data = parseOr400(verifyEmailRequestSchema, request.body, reply);
    if (!data) return;
    return reply.send(await authService.verifyEmail(data));
  });

  app.post('/auth/resend-verification', async (request, reply) => {
    const data = parseOr400(resendVerificationRequestSchema, request.body, reply);
    if (!data) return;
    await authService.resendVerification(data);
    return reply.send(GENERIC_OK);
  });

  app.post('/auth/login', async (request, reply) => {
    const data = parseOr400(loginRequestSchema, request.body, reply);
    if (!data) return;
    return reply.send(await authService.login(data));
  });

  app.post('/auth/forgot-password', async (request, reply) => {
    const data = parseOr400(forgotPasswordRequestSchema, request.body, reply);
    if (!data) return;
    await authService.forgotPassword(data);
    return reply.send(GENERIC_OK);
  });

  app.post('/auth/reset-password', async (request, reply) => {
    const data = parseOr400(resetPasswordRequestSchema, request.body, reply);
    if (!data) return;
    await authService.resetPassword(data);
    return reply.send({ message: 'Password updated. You can now sign in.' });
  });

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    if (!request.authUser) throw AuthErrors.unauthorized();
    const { sub, org, role, email } = request.authUser;
    return { id: sub, organizationId: org, role, email };
  });
};
