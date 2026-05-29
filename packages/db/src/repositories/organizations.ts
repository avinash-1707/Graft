import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { organizations } from '../schema/organizations.js';

export type OrganizationRow = typeof organizations.$inferSelect;

export async function findOrganizationByEmbedToken(
  db: Database,
  embedToken: string,
): Promise<OrganizationRow | undefined> {
  return db.query.organizations.findFirst({
    where: eq(organizations.embedToken, embedToken),
  });
}

export async function getEmbedToken(db: Database, orgId: string): Promise<string | undefined> {
  const row = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { embedToken: true },
  });
  return row?.embedToken;
}

/** Replaces the org's embed token; any widget using the old token stops resolving. */
export async function rotateEmbedToken(
  db: Database,
  orgId: string,
  newToken: string,
): Promise<string> {
  const [row] = await db
    .update(organizations)
    .set({ embedToken: newToken, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning({ embedToken: organizations.embedToken });
  if (!row) throw new Error('organization not found');
  return row.embedToken;
}
