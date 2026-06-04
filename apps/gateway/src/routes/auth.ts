import { acceptInviteRequestSchema, signupRequestSchema } from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import { AuthErrors } from '../auth/errors.js';
import type { AuthService } from '../auth/service.js';
import { parseOr400 } from '../http/validate.js';

interface AuthRouteOptions {
  authService: AuthService;
}

/**
 * Custom auth endpoints that wrap Better Auth's tenancy gaps. Sign-in, email
 * verification, resend, forgot/reset password are served by Better Auth directly at
 * `/api/auth/*`; only org-creating signup, agent-invite acceptance, and the identity
 * projection live here. Errors surface through the gateway's global handler.
 */
export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (app, opts) => {
  const { authService } = opts;

  app.post('/auth/signup', async (request, reply) => {
    const data = parseOr400(signupRequestSchema, request.body, reply);
    if (!data) return;
    const result = await authService.signup(data);
    return reply.code(201).send(result);
  });

  app.post('/auth/accept-invite', async (request, reply) => {
    const data = parseOr400(acceptInviteRequestSchema, request.body, reply);
    if (!data) return;
    await authService.acceptInvite(data);
    return reply.send({ message: 'Password set. You can now sign in.' });
  });

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    if (!request.authUser) throw AuthErrors.unauthorized();
    const { sub, org, role, email } = request.authUser;
    return { id: sub, organizationId: org, role, email };
  });
};
