import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { AuthCodePurpose } from '@graft/shared';
import type { Database } from '../client.js';
import { authCodes } from '../schema/auth-codes.js';

export type AuthCodeRow = typeof authCodes.$inferSelect;

export interface CreateAuthCodeInput {
  userId: string;
  purpose: AuthCodePurpose;
  codeHash: string;
  expiresAt: Date;
}

/**
 * Issues a fresh code for a (user, purpose), discarding any previous codes so at
 * most one is active at a time.
 */
export async function createAuthCode(
  db: Database,
  input: CreateAuthCodeInput,
): Promise<AuthCodeRow> {
  return db.transaction(async (tx) => {
    await tx
      .delete(authCodes)
      .where(and(eq(authCodes.userId, input.userId), eq(authCodes.purpose, input.purpose)));
    const [row] = await tx
      .insert(authCodes)
      .values({
        userId: input.userId,
        purpose: input.purpose,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
      })
      .returning();
    if (!row) throw new Error('failed to create auth code');
    return row;
  });
}

/** Latest unconsumed, unexpired code for a (user, purpose), if any. */
export async function findActiveAuthCode(
  db: Database,
  userId: string,
  purpose: AuthCodePurpose,
): Promise<AuthCodeRow | undefined> {
  return db.query.authCodes.findFirst({
    where: and(
      eq(authCodes.userId, userId),
      eq(authCodes.purpose, purpose),
      isNull(authCodes.consumedAt),
      gt(authCodes.expiresAt, new Date()),
    ),
    orderBy: desc(authCodes.createdAt),
  });
}

export async function incrementAuthCodeAttempts(db: Database, id: string): Promise<number> {
  const [row] = await db
    .update(authCodes)
    .set({ attempts: sql`${authCodes.attempts} + 1` })
    .where(eq(authCodes.id, id))
    .returning({ attempts: authCodes.attempts });
  return row?.attempts ?? 0;
}

export async function consumeAuthCode(db: Database, id: string): Promise<void> {
  await db.update(authCodes).set({ consumedAt: new Date() }).where(eq(authCodes.id, id));
}
