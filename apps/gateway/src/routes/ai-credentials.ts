import {
  deleteAiProviderCredential,
  getAiProviderCredentialStatus,
  upsertAiProviderCredential,
  type Database,
} from '@graft/db';
import {
  setAiProviderCredentialRequestSchema,
  type AiProviderCredentialStatus,
} from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Encryptor } from '../crypto/encryption.js';
import { parseOr400 } from '../http/validate.js';

interface AiCredentialRouteOptions {
  db: Database;
  encryptor: Encryptor;
}

/**
 * Owner-only AI provider credential management. The raw API key is encrypted at
 * rest on write and is never returned by any route — only its presence,
 * provider, and last-updated time are exposed. Scope is the owner's JWT org.
 */
export const aiCredentialRoutes: FastifyPluginAsync<AiCredentialRouteOptions> = async (
  app,
  opts,
) => {
  const { db, encryptor } = opts;
  const ownerOnly = { preHandler: [app.authenticate, app.requireRole('OWNER')] };

  app.get('/org/ai-provider', ownerOnly, async (request): Promise<AiProviderCredentialStatus> => {
    const orgId = request.authUser!.org;
    const status = await getAiProviderCredentialStatus(db, orgId);
    if (!status) return { configured: false };
    return {
      configured: true,
      provider: status.provider,
      updatedAt: status.updatedAt.toISOString(),
    };
  });

  app.put('/org/ai-provider', ownerOnly, async (request, reply) => {
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
    const status = await getAiProviderCredentialStatus(db, orgId);
    return reply.send({
      configured: true,
      provider: status?.provider ?? data.provider,
      updatedAt: status?.updatedAt.toISOString(),
    } satisfies AiProviderCredentialStatus);
  });

  app.delete('/org/ai-provider', ownerOnly, async (request, reply) => {
    const orgId = request.authUser!.org;
    const removed = await deleteAiProviderCredential(db, orgId);
    if (!removed) {
      return reply
        .code(404)
        .send({ error: { code: 'NOT_FOUND', message: 'No AI provider key configured.' } });
    }
    return reply.code(204).send();
  });
};
