import { inviteAgentRequestSchema } from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { parseOr400 } from '../http/validate.js';

interface AgentRouteOptions {
  authService: AuthService;
}

const paramsSchema = z.object({ id: z.uuid() });

/**
 * Owner-only agent management: list, invite (OTP email), and remove
 * customer-support-agents. Scope comes from the authenticated owner's JWT
 * (`authUser.org`); routes never trust an org id from the client.
 */
export const agentRoutes: FastifyPluginAsync<AgentRouteOptions> = async (app, opts) => {
  const { authService } = opts;
  const ownerOnly = { preHandler: [app.authenticate, app.requireRole('OWNER')] };

  app.get('/org/agents', ownerOnly, async (request) => {
    const orgId = request.authUser!.org;
    return authService.listAgents(orgId);
  });

  app.post('/org/agents', ownerOnly, async (request, reply) => {
    const data = parseOr400(inviteAgentRequestSchema, request.body, reply);
    if (!data) return;
    const orgId = request.authUser!.org;
    const result = await authService.inviteAgent(orgId, data);
    return reply.code(201).send(result);
  });

  app.delete('/org/agents/:id', ownerOnly, async (request, reply) => {
    const params = parseOr400(paramsSchema, request.params, reply);
    if (!params) return;
    const orgId = request.authUser!.org;
    await authService.removeAgent(orgId, params.id);
    return reply.code(204).send();
  });
};
