import { getAiSettings, upsertAiSettings, type Database } from '@graft/db';
import { setAiSettingsRequestSchema, type AiSettings } from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parseOr400 } from '../http/validate.js';

interface AiSettingsRouteOptions {
  db: Database;
}

/**
 * Owner-only model-selection settings: which OpenRouter model serves chat vs
 * embeddings. Both run on the org's single OpenRouter key (set via the keyring
 * route). `null` clears a selection back to the platform default. Scope is the
 * owner's JWT org.
 */
export const aiSettingsRoutes: FastifyPluginAsync<AiSettingsRouteOptions> = async (app, opts) => {
  const { db } = opts;
  const ownerOnly = { preHandler: [app.authenticate, app.requireRole('OWNER')] };

  app.get('/org/ai-settings', ownerOnly, async (request): Promise<AiSettings> => {
    return getAiSettings(db, request.authUser!.org);
  });

  app.put('/org/ai-settings', ownerOnly, async (request, reply) => {
    const data = parseOr400(setAiSettingsRequestSchema, request.body, reply);
    if (!data) return;
    const orgId = request.authUser!.org;

    await upsertAiSettings(db, orgId, {
      chatModel: data.chatModel,
      embeddingModel: data.embeddingModel,
    });
    return reply.send({
      chatModel: data.chatModel,
      embeddingModel: data.embeddingModel,
    } satisfies AiSettings);
  });
};
