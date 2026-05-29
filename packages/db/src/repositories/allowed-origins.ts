import { and, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { allowedOrigins } from '../schema/organizations.js';

export type AllowedOriginRow = typeof allowedOrigins.$inferSelect;

export async function listAllowedOrigins(
  db: Database,
  orgId: string,
): Promise<AllowedOriginRow[]> {
  return db.query.allowedOrigins.findMany({
    where: eq(allowedOrigins.organizationId, orgId),
  });
}

/** True if `origin` is registered for the org. Used by the widget validation path. */
export async function isOriginAllowed(
  db: Database,
  orgId: string,
  origin: string,
): Promise<boolean> {
  const row = await db.query.allowedOrigins.findFirst({
    where: and(eq(allowedOrigins.organizationId, orgId), eq(allowedOrigins.origin, origin)),
    columns: { id: true },
  });
  return row !== undefined;
}

/** Adds an origin; idempotent on the unique (org, origin) constraint. */
export async function addAllowedOrigin(
  db: Database,
  orgId: string,
  origin: string,
): Promise<AllowedOriginRow | undefined> {
  const [row] = await db
    .insert(allowedOrigins)
    .values({ organizationId: orgId, origin })
    .onConflictDoNothing({ target: [allowedOrigins.organizationId, allowedOrigins.origin] })
    .returning();
  return row;
}

/** Deletes an origin scoped to the org; returns true if a row was removed. */
export async function deleteAllowedOrigin(
  db: Database,
  orgId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(allowedOrigins)
    .where(and(eq(allowedOrigins.id, id), eq(allowedOrigins.organizationId, orgId)))
    .returning({ id: allowedOrigins.id });
  return rows.length > 0;
}
