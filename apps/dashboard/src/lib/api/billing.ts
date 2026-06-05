import type {
  BillingPlan,
  BillingSummary,
  CheckoutSessionResponse,
  CreditLedgerPage,
  PlanConfig,
  PricingMode,
  TopupPack,
} from "@graft/shared";

import { apiFetch } from "./http";

/**
 * Owner-only billing endpoints on the gateway. Read endpoints work even when Dodo is not
 * configured; checkout/change endpoints return 503 in that case. Checkout calls return a
 * hosted Dodo URL the caller should redirect to.
 */
export const billingApi = {
  getSummary: () => apiFetch<BillingSummary>("/billing/summary"),
  getPlans: () => apiFetch<PlanConfig[]>("/billing/plans"),
  getLedger: () => apiFetch<CreditLedgerPage>("/billing/ledger"),

  subscribeCheckout: (plan: BillingPlan) =>
    apiFetch<CheckoutSessionResponse>("/billing/checkout/subscribe", {
      method: "POST",
      body: { plan },
    }),
  topupCheckout: (pack: TopupPack) =>
    apiFetch<CheckoutSessionResponse>("/billing/checkout/topup", { method: "POST", body: { pack } }),
  changePlan: (plan: BillingPlan) =>
    apiFetch<{ ok: boolean }>("/billing/change-plan", { method: "POST", body: { plan } }),
  cancel: () => apiFetch<{ ok: boolean }>("/billing/cancel", { method: "POST" }),
  setPricingMode: (mode: PricingMode) =>
    apiFetch<BillingSummary>("/billing/pricing-mode", { method: "PUT", body: { mode } }),
};
