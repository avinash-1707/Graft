import { z } from 'zod';

/**
 * Credit-ledger entry kinds. The ledger is append-only; the sign of `amount_micro_usd`
 * follows the type (grants/top-ups/refunds positive, usage/expiry negative; ADJUST
 * either way).
 * - `GRANT_MONTHLY`: a tier's included monthly allowance (reset each cycle).
 * - `TOPUP`: a purchased pay-as-you-go credit pack (rolls over).
 * - `USAGE_DEBIT`: one metered AI call (token cost × markup).
 * - `EXPIRE`: forfeited allowance at cycle reset.
 * - `ADJUST`: manual admin correction.
 * - `REFUND`: reversal of a charge or a refunded payment.
 */
export const ledgerEntryTypeSchema = z.enum([
  'GRANT_MONTHLY',
  'TOPUP',
  'USAGE_DEBIT',
  'EXPIRE',
  'ADJUST',
  'REFUND',
]);

export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>;
export const LedgerEntryType = ledgerEntryTypeSchema.enum;

export const LEDGER_ENTRY_TYPES = ledgerEntryTypeSchema.options;
