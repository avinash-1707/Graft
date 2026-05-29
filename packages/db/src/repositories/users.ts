import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { organizations } from '../schema/organizations.js';
import { users } from '../schema/users.js';
import type { OrganizationRow } from './organizations.js';

export type UserRow = typeof users.$inferSelect;

export interface CreateOrgWithOwnerInput {
  organizationName: string;
  embedToken: string;
  owner: {
    email: string;
    passwordHash: string;
    name: string;
  };
}

/**
 * Creates an organization and its first user (the owner) atomically. The owner
 * starts with an unverified email (`emailVerifiedAt = null`).
 */
export async function createOrganizationWithOwner(
  db: Database,
  input: CreateOrgWithOwnerInput,
): Promise<{ organization: OrganizationRow; user: UserRow }> {
  return db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({ name: input.organizationName, embedToken: input.embedToken })
      .returning();
    if (!organization) throw new Error('failed to create organization');

    const [user] = await tx
      .insert(users)
      .values({
        organizationId: organization.id,
        email: input.owner.email,
        passwordHash: input.owner.passwordHash,
        name: input.owner.name,
        role: 'OWNER',
      })
      .returning();
    if (!user) throw new Error('failed to create owner user');

    return { organization, user };
  });
}

export async function findUserByEmail(db: Database, email: string): Promise<UserRow | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

export async function findUserById(db: Database, id: string): Promise<UserRow | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

export async function markEmailVerified(db: Database, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateUserPasswordHash(
  db: Database,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
