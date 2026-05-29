import { getAiSettings, hasAiProviderKey, upsertAiSettings, type Database } from '@graft/db';
import { setAiSettingsRequestSchema, type AiSettings } from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import { AuthErrors } from '../auth/errors.js';
import { parseOr400 } from '../http/validate.js';

interface AiSettingsRouteOptions {
  db: Database;
}

/**
 * Owner-only provider-selection settings: which keyring provider is used for chat
 * vs embeddings. A selection is only accepted if the org actually holds a key for
 * that provider (else 400). Clearing to null is always allowed. Scope is the
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

    if (data.chatProvider && !(await hasAiProviderKey(db, orgId, data.chatProvider))) {
      throw AuthErrors.badRequest(`No API key configured for ${data.chatProvider}.`);
    }
    if (data.embeddingProvider && !(await hasAiProviderKey(db, orgId, data.embeddingProvider))) {
      throw AuthErrors.badRequest(`No API key configured for ${data.embeddingProvider}.`);
    }

    await upsertAiSettings(db, orgId, {
      chatProvider: data.chatProvider,
      embeddingProvider: data.embeddingProvider,
    });
    return reply.send({
      chatProvider: data.chatProvider,
      embeddingProvider: data.embeddingProvider,
    } satisfies AiSettings);
  });
};
