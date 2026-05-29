import { eq } from 'drizzle-orm';
import type { ChatProvider, EmbeddingProvider } from '@graft/shared';
import type { Database } from '../client.js';
import { aiSettings } from '../schema/ai-settings.js';

export interface AiSettingsRow {
  chatProvider: ChatProvider | null;
  embeddingProvider: EmbeddingProvider | null;
}

/** Returns the org's provider selections, or nulls if no row exists yet. */
export async function getAiSettings(db: Database, orgId: string): Promise<AiSettingsRow> {
  const row = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, orgId),
    columns: { chatProvider: true, embeddingProvider: true },
  });
  return {
    chatProvider: (row?.chatProvider as ChatProvider | null | undefined) ?? null,
    embeddingProvider: (row?.embeddingProvider as EmbeddingProvider | null | undefined) ?? null,
  };
}

/** Full-document upsert of the org's provider selections (one row per org). */
export async function upsertAiSettings(
  db: Database,
  orgId: string,
  settings: AiSettingsRow,
): Promise<void> {
  await db
    .insert(aiSettings)
    .values({
      organizationId: orgId,
      chatProvider: settings.chatProvider,
      embeddingProvider: settings.embeddingProvider,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: aiSettings.organizationId,
      set: {
        chatProvider: settings.chatProvider,
        embeddingProvider: settings.embeddingProvider,
        updatedAt: new Date(),
      },
    });
}
