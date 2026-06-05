import { z } from 'zod';
import { ledgerEntryTypeSchema } from '../enums/ledger-entry-type.js';
import { organizationIdSchema, uuidSchema } from './ids.js';

export const creditLedgerEntryIdSchema = uuidSchema.brand<'CreditLedgerEntryId'>();
export type CreditLedgerEntryId = z.infer<typeof creditLedgerEntryIdSchema>;

/** One immutable credit-ledger row, as shown in the dashboard history table. */
export const creditLedgerEntrySchema = z.object({
  id: creditLedgerEntryIdSchema,
  organizationId: organizationIdSchema,
  entryType: ledgerEntryTypeSchema,
  /** Signed delta in micro-USD (positive = credit, negative = debit). */
  amountMicroUsd: z.int(),
  balanceAfterMicroUsd: z.int(),
  /** Origin of the entry: `dodo_subscription` | `dodo_payment` | `usage` | `admin` | `system`. */
  source: z.string().min(1).max(32),
  /** Free-text label for the UI (e.g. "Monthly Pro credits", "AI usage"). */
  description: z.string().max(160).nullable(),
  createdAt: z.iso.datetime(),
});
export type CreditLedgerEntry = z.infer<typeof creditLedgerEntrySchema>;

export const creditBalanceSchema = z.object({
  balanceMicroUsd: z.int(),
  lifetimeGrantedMicroUsd: z.int().nonnegative(),
  lifetimeSpentMicroUsd: z.int().nonnegative(),
});
export type CreditBalance = z.infer<typeof creditBalanceSchema>;

export const creditLedgerPageSchema = z.object({
  entries: z.array(creditLedgerEntrySchema),
});
export type CreditLedgerPage = z.infer<typeof creditLedgerPageSchema>;
