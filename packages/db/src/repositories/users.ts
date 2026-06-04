import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { users } from '../schema/auth.js';

export type UserRow = typeof users.$inferSelect;

export async function findUserByEmail(db: Database, email: string): Promise<UserRow | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

export async function findUserById(db: Database, id: string): Promise<UserRow | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

/**
 * Marks a user's email verified. Used by the agent-accept flow: setting a password
 * via the invite OTP proves control of the address, so we flip `emailVerified`.
 */
export async function markEmailVerified(db: Database, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Lists an org's customer-support-agents (owners excluded), oldest first. */
export async function listAgentsByOrg(db: Database, orgId: string): Promise<UserRow[]> {
  return db.query.users.findMany({
    where: and(eq(users.organizationId, orgId), eq(users.role, 'CUSTOMER_SUPPORT_AGENT')),
    orderBy: asc(users.createdAt),
  });
}

/** Finds an agent by id, scoped to the org and the agent role (cross-tenant guard). */
export async function findAgentByIdForOrg(
  db: Database,
  orgId: string,
  userId: string,
): Promise<UserRow | undefined> {
  return db.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      eq(users.organizationId, orgId),
      eq(users.role, 'CUSTOMER_SUPPORT_AGENT'),
    ),
  });
}

/** Deletes an agent scoped to the org + agent role. Returns true if a row was removed. */
export async function deleteAgentForOrg(
  db: Database,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.organizationId, orgId),
        eq(users.role, 'CUSTOMER_SUPPORT_AGENT'),
      ),
    )
    .returning({ id: users.id });
  return rows.length > 0;
}
