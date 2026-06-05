import {
  addTopupCredits,
  createDodoClient,
  createDodoCustomer,
  grantMonthlyForPlan,
  type DodoClient,
  type DodoWebhookEvent,
} from '@graft/billing';
import {
  findByDodoCustomerId,
  getCreditBalance,
  getOrgSubscription,
  hasAiProviderKey,
  upsertOrgSubscription,
  type Database,
} from '@graft/db';
import {
  ESTIMATED_CHARGE_PER_MESSAGE_MICRO_USD,
  LOW_BALANCE_THRESHOLD_MICRO_USD,
  MICRO_USD_PER_USD,
  TOPUP_PACK_USD,
  type BillingPlan,
  type BillingSummary,
  type SubscriptionStatus,
  type TopupPack,
} from '@graft/shared';
import type { Logger } from '@graft/observability';
import type { GatewayEnv } from '../env.js';

/** Dodo client + product-id maps, or null when billing is not configured for this env. */
export interface DodoConfig {
  client: DodoClient;
  subscriptionProductId: (plan: BillingPlan) => string | undefined;
  planForProduct: (productId: string) => BillingPlan | undefined;
  topupProductId: (pack: TopupPack) => string | undefined;
}

export function buildDodoConfig(env: GatewayEnv): DodoConfig | null {
  if (!env.DODO_PAYMENTS_API_KEY || !env.DODO_PAYMENTS_WEBHOOK_KEY) return null;
  const client = createDodoClient({
    apiKey: env.DODO_PAYMENTS_API_KEY,
    webhookKey: env.DODO_PAYMENTS_WEBHOOK_KEY,
    environment: env.DODO_ENVIRONMENT,
  });
  const subMap: Record<BillingPlan, string | undefined> = {
    STARTER: undefined,
    PRO: env.DODO_PRODUCT_PRO,
    SCALE: env.DODO_PRODUCT_SCALE,
  };
  const topMap: Record<TopupPack, string | undefined> = {
    SMALL: env.DODO_TOPUP_SMALL,
    MEDIUM: env.DODO_TOPUP_MEDIUM,
    LARGE: env.DODO_TOPUP_LARGE,
  };
  return {
    client,
    subscriptionProductId: (plan) => subMap[plan],
    planForProduct: (productId) =>
      (Object.keys(subMap) as BillingPlan[]).find((p) => subMap[p] === productId),
    topupProductId: (pack) => topMap[pack],
  };
}

/** Builds the dashboard billing summary from the local ledger + subscription state. */
export async function buildBillingSummary(db: Database, orgId: string): Promise<BillingSummary> {
  const [sub, balance, hasOwnKey] = await Promise.all([
    getOrgSubscription(db, orgId),
    getCreditBalance(db, orgId),
    hasAiProviderKey(db, orgId),
  ]);
  const balanceMicroUsd = balance.balanceMicroUsd;
  return {
    plan: sub.plan,
    pricingMode: sub.pricingMode,
    subscriptionStatus: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    balanceMicroUsd,
    balanceUsd: balanceMicroUsd / MICRO_USD_PER_USD,
    estimatedMessages: Math.max(
      0,
      Math.floor(balanceMicroUsd / ESTIMATED_CHARGE_PER_MESSAGE_MICRO_USD),
    ),
    lowBalance: balanceMicroUsd < LOW_BALANCE_THRESHOLD_MICRO_USD,
    hasOwnKey,
  };
}

/**
 * Returns the org's Dodo customer id, creating (and persisting) one on first use. The
 * customer links every checkout/subscription back to the org.
 */
export async function ensureDodoCustomer(
  db: Database,
  dodo: DodoConfig,
  args: { orgId: string; email: string; name: string },
): Promise<string> {
  const sub = await getOrgSubscription(db, args.orgId);
  if (sub.dodoCustomerId) return sub.dodoCustomerId;
  const customerId = await createDodoCustomer(dodo.client, { email: args.email, name: args.name });
  await upsertOrgSubscription(db, args.orgId, { dodoCustomerId: customerId });
  return customerId;
}

/** Minimal shapes we read off the (typed) Dodo webhook payloads. */
interface SubscriptionData {
  subscription_id: string;
  product_id: string;
  next_billing_date?: string;
  customer: { customer_id: string };
  metadata?: Record<string, string>;
}
interface PaymentData {
  payment_id: string;
  customer: { customer_id: string };
  metadata?: Record<string, string>;
}

const DODO_STATUS: Record<string, SubscriptionStatus> = {
  'subscription.active': 'active',
  'subscription.renewed': 'active',
  'subscription.on_hold': 'on_hold',
  'subscription.cancelled': 'cancelled',
  'subscription.expired': 'expired',
};

/**
 * Applies one verified Dodo webhook to the local subscription + credit ledger. All credit
 * mutations are idempotent (keyed on the Dodo event id / subscription period / payment id),
 * so Dodo's at-least-once delivery never double-applies.
 */
export async function handleDodoEvent(
  db: Database,
  dodo: DodoConfig,
  event: DodoWebhookEvent,
  logger: Logger,
): Promise<void> {
  const type = event.type;

  if (type.startsWith('subscription.')) {
    const data = event.data as unknown as SubscriptionData;
    const orgId = await resolveOrg(db, data.metadata, data.customer.customer_id);
    if (!orgId) {
      logger.warn({ type, customerId: data.customer.customer_id }, 'webhook: org not found');
      return;
    }
    const plan = dodo.planForProduct(data.product_id);
    const status = DODO_STATUS[type];
    await upsertOrgSubscription(db, orgId, {
      ...(plan ? { plan } : {}),
      ...(status ? { status } : {}),
      dodoSubscriptionId: data.subscription_id,
      dodoCustomerId: data.customer.customer_id,
      ...(data.next_billing_date ? { currentPeriodEnd: new Date(data.next_billing_date) } : {}),
    });

    // Grant (reset) the monthly allowance on activation/renewal, once per billing period.
    if ((type === 'subscription.active' || type === 'subscription.renewed') && plan) {
      await grantMonthlyForPlan(db, {
        organizationId: orgId,
        plan,
        sourceRef: data.subscription_id,
        idempotencyKey: `dodo:sub:${data.subscription_id}:${data.next_billing_date ?? event.business_id}`,
      });
    }
    return;
  }

  if (type === 'payment.succeeded') {
    const data = event.data as unknown as PaymentData;
    const pack = data.metadata?.pack as TopupPack | undefined;
    // Subscription renewals also emit payment.succeeded — those carry no `pack` and are
    // handled by the subscription events above. Only top-up payments add credits here.
    if (!pack || !(pack in TOPUP_PACK_USD)) return;
    const orgId = await resolveOrg(db, data.metadata, data.customer.customer_id);
    if (!orgId) {
      logger.warn({ type, paymentId: data.payment_id }, 'webhook: org not found for top-up');
      return;
    }
    await addTopupCredits(db, {
      organizationId: orgId,
      amountMicroUsd: TOPUP_PACK_USD[pack] * MICRO_USD_PER_USD,
      sourceRef: data.payment_id,
      description: `Credit top-up (${pack})`,
      idempotencyKey: `dodo:pay:${data.payment_id}`,
    });
  }
}

/** Prefers the org id we stamped in checkout metadata; falls back to the Dodo customer link. */
async function resolveOrg(
  db: Database,
  metadata: Record<string, string> | undefined,
  customerId: string,
): Promise<string | undefined> {
  const fromMeta = metadata?.organizationId;
  if (fromMeta) return fromMeta;
  const sub = await findByDodoCustomerId(db, customerId);
  return sub?.organizationId;
}
