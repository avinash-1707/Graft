import { eq } from 'drizzle-orm';
import { LedgerEntryType, type LedgerEntryType as LedgerEntryTypeT } from '@graft/shared';
import type { Database } from '../client.js';
import { orgCreditBalance } from '../schema/credit-balance.js';
import { creditLedger } from '../schema/credit-ledger.js';

/** The transaction handle drizzle hands to `db.transaction(cb)`. */
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface CreditBalanceRow {
  monthlyBalanceMicroUsd: number;
  rolloverBalanceMicroUsd: number;
  /** Convenience total = monthly + rollover. This is what the gate and UI use. */
  balanceMicroUsd: number;
  lifetimeGrantedMicroUsd: number;
  lifetimeSpentMicroUsd: number;
}

const ZERO: Omit<CreditBalanceRow, 'balanceMicroUsd'> = {
  monthlyBalanceMicroUsd: 0,
  rolloverBalanceMicroUsd: 0,
  lifetimeGrantedMicroUsd: 0,
  lifetimeSpentMicroUsd: 0,
};

function withTotal(row: Omit<CreditBalanceRow, 'balanceMicroUsd'>): CreditBalanceRow {
  return { ...row, balanceMicroUsd: row.monthlyBalanceMicroUsd + row.rolloverBalanceMicroUsd };
}

/** Reads the org's balance; returns zeros if no row exists yet. */
export async function getCreditBalance(db: Database, orgId: string): Promise<CreditBalanceRow> {
  const row = await db.query.orgCreditBalance.findFirst({
    where: eq(orgCreditBalance.organizationId, orgId),
    columns: {
      monthlyBalanceMicroUsd: true,
      rolloverBalanceMicroUsd: true,
      lifetimeGrantedMicroUsd: true,
      lifetimeSpentMicroUsd: true,
    },
  });
  return withTotal(row ?? ZERO);
}

interface LedgerRowInput {
  entryType: LedgerEntryTypeT;
  amountMicroUsd: number; // signed, for the ledger record
  source: string;
  sourceRef?: string | null | undefined;
  description?: string | null | undefined;
  idempotencyKey: string;
}

export interface LedgerApplyResult {
  /** False when the idempotency key was already applied (no change made now). */
  applied: boolean;
  balanceMicroUsd: number;
}

/** Internal: locks the balance row (creating it if absent) and returns the live values. */
async function lockBalance(
  tx: Tx,
  orgId: string,
): Promise<Omit<CreditBalanceRow, 'balanceMicroUsd'>> {
  await tx.insert(orgCreditBalance).values({ organizationId: orgId }).onConflictDoNothing();
  const [locked] = await tx
    .select()
    .from(orgCreditBalance)
    .where(eq(orgCreditBalance.organizationId, orgId))
    .for('update');
  return locked
    ? {
        monthlyBalanceMicroUsd: locked.monthlyBalanceMicroUsd,
        rolloverBalanceMicroUsd: locked.rolloverBalanceMicroUsd,
        lifetimeGrantedMicroUsd: locked.lifetimeGrantedMicroUsd,
        lifetimeSpentMicroUsd: locked.lifetimeSpentMicroUsd,
      }
    : { ...ZERO };
}

async function alreadyApplied(tx: Tx, key: string): Promise<boolean> {
  const existing = await tx.query.creditLedger.findFirst({
    where: eq(creditLedger.idempotencyKey, key),
    columns: { id: true },
  });
  return existing !== undefined;
}

async function insertLedger(
  tx: Tx,
  orgId: string,
  balanceAfter: number,
  row: LedgerRowInput,
): Promise<void> {
  await tx.insert(creditLedger).values({
    organizationId: orgId,
    entryType: row.entryType,
    amountMicroUsd: row.amountMicroUsd,
    balanceAfterMicroUsd: balanceAfter,
    source: row.source,
    sourceRef: row.sourceRef ?? null,
    description: row.description ?? null,
    idempotencyKey: row.idempotencyKey,
  });
}

export interface SpendInput {
  organizationId: string;
  /** Positive amount to deduct, micro-USD. */
  amountMicroUsd: number;
  sourceRef?: string | null;
  description?: string | null;
  idempotencyKey: string;
}

/**
 * Debits a metered AI charge. Draws from the monthly allowance first, then rollover
 * credits (which may go negative for the one in-flight overdraft turn). Atomic + idempotent.
 */
export async function spendCredits(db: Database, input: SpendInput): Promise<LedgerApplyResult> {
  return db.transaction(async (tx) => {
    const cur = await lockBalance(tx, input.organizationId);
    if (await alreadyApplied(tx, input.idempotencyKey)) {
      return { applied: false, balanceMicroUsd: cur.monthlyBalanceMicroUsd + cur.rolloverBalanceMicroUsd };
    }
    const fromMonthly = Math.min(Math.max(cur.monthlyBalanceMicroUsd, 0), input.amountMicroUsd);
    const fromRollover = input.amountMicroUsd - fromMonthly;
    const newMonthly = cur.monthlyBalanceMicroUsd - fromMonthly;
    const newRollover = cur.rolloverBalanceMicroUsd - fromRollover;
    await tx
      .update(orgCreditBalance)
      .set({
        monthlyBalanceMicroUsd: newMonthly,
        rolloverBalanceMicroUsd: newRollover,
        lifetimeSpentMicroUsd: cur.lifetimeSpentMicroUsd + input.amountMicroUsd,
        updatedAt: new Date(),
      })
      .where(eq(orgCreditBalance.organizationId, input.organizationId));
    const total = newMonthly + newRollover;
    await insertLedger(tx, input.organizationId, total, {
      entryType: LedgerEntryType.USAGE_DEBIT,
      amountMicroUsd: -input.amountMicroUsd,
      source: 'usage',
      sourceRef: input.sourceRef,
      description: input.description ?? 'AI usage',
      idempotencyKey: input.idempotencyKey,
    });
    return { applied: true, balanceMicroUsd: total };
  });
}

export interface AddRolloverInput {
  organizationId: string;
  /** Positive amount to add, micro-USD. */
  amountMicroUsd: number;
  entryType: Extract<LedgerEntryTypeT, 'TOPUP' | 'REFUND' | 'ADJUST'>;
  source: string;
  sourceRef?: string | null;
  description?: string | null;
  idempotencyKey: string;
}

/** Adds persistent (rollover) credits: top-ups, refunds, admin adjustments. Atomic + idempotent. */
export async function addRolloverCredits(
  db: Database,
  input: AddRolloverInput,
): Promise<LedgerApplyResult> {
  return db.transaction(async (tx) => {
    const cur = await lockBalance(tx, input.organizationId);
    if (await alreadyApplied(tx, input.idempotencyKey)) {
      return { applied: false, balanceMicroUsd: cur.monthlyBalanceMicroUsd + cur.rolloverBalanceMicroUsd };
    }
    const newRollover = cur.rolloverBalanceMicroUsd + input.amountMicroUsd;
    await tx
      .update(orgCreditBalance)
      .set({
        rolloverBalanceMicroUsd: newRollover,
        lifetimeGrantedMicroUsd: cur.lifetimeGrantedMicroUsd + Math.max(input.amountMicroUsd, 0),
        updatedAt: new Date(),
      })
      .where(eq(orgCreditBalance.organizationId, input.organizationId));
    const total = cur.monthlyBalanceMicroUsd + newRollover;
    await insertLedger(tx, input.organizationId, total, {
      entryType: input.entryType,
      amountMicroUsd: input.amountMicroUsd,
      source: input.source,
      sourceRef: input.sourceRef,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
    });
    return { applied: true, balanceMicroUsd: total };
  });
}

export interface ResetMonthlyInput {
  organizationId: string;
  /** New monthly allowance to set, micro-USD. */
  allowanceMicroUsd: number;
  sourceRef?: string | null;
  description?: string | null;
  /** Base idempotency key; the forfeiture entry derives `${key}:expire`. */
  idempotencyKey: string;
}

/**
 * Resets the monthly allowance at a billing-cycle boundary: forfeits any unused monthly
 * balance (EXPIRE) and grants the new allowance (GRANT_MONTHLY). Rollover credits are
 * untouched. Atomic + idempotent on `idempotencyKey`.
 */
export async function resetMonthlyCredits(
  db: Database,
  input: ResetMonthlyInput,
): Promise<LedgerApplyResult> {
  return db.transaction(async (tx) => {
    const cur = await lockBalance(tx, input.organizationId);
    if (await alreadyApplied(tx, input.idempotencyKey)) {
      return { applied: false, balanceMicroUsd: cur.monthlyBalanceMicroUsd + cur.rolloverBalanceMicroUsd };
    }
    const forfeited = Math.max(cur.monthlyBalanceMicroUsd, 0);
    if (forfeited > 0) {
      const afterExpire = cur.rolloverBalanceMicroUsd; // monthly now 0
      await insertLedger(tx, input.organizationId, afterExpire, {
        entryType: LedgerEntryType.EXPIRE,
        amountMicroUsd: -forfeited,
        source: 'system',
        sourceRef: input.sourceRef,
        description: 'Unused monthly credits expired',
        idempotencyKey: `${input.idempotencyKey}:expire`,
      });
    }
    const total = input.allowanceMicroUsd + cur.rolloverBalanceMicroUsd;
    await tx
      .update(orgCreditBalance)
      .set({
        monthlyBalanceMicroUsd: input.allowanceMicroUsd,
        lifetimeGrantedMicroUsd: cur.lifetimeGrantedMicroUsd + Math.max(input.allowanceMicroUsd, 0),
        updatedAt: new Date(),
      })
      .where(eq(orgCreditBalance.organizationId, input.organizationId));
    await insertLedger(tx, input.organizationId, total, {
      entryType: LedgerEntryType.GRANT_MONTHLY,
      amountMicroUsd: input.allowanceMicroUsd,
      source: input.sourceRef ? 'dodo_subscription' : 'system',
      sourceRef: input.sourceRef,
      description: input.description ?? 'Monthly credits',
      idempotencyKey: input.idempotencyKey,
    });
    return { applied: true, balanceMicroUsd: total };
  });
}

export interface CreditLedgerEntryRow {
  id: string;
  organizationId: string;
  entryType: LedgerEntryTypeT;
  amountMicroUsd: number;
  balanceAfterMicroUsd: number;
  source: string;
  description: string | null;
  createdAt: Date;
}

/** Most-recent ledger entries for the dashboard history table. */
export async function listCreditLedger(
  db: Database,
  orgId: string,
  limit = 50,
): Promise<CreditLedgerEntryRow[]> {
  return db.query.creditLedger.findMany({
    where: eq(creditLedger.organizationId, orgId),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
    limit,
    columns: {
      id: true,
      organizationId: true,
      entryType: true,
      amountMicroUsd: true,
      balanceAfterMicroUsd: true,
      source: true,
      description: true,
      createdAt: true,
    },
  });
}
