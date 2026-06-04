import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { aiSettings } from '../schema/ai-settings.js';

export interface AiSettingsRow {
  chatModel: string | null;
  embeddingModel: string | null;
}

/** Returns the org's model selections, or nulls if no row exists yet. */
export async function getAiSettings(db: Database, orgId: string): Promise<AiSettingsRow> {
  const row = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, orgId),
    columns: { chatModel: true, embeddingModel: true },
  });
  return {
    chatModel: row?.chatModel ?? null,
    embeddingModel: row?.embeddingModel ?? null,
  };
}

/** Full-document upsert of the org's model selections (one row per org). */
export async function upsertAiSettings(
  db: Database,
  orgId: string,
  settings: AiSettingsRow,
): Promise<void> {
  await db
    .insert(aiSettings)
    .values({
      organizationId: orgId,
      chatModel: settings.chatModel,
      embeddingModel: settings.embeddingModel,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: aiSettings.organizationId,
      set: {
        chatModel: settings.chatModel,
        embeddingModel: settings.embeddingModel,
        updatedAt: new Date(),
      },
    });
}
