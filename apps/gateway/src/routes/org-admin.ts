import {
  addAllowedOrigin,
  deleteAllowedOrigin,
  getEmbedToken,
  listAllowedOrigins,
  rotateEmbedToken,
  type Database,
} from '@graft/db';
import { addAllowedOriginRequestSchema } from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthErrors } from '../auth/errors.js';
import { parseOr400 } from '../http/validate.js';
import { generateEmbedToken } from '../org/embed-token.js';

interface OrgAdminRouteOptions {
  db: Database;
}

const paramsSchema = z.object({ id: z.uuid() });

/**
 * Owner-only organization configuration: view/rotate the embed token and manage
 * the widget Origin allow-list. Scope comes from the authenticated owner's JWT
 * (`authUser.org`); routes never trust an org id from the client.
 */
export const orgAdminRoutes: FastifyPluginAsync<OrgAdminRouteOptions> = async (app, opts) => {
  const { db } = opts;
  const ownerOnly = { preHandler: [app.authenticate, app.requireRole('OWNER')] };

  app.get('/org/embed-token', ownerOnly, async (request) => {
    const orgId = request.authUser!.org;
    const embedToken = await getEmbedToken(db, orgId);
    if (!embedToken) throw AuthErrors.forbidden();
    return { embedToken };
  });

  app.post('/org/embed-token/rotate', ownerOnly, async (request) => {
    const orgId = request.authUser!.org;
    const embedToken = await rotateEmbedToken(db, orgId, generateEmbedToken());
    return { embedToken };
  });

  app.get('/org/allowed-origins', ownerOnly, async (request) => {
    const orgId = request.authUser!.org;
    const rows = await listAllowedOrigins(db, orgId);
    return rows.map((r) => ({ id: r.id, origin: r.origin, createdAt: r.createdAt.toISOString() }));
  });

  app.post('/org/allowed-origins', ownerOnly, async (request, reply) => {
    const data = parseOr400(addAllowedOriginRequestSchema, request.body, reply);
    if (!data) return;
    const orgId = request.authUser!.org;
    const row = await addAllowedOrigin(db, orgId, data.origin);
    if (!row) return reply.send({ origin: data.origin, message: 'Origin already allowed.' });
    return reply
      .code(201)
      .send({ id: row.id, origin: row.origin, createdAt: row.createdAt.toISOString() });
  });

  app.delete('/org/allowed-origins/:id', ownerOnly, async (request, reply) => {
    const params = parseOr400(paramsSchema, request.params, reply);
    if (!params) return;
    const orgId = request.authUser!.org;
    const removed = await deleteAllowedOrigin(db, orgId, params.id);
    if (!removed) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Origin not found.' } });
    return reply.code(204).send();
  });
};
