import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { organizations } from '../schema/organizations.js';

export type OrganizationRow = typeof organizations.$inferSelect;

/**
 * Creates an organization (no owner). Better Auth creates the owner user
 * separately; the signup route stamps that user's `organizationId` to this row.
 */
export async function createOrganization(
  db: Database,
  input: { name: string; embedToken: string },
): Promise<OrganizationRow> {
  const [row] = await db
    .insert(organizations)
    .values({ name: input.name, embedToken: input.embedToken })
    .returning();
  if (!row) throw new Error('failed to create organization');
  return row;
}

/** Deletes an organization by id (cascades to its users). Cleanup on signup failure. */
export async function deleteOrganization(db: Database, orgId: string): Promise<void> {
  await db.delete(organizations).where(eq(organizations.id, orgId));
}

export async function findOrganizationByEmbedToken(
  db: Database,
  embedToken: string,
): Promise<OrganizationRow | undefined> {
  return db.query.organizations.findFirst({
    where: eq(organizations.embedToken, embedToken),
  });
}

export async function getOrganizationName(
  db: Database,
  orgId: string,
): Promise<string | undefined> {
  const row = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { name: true },
  });
  return row?.name;
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
