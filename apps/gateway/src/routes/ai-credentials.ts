import {
  deleteAiProviderCredential,
  getAiProviderCredentialStatus,
  upsertAiProviderCredential,
  type Database,
} from '@graft/db';
import type { Encryptor } from '@graft/crypto';
import { setAiProviderCredentialRequestSchema, type AiCredentialStatus } from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parseOr400 } from '../http/validate.js';

interface AiCredentialRouteOptions {
  db: Database;
  encryptor: Encryptor;
}

async function loadStatus(db: Database, orgId: string): Promise<AiCredentialStatus> {
  const row = await getAiProviderCredentialStatus(db, orgId);
  return {
    configured: row !== undefined,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

/**
 * Owner-only OpenRouter keyring. Exactly one key per org; the raw key is encrypted at
 * rest on write and never returned — only whether a key is configured + when it was
 * last set. Scope is the owner's JWT org.
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
      encryptedApiKey: sealed.ciphertext,
      encryptionIv: sealed.iv,
      encryptionAuthTag: sealed.authTag,
      encryptionKeyId: sealed.keyId,
    });
    return reply.send(await loadStatus(db, orgId));
  });

  app.delete('/org/ai-providers', ownerOnly, async (request, reply) => {
    const orgId = request.authUser!.org;
    const removed = await deleteAiProviderCredential(db, orgId);
    if (!removed) {
      return reply
        .code(404)
        .send({ error: { code: 'NOT_FOUND', message: 'No OpenRouter key configured.' } });
    }
    return reply.code(204).send();
  });
};
