import {
  deleteAiProviderCredential,
  getAiSettings,
  listAiProviderCredentialStatuses,
  upsertAiProviderCredential,
  upsertAiSettings,
  type Database,
} from '@graft/db';
import type { Encryptor } from '@graft/crypto';
import {
  aiProviderSchema,
  setAiProviderCredentialRequestSchema,
  type AiCredentialStatus,
} from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parseOr400 } from '../http/validate.js';

interface AiCredentialRouteOptions {
  db: Database;
  encryptor: Encryptor;
}

const providerParamsSchema = z.object({ provider: aiProviderSchema });

async function loadStatus(db: Database, orgId: string): Promise<AiCredentialStatus> {
  const rows = await listAiProviderCredentialStatuses(db, orgId);
  return {
    credentials: rows.map((r) => ({ provider: r.provider, updatedAt: r.updatedAt.toISOString() })),
  };
}

/**
 * Owner-only AI provider keyring. At most one key per (org, provider); raw keys
 * are encrypted at rest on write and never returned — only the set of configured
 * providers + last-updated time. Deleting a provider's key also clears any
 * `ai_settings` selection that pointed at it. Scope is the owner's JWT org.
 */
export const aiCredentialRoutes: FastifyPluginAsync<AiCredentialRouteOptions> = async (
  app,
  opts,
) => {
  const { db, encryptor } = opts;
  const ownerOnly = { preHandler: [app.authenticate, app.requireRole('OWNER')] };

  app.get('/org/ai-providers', ownerOnly, async (request): Promise<AiCredentialStatus> => {
    return loadStatus(db, request.authUser!.org);
  });

  app.put('/org/ai-providers', ownerOnly, async (request, reply) => {
    const data = parseOr400(setAiProviderCredentialRequestSchema, request.body, reply);
    if (!data) return;
    const orgId = request.authUser!.org;
    const sealed = encryptor.encrypt(data.apiKey);
    await upsertAiProviderCredential(db, orgId, {
      provider: data.provider,
      encryptedApiKey: sealed.ciphertext,
      encryptionIv: sealed.iv,
      encryptionAuthTag: sealed.authTag,
      encryptionKeyId: sealed.keyId,
    });
    return reply.send(await loadStatus(db, orgId));
  });

  app.delete('/org/ai-providers/:provider', ownerOnly, async (request, reply) => {
    const params = parseOr400(providerParamsSchema, request.params, reply);
    if (!params) return;
    const orgId = request.authUser!.org;
    const removed = await deleteAiProviderCredential(db, orgId, params.provider);
    if (!removed) {
      return reply
        .code(404)
        .send({ error: { code: 'NOT_FOUND', message: 'No key configured for that provider.' } });
    }
    // Clear any selection that pointed at the now-deleted key.
    const settings = await getAiSettings(db, orgId);
    if (
      settings.chatProvider === params.provider ||
      settings.embeddingProvider === params.provider
    ) {
      await upsertAiSettings(db, orgId, {
        chatProvider: settings.chatProvider === params.provider ? null : settings.chatProvider,
        embeddingProvider:
          settings.embeddingProvider === params.provider ? null : settings.embeddingProvider,
      });
    }
    return reply.code(204).send();
  });
};
