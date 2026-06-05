import { pgTable, uuid, bigint, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { ledgerEntryTypePgEnum } from './enums.js';

/**
 * Append-only credit audit log. Every grant, top-up, usage debit, expiry, adjustment, and
 * refund is one row, with the running balance captured at write time. `idempotencyKey`
 * is unique so replayed Dodo webhooks and retried usage debits never double-apply.
 */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    entryType: ledgerEntryTypePgEnum('entry_type').notNull(),
    /** Signed delta in micro-USD (credits positive, debits negative). */
    amountMicroUsd: bigint('amount_micro_usd', { mode: 'number' }).notNull(),
    balanceAfterMicroUsd: bigint('balance_after_micro_usd', { mode: 'number' }).notNull(),
    /** `dodo_subscription` | `dodo_payment` | `usage` | `admin` | `system`. */
    source: text('source').notNull(),
    /** Originating reference: Dodo event/payment/subscription id, or ai_inference id. */
    sourceRef: text('source_ref'),
    description: text('description'),
    /** Dedup key; a repeated webhook or retried debit with the same key is ignored. */
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('credit_ledger_idempotency_idx').on(t.idempotencyKey),
    index('credit_ledger_org_created_idx').on(t.organizationId, t.createdAt),
  ],
);
