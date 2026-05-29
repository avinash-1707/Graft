import { eq } from 'drizzle-orm';
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
 * Inserts or replaces the org's single AI provider credential (org is the PK).
 * Swapping providers or rotating the key both land here.
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
      target: aiProviderCredentials.organizationId,
      set: { ...secret, updatedAt: new Date() },
    });
}

/**
 * Returns the org's credential status without the key material — for the owner
 * config screen. Returns undefined when no key is configured.
 */
export async function getAiProviderCredentialStatus(
  db: Database,
  orgId: string,
): Promise<AiProviderCredentialStatusRow | undefined> {
  return db.query.aiProviderCredentials.findFirst({
    where: eq(aiProviderCredentials.organizationId, orgId),
    columns: { provider: true, updatedAt: true },
  });
}

/**
 * Returns the full encrypted credential for in-memory decryption at call time.
 * Intended for the AI-service path only — never serialize this to a client.
 */
export async function getAiProviderCredentialSecret(
  db: Database,
  orgId: string,
): Promise<AiProviderCredentialRow | undefined> {
  return db.query.aiProviderCredentials.findFirst({
    where: eq(aiProviderCredentials.organizationId, orgId),
  });
}

/** Removes the org's credential; returns true if a row was deleted. */
export async function deleteAiProviderCredential(db: Database, orgId: string): Promise<boolean> {
  const rows = await db
    .delete(aiProviderCredentials)
    .where(eq(aiProviderCredentials.organizationId, orgId))
    .returning({ organizationId: aiProviderCredentials.organizationId });
  return rows.length > 0;
}
