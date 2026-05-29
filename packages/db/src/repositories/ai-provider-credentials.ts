import { and, eq } from 'drizzle-orm';
import type { AiProvider } from '@graft/shared';
import type { Database } from '../client.js';
import { aiProviderCredentials } from '../schema/ai-provider-credentials.js';

export type AiProviderCredentialRow = typeof aiProviderCredentials.$inferSelect;

/** Encrypted key material to persist. The plaintext key never reaches this layer. */
export interface AiProviderCredentialSecret {
  provider: AiProvider;
  encryptedApiKey: string;
  encryptionIv: string;
  encryptionAuthTag: string;
  encryptionKeyId: string;
}

/** Safe projection — provider + freshness only, never the encrypted material. */
export interface AiProviderCredentialStatusRow {
  provider: AiProvider;
  updatedAt: Date;
}

/**
 * Inserts or rotates one provider's key in the org keyring (PK is (org, provider)).
 * Setting the same provider again rotates its key in place.
 */
export async function upsertAiProviderCredential(
  db: Database,
  orgId: string,
  secret: AiProviderCredentialSecret,
): Promise<void> {
  await db
    .insert(aiProviderCredentials)
    .values({ organizationId: orgId, ...secret, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [aiProviderCredentials.organizationId, aiProviderCredentials.provider],
      set: { ...secret, updatedAt: new Date() },
    });
}

/** Lists the providers the org has a key for (no key material). */
export async function listAiProviderCredentialStatuses(
  db: Database,
  orgId: string,
): Promise<AiProviderCredentialStatusRow[]> {
  return db.query.aiProviderCredentials.findMany({
    where: eq(aiProviderCredentials.organizationId, orgId),
    columns: { provider: true, updatedAt: true },
  });
}

/** Whether the org holds a key for a specific provider (for settings validation). */
export async function hasAiProviderKey(
  db: Database,
  orgId: string,
  provider: AiProvider,
): Promise<boolean> {
  const row = await db.query.aiProviderCredentials.findFirst({
    where: and(
      eq(aiProviderCredentials.organizationId, orgId),
      eq(aiProviderCredentials.provider, provider),
    ),
    columns: { provider: true },
  });
  return row !== undefined;
}

/**
 * Returns the full encrypted credential for one provider for in-memory decryption
 * at call time. Service-side only — never serialize this to a client.
 */
export async function getAiProviderCredentialSecret(
  db: Database,
  orgId: string,
  provider: AiProvider,
): Promise<AiProviderCredentialRow | undefined> {
  return db.query.aiProviderCredentials.findFirst({
    where: and(
      eq(aiProviderCredentials.organizationId, orgId),
      eq(aiProviderCredentials.provider, provider),
    ),
  });
}

/** Removes one provider's key from the org keyring; true if a row was deleted. */
export async function deleteAiProviderCredential(
  db: Database,
  orgId: string,
  provider: AiProvider,
): Promise<boolean> {
  const rows = await db
    .delete(aiProviderCredentials)
    .where(
      and(
        eq(aiProviderCredentials.organizationId, orgId),
        eq(aiProviderCredentials.provider, provider),
      ),
    )
    .returning({ provider: aiProviderCredentials.provider });
  return rows.length > 0;
}
