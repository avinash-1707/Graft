import { eq } from 'drizzle-orm';
import type { EscalationConfig } from '@graft/shared';
import type { Database } from '../client.js';
import { escalationConfigs } from '../schema/escalation-configs.js';

export type EscalationConfigRow = typeof escalationConfigs.$inferSelect;

/** Returns the org's escalation config row, or undefined when never customized. */
export async function getEscalationConfig(
  db: Database,
  orgId: string,
): Promise<EscalationConfigRow | undefined> {
  return db.query.escalationConfigs.findFirst({
    where: eq(escalationConfigs.organizationId, orgId),
  });
}

/** Full-document upsert of the org's escalation config (org is the PK). */
export async function upsertEscalationConfig(
  db: Database,
  orgId: string,
  config: EscalationConfig,
): Promise<void> {
  await db
    .insert(escalationConfigs)
    .values({ organizationId: orgId, ...config, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: escalationConfigs.organizationId,
      set: { ...config, updatedAt: new Date() },
    });
}
