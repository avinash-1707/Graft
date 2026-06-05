import DodoPayments from 'dodopayments';

export type DodoEnvironment = 'test_mode' | 'live_mode';

export interface DodoClientOptions {
  apiKey: string;
  webhookKey: string;
  environment: DodoEnvironment;
}

export type DodoClient = DodoPayments;

/** Builds a Dodo Payments client. `webhookKey` powers signature verification on `unwrap`. */
export function createDodoClient(opts: DodoClientOptions): DodoClient {
  return new DodoPayments({
    bearerToken: opts.apiKey,
    webhookKey: opts.webhookKey,
    environment: opts.environment,
  });
}

/** Creates a Dodo customer for an org; returns the new `customer_id`. */
export async function createDodoCustomer(
  client: DodoClient,
  args: { email: string; name: string },
): Promise<string> {
  const customer = await client.customers.create({ email: args.email, name: args.name });
  return customer.customer_id;
}

export interface CheckoutArgs {
  productId: string;
  customerId: string;
  returnUrl: string;
  /** Echoed back on the resulting payment/subscription webhook (e.g. orgId, pack id). */
  metadata?: Record<string, string>;
}

/**
 * Creates a hosted checkout session and returns the redirect URL. Works for both
 * subscription and one-time products — the product itself determines the mode.
 */
export async function createCheckoutUrl(client: DodoClient, args: CheckoutArgs): Promise<string> {
  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: args.productId, quantity: 1 }],
    customer: { customer_id: args.customerId },
    return_url: args.returnUrl,
    ...(args.metadata ? { metadata: args.metadata } : {}),
  });
  if (!session.checkout_url) {
    throw new Error('Dodo checkout session returned no checkout_url');
  }
  return session.checkout_url;
}

/** Switches a subscription to a new plan/product, prorated and effective immediately. */
export async function changeSubscriptionPlan(
  client: DodoClient,
  subscriptionId: string,
  productId: string,
): Promise<void> {
  await client.subscriptions.changePlan(subscriptionId, {
    product_id: productId,
    quantity: 1,
    proration_billing_mode: 'prorated_immediately',
  });
}

/** Cancels a subscription at the end of the current billing period. */
export async function cancelSubscription(
  client: DodoClient,
  subscriptionId: string,
): Promise<void> {
  await client.subscriptions.update(subscriptionId, { cancel_at_next_billing_date: true });
}

/** The typed, verified webhook event union the SDK returns from `webhooks.unwrap`. */
export type DodoWebhookEvent = ReturnType<DodoClient['webhooks']['unwrap']>;

/** The three Standard-Webhooks headers (kept open so a plain header map is assignable). */
export type DodoWebhookHeaders = Record<string, string>;

/**
 * Verifies a Standard-Webhooks signature and returns the typed event. Throws if the
 * signature is invalid. `rawBody` must be the exact bytes Dodo sent (do not re-serialize).
 */
export function verifyDodoWebhook(
  client: DodoClient,
  rawBody: string,
  headers: DodoWebhookHeaders,
): DodoWebhookEvent {
  return client.webhooks.unwrap(rawBody, { headers });
}
