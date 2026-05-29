import type { FastifyPluginAsync } from 'fastify';

/**
 * Placeholder for the gateway's routing layer to a downstream service
 * (ai-service is the first target). No real proxying or business logic yet —
 * unit 05 only proves the ingress, observability, and rate-limit path. Returns
 * the project's stable error shape so clients see a consistent contract from
 * day one.
 */
export const downstreamRoutes: FastifyPluginAsync = async (app) => {
  app.all('/v1/*', async (_request, reply) =>
    reply.code(501).send({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This route is not available yet.',
      },
    }),
  );
};
