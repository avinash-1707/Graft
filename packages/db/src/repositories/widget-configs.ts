import { eq } from 'drizzle-orm';
import type { WidgetConfig } from '@graft/shared';
import type { Database } from '../client.js';
import { widgetConfigs } from '../schema/widget-configs.js';

export type WidgetConfigRow = typeof widgetConfigs.$inferSelect;

/** Returns the org's widget config row, or undefined when never customized. */
export async function getWidgetConfig(
  db: Database,
  orgId: string,
): Promise<WidgetConfigRow | undefined> {
  return db.query.widgetConfigs.findFirst({
    where: eq(widgetConfigs.organizationId, orgId),
  });
}

/** Full-document upsert of the org's widget config (org is the PK). */
export async function upsertWidgetConfig(
  db: Database,
  orgId: string,
  config: WidgetConfig,
): Promise<void> {
  await db
    .insert(widgetConfigs)
    .values({ organizationId: orgId, ...config, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: widgetConfigs.organizationId,
      set: { ...config, updatedAt: new Date() },
    });
}
