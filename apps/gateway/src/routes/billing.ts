import {
  cancelSubscription,
  changeSubscriptionPlan,
  createCheckoutUrl,
} from '@graft/billing';
import {
  getOrganizationName,
  getOrgSubscription,
  hasAiProviderKey,
  listBillingPlans,
  listCreditLedger,
  upsertOrgSubscription,
  type Database,
} from '@graft/db';
import {
  changePlanRequestSchema,
  MICRO_USD_PER_USD,
  pricingModeUpdateRequestSchema,
  subscribeCheckoutRequestSchema,
  topupCheckoutRequestSchema,
  type CheckoutSessionResponse,
  type CreditLedgerEntry,
  type CreditLedgerPage,
  type PlanConfig,
} from '@graft/shared';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { GatewayEnv } from '../env.js';
import { parseOr400 } from '../http/validate.js';
import {
  buildBillingSummary,
  ensureDodoCustomer,
  type DodoConfig,
} from '../billing/service.js';

interface BillingRouteOptions {
  db: Database;
  env: GatewayEnv;
  /** Null when Dodo is not configured for this environment. */
  dodo: DodoConfig | null;
}

/**
 * Owner-only billing surface: plan/credit summary, the pricing catalogue, Dodo checkout
 * for subscriptions + top-ups, plan changes, cancellation, and the BYOK toggle. Read
 * endpoints work without Dodo configured; checkout/change endpoints respond 503 when it
 * is not. Scope is the owner's JWT org.
 */
export const billingRoutes: FastifyPluginAsync<BillingRouteOptions> = async (app, opts) => {
  const { db, env, dodo } = opts;
  const ownerOnly = { preHandler: [app.authenticate, app.requireRole('OWNER')] };
  const returnUrl = `${env.DASHBOARD_ORIGIN}/settings/billing`;

  const dodoUnavailable = (reply: FastifyReply) =>
    reply
      .code(503)
      .send({ error: { code: 'BILLING_UNAVAILABLE', message: 'Billing is not configured.' } });

  app.get('/billing/summary', ownerOnly, async (request) => {
    return buildBillingSummary(db, request.authUser!.org);
  });

  app.get('/billing/plans', ownerOnly, async (): Promise<PlanConfig[]> => {
    const plans = await listBillingPlans(db);
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      monthlyPriceUsd: p.monthlyPriceMicroUsd / MICRO_USD_PER_USD,
      includedCreditsUsd: p.includedCreditsMicroUsd / MICRO_USD_PER_USD,
      markupBps: p.markupBps,
      byokAllowed: p.byokAllowed,
      topupAllowed: p.topupAllowed,
    }));
  });

  app.get('/billing/ledger', ownerOnly, async (request): Promise<CreditLedgerPage> => {
    const rows = await listCreditLedger(db, request.authUser!.org, 50);
    const entries: CreditLedgerEntry[] = rows.map((r) => ({
      id: r.id as CreditLedgerEntry['id'],
      organizationId: r.organizationId as CreditLedgerEntry['organizationId'],
      entryType: r.entryType,
      amountMicroUsd: r.amountMicroUsd,
      balanceAfterMicroUsd: r.balanceAfterMicroUsd,
      source: r.source,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
    }));
    return { entries };
  });

  app.post('/billing/checkout/subscribe', ownerOnly, async (request, reply) => {
    if (!dodo) return dodoUnavailable(reply);
    const data = parseOr400(subscribeCheckoutRequestSchema, request.body, reply);
    if (!data) return;
    const productId = dodo.subscriptionProductId(data.plan);
    if (!productId) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_PLAN', message: 'That plan is not purchasable.' } });
    }
    const orgId = request.authUser!.org;
    const customerId = await ensureDodoCustomer(db, dodo, {
      orgId,
      email: request.authUser!.email,
      name: (await getOrganizationName(db, orgId)) ?? request.authUser!.email,
    });
    const url = await createCheckoutUrl(dodo.client, {
      productId,
      customerId,
      returnUrl,
      metadata: { organizationId: orgId, plan: data.plan },
    });
    return reply.send({ url } satisfies CheckoutSessionResponse);
  });

  app.post('/billing/checkout/topup', ownerOnly, async (request, reply) => {
    if (!dodo) return dodoUnavailable(reply);
    const data = parseOr400(topupCheckoutRequestSchema, request.body, reply);
    if (!data) return;
    const productId = dodo.topupProductId(data.pack);
    if (!productId) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_PACK', message: 'That top-up pack is unavailable.' } });
    }
    const orgId = request.authUser!.org;
    const customerId = await ensureDodoCustomer(db, dodo, {
      orgId,
      email: request.authUser!.email,
      name: (await getOrganizationName(db, orgId)) ?? request.authUser!.email,
    });
    const url = await createCheckoutUrl(dodo.client, {
      productId,
      customerId,
      returnUrl,
      metadata: { organizationId: orgId, pack: data.pack },
    });
    return reply.send({ url } satisfies CheckoutSessionResponse);
  });

  app.post('/billing/change-plan', ownerOnly, async (request, reply) => {
    if (!dodo) return dodoUnavailable(reply);
    const data = parseOr400(changePlanRequestSchema, request.body, reply);
    if (!data) return;
    const sub = await getOrgSubscription(db, request.authUser!.org);
    if (!sub.dodoSubscriptionId) {
      return reply
        .code(409)
        .send({ error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription to change.' } });
    }
    const productId = dodo.subscriptionProductId(data.plan);
    if (!productId) {
      return reply
        .code(400)
        .send({ error: { code: 'INVALID_PLAN', message: 'That plan is not purchasable.' } });
    }
    await changeSubscriptionPlan(dodo.client, sub.dodoSubscriptionId, productId);
    return reply.code(202).send({ ok: true });
  });

  app.post('/billing/cancel', ownerOnly, async (request, reply) => {
    if (!dodo) return dodoUnavailable(reply);
    const sub = await getOrgSubscription(db, request.authUser!.org);
    if (!sub.dodoSubscriptionId) {
      return reply
        .code(409)
        .send({ error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription to cancel.' } });
    }
    await cancelSubscription(dodo.client, sub.dodoSubscriptionId);
    return reply.code(202).send({ ok: true });
  });

  app.put('/billing/pricing-mode', ownerOnly, async (request, reply) => {
    const data = parseOr400(pricingModeUpdateRequestSchema, request.body, reply);
    if (!data) return;
    const orgId = request.authUser!.org;
    // BYOK requires an OpenRouter key to actually be configured, else AI would have no key.
    if (data.mode === 'BYOK' && !(await hasAiProviderKey(db, orgId))) {
      return reply.code(409).send({
        error: {
          code: 'NO_OWN_KEY',
          message: 'Configure an OpenRouter key before switching to BYOK.',
        },
      });
    }
    await upsertOrgSubscription(db, orgId, { pricingMode: data.mode });
    return reply.send(await buildBillingSummary(db, orgId));
  });
};
