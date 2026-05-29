import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { authCodePurposePgEnum } from './enums.js';

/**
 * One-time codes for email verification and password reset. The plaintext code
 * is emailed to the user; only its hash is stored. A code is single-use
 * (`consumedAt`), time-boxed (`expiresAt`), and attempt-capped (`attempts`).
 */
export const authCodes = pgTable(
  'auth_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: authCodePurposePgEnum('purpose').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('auth_codes_user_purpose_idx').on(t.userId, t.purpose)],
);
