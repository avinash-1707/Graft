import { and, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { sessions } from '../schema/sessions.js';

export type SessionRow = typeof sessions.$inferSelect;

/** Creates a new anonymous session bound to the org; id is server-minted. */
export async function createSession(db: Database, orgId: string): Promise<SessionRow> {
  const [row] = await db.insert(sessions).values({ organizationId: orgId }).returning();
  if (!row) throw new Error('failed to create session');
  return row;
}

/** Returns the session only if it exists AND belongs to the org (cross-tenant guard). */
export async function findSessionForOrg(
  db: Database,
  id: string,
  orgId: string,
): Promise<SessionRow | undefined> {
  return db.query.sessions.findFirst({
    where: and(eq(sessions.id, id), eq(sessions.organizationId, orgId)),
  });
}

export async function touchSession(db: Database, id: string): Promise<void> {
  await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id));
}
