import { eq } from 'drizzle-orm';
import type { BillingPlan } from '@graft/shared';
import type { Database } from '../client.js';
import { billingPlans } from '../schema/billing-plans.js';

export interface BillingPlanRow {
  id: BillingPlan;
  name: string;
  dodoProductId: string | null;
  monthlyPriceMicroUsd: number;
  includedCreditsMicroUsd: number;
  markupBps: number;
  byokAllowed: boolean;
  topupAllowed: boolean;
}

export async function getBillingPlan(
  db: Database,
  plan: BillingPlan,
): Promise<BillingPlanRow | undefined> {
  return db.query.billingPlans.findFirst({ where: eq(billingPlans.id, plan) });
}

export async function listBillingPlans(db: Database): Promise<BillingPlanRow[]> {
  return db.query.billingPlans.findMany({ orderBy: (p, { asc }) => [asc(p.monthlyPriceMicroUsd)] });
}
