import { eq } from 'drizzle-orm';
import type { BillingPlan, PricingMode, SubscriptionStatus } from '@graft/shared';
import type { Database } from '../client.js';
import { orgSubscription } from '../schema/org-subscription.js';

export interface OrgSubscriptionRow {
  organizationId: string;
  plan: BillingPlan;
  pricingMode: PricingMode;
  status: SubscriptionStatus;
  dodoCustomerId: string | null;
  dodoSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
}

const DEFAULT_ROW: Omit<OrgSubscriptionRow, 'organizationId'> = {
  plan: 'STARTER',
  pricingMode: 'CREDITS',
  status: 'none',
  dodoCustomerId: null,
  dodoSubscriptionId: null,
  currentPeriodEnd: null,
};

/** Reads the org's subscription, falling back to the free-tier defaults if no row exists. */
export async function getOrgSubscription(
  db: Database,
  orgId: string,
): Promise<OrgSubscriptionRow> {
  const row = await db.query.orgSubscription.findFirst({
    where: eq(orgSubscription.organizationId, orgId),
  });
  return row ? toRow(row) : { organizationId: orgId, ...DEFAULT_ROW };
}

/** Ensures a row exists (idempotent); used at signup/backfill so every org has defaults. */
export async function ensureOrgSubscription(db: Database, orgId: string): Promise<void> {
  await db.insert(orgSubscription).values({ organizationId: orgId }).onConflictDoNothing();
}

/**
 * Org ids on the free tier (no Dodo subscription, `status = 'none'`). The monthly-grant
 * cron tops these up; paid tiers are granted via Dodo renewal webhooks instead.
 */
export async function listFreeTierOrgIds(db: Database): Promise<string[]> {
  const rows = await db.query.orgSubscription.findMany({
    where: eq(orgSubscription.status, 'none'),
    columns: { organizationId: true },
  });
  return rows.map((r) => r.organizationId);
}

export async function findByDodoCustomerId(
  db: Database,
  dodoCustomerId: string,
): Promise<OrgSubscriptionRow | undefined> {
  const row = await db.query.orgSubscription.findFirst({
    where: eq(orgSubscription.dodoCustomerId, dodoCustomerId),
  });
  return row ? toRow(row) : undefined;
}

export type OrgSubscriptionPatch = Partial<{
  plan: BillingPlan;
  pricingMode: PricingMode;
  status: SubscriptionStatus;
  dodoCustomerId: string | null;
  dodoSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
}>;

/** Upserts the org's subscription row with the given fields. */
export async function upsertOrgSubscription(
  db: Database,
  orgId: string,
  patch: OrgSubscriptionPatch,
): Promise<void> {
  await db
    .insert(orgSubscription)
    .values({ organizationId: orgId, ...patch, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: orgSubscription.organizationId,
      set: { ...patch, updatedAt: new Date() },
    });
}

function toRow(row: typeof orgSubscription.$inferSelect): OrgSubscriptionRow {
  return {
    organizationId: row.organizationId,
    plan: row.plan,
    pricingMode: row.pricingMode,
    status: row.status,
    dodoCustomerId: row.dodoCustomerId,
    dodoSubscriptionId: row.dodoSubscriptionId,
    currentPeriodEnd: row.currentPeriodEnd,
  };
}
