"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MICRO_USD_PER_USD,
  TOPUP_PACK_USD,
  type BillingPlan,
  type CreditLedgerEntry,
  type PlanConfig,
  type PricingMode,
  type TopupPack,
} from "@graft/shared";
import { Check, ExternalLink, Zap } from "lucide-react";

import { billingApi } from "@/lib/api/billing";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SettingsCard } from "./settings-card";

const usd = (micro: number) => `$${(micro / MICRO_USD_PER_USD).toFixed(2)}`;

const ENTRY_LABEL: Record<CreditLedgerEntry["entryType"], string> = {
  GRANT_MONTHLY: "Monthly credits",
  TOPUP: "Credit top-up",
  USAGE_DEBIT: "AI usage",
  EXPIRE: "Expired",
  ADJUST: "Adjustment",
  REFUND: "Refund",
};

const TOPUP_PACKS = Object.keys(TOPUP_PACK_USD) as TopupPack[];

export function BillingSection() {
  const summary = useQuery({ queryKey: queryKeys.billingSummary, queryFn: billingApi.getSummary });
  const plans = useQuery({ queryKey: queryKeys.billingPlans, queryFn: billingApi.getPlans });

  return (
    <SettingsCard
      title="Billing & Credits"
      description="Your plan, prepaid AI credits, and pay-as-you-go top-ups. AI runs on platform credits unless you switch to your own key (BYOK)."
      isLoading={summary.isPending}
    >
      <div className="space-y-6">
        {summary.isError ? <Alert>Could not load billing.</Alert> : null}
        {summary.data ? (
          <>
            <BalanceRow
              balanceUsd={summary.data.balanceUsd}
              estimatedMessages={summary.data.estimatedMessages}
              lowBalance={summary.data.lowBalance}
              plan={summary.data.plan}
              status={summary.data.subscriptionStatus}
              currentPeriodEnd={summary.data.currentPeriodEnd}
            />
            <PricingModeRow
              mode={summary.data.pricingMode}
              hasOwnKey={summary.data.hasOwnKey}
            />
            <div className="border-t border-border pt-5">
              <PlansRow
                plans={plans.data ?? []}
                currentPlan={summary.data.plan}
                hasSubscription={summary.data.subscriptionStatus === "active"}
              />
            </div>
            <div className="border-t border-border pt-5">
              <TopupRow />
            </div>
            <div className="border-t border-border pt-5">
              <LedgerRow />
            </div>
          </>
        ) : null}
      </div>
    </SettingsCard>
  );
}

function BalanceRow({
  balanceUsd,
  estimatedMessages,
  lowBalance,
  plan,
  status,
  currentPeriodEnd,
}: {
  balanceUsd: number;
  estimatedMessages: number;
  lowBalance: boolean;
  plan: BillingPlan;
  status: string;
  currentPeriodEnd: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Credit balance</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">${balanceUsd.toFixed(2)}</div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            ≈ {estimatedMessages.toLocaleString()} messages
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {plan} plan
          </span>
          <div className="mt-1 text-xs text-muted-foreground capitalize">{status.replace("_", " ")}</div>
          {currentPeriodEnd ? (
            <div className="text-xs text-muted-foreground">
              Renews {new Date(currentPeriodEnd).toLocaleDateString()}
            </div>
          ) : null}
        </div>
      </div>
      {lowBalance ? (
        <p className="mt-3 text-xs text-destructive">
          Low balance — when credits run out, conversations hand off to a human instead of the AI.
          Top up or upgrade to keep the assistant answering.
        </p>
      ) : null}
    </div>
  );
}

function PricingModeRow({ mode, hasOwnKey }: { mode: PricingMode; hasOwnKey: boolean }) {
  const queryClient = useQueryClient();
  const mutate = useMutation({
    mutationFn: (next: PricingMode) => billingApi.setPricingMode(next),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.billingSummary, data),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm">
        <div className="font-medium">How you pay for AI</div>
        <div className="text-xs text-muted-foreground">
          {mode === "CREDITS"
            ? "Using platform credits (metered per use)."
            : "Using your own OpenRouter key — no platform AI charges."}
        </div>
      </div>
      <div className="inline-flex overflow-hidden rounded-lg border border-border">
        <ModeButton active={mode === "CREDITS"} onClick={() => mutate.mutate("CREDITS")} disabled={mutate.isPending}>
          Platform credits
        </ModeButton>
        <ModeButton
          active={mode === "BYOK"}
          onClick={() => mutate.mutate("BYOK")}
          disabled={mutate.isPending || !hasOwnKey}
          title={hasOwnKey ? undefined : "Add an OpenRouter key first"}
        >
          My own key
        </ModeButton>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  children,
  ...rest
}: { active: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

function PlansRow({
  plans,
  currentPlan,
  hasSubscription,
}: {
  plans: PlanConfig[];
  currentPlan: BillingPlan;
  hasSubscription: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const checkout = useMutation({
    mutationFn: (plan: BillingPlan) =>
      hasSubscription ? billingApi.changePlan(plan).then(() => null) : billingApi.subscribeCheckout(plan),
    onSuccess: (res) => {
      if (res && "url" in res) window.location.href = res.url;
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Checkout failed."),
  });

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Plans</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === currentPlan;
          return (
            <div
              key={p.id}
              className={`rounded-lg border p-3 ${isCurrent ? "border-primary" : "border-border"}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{p.name}</div>
                {isCurrent ? <Check className="size-4 text-primary" /> : null}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                ${p.monthlyPriceUsd}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                ${p.includedCreditsUsd} credits/mo · {(p.markupBps / 100).toFixed(0)}% margin
              </div>
              {isCurrent ? (
                <Button variant="outline" size="sm" className="mt-3 w-full" disabled>
                  Current
                </Button>
              ) : p.monthlyPriceUsd === 0 ? null : (
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  disabled={checkout.isPending}
                  onClick={() => checkout.mutate(p.id)}
                >
                  {checkout.isPending ? <Spinner /> : hasSubscription ? "Switch" : "Upgrade"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}

function TopupRow() {
  const [error, setError] = useState<string | null>(null);
  const checkout = useMutation({
    mutationFn: (pack: TopupPack) => billingApi.topupCheckout(pack),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Top-up checkout failed."),
  });

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Buy credits</div>
      <div className="flex flex-wrap gap-2">
        {TOPUP_PACKS.map((pack) => (
          <Button
            key={pack}
            variant="outline"
            size="sm"
            disabled={checkout.isPending}
            onClick={() => checkout.mutate(pack)}
          >
            <Zap className="size-3.5" /> ${TOPUP_PACK_USD[pack]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Top-up credits roll over and never expire. Opens secure Dodo Payments checkout
        <ExternalLink className="ml-1 inline size-3" />.
      </p>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}

function LedgerRow() {
  const ledger = useQuery({ queryKey: queryKeys.billingLedger, queryFn: billingApi.getLedger });
  const entries = ledger.data?.entries ?? [];

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Recent activity</div>
      {ledger.isPending ? (
        <Spinner className="size-4" />
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No credit activity yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div>{e.description ?? ENTRY_LABEL[e.entryType]}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </div>
              </div>
              <div
                className={`tabular-nums ${e.amountMicroUsd >= 0 ? "text-success" : "text-muted-foreground"}`}
              >
                {e.amountMicroUsd >= 0 ? "+" : "−"}
                {usd(Math.abs(e.amountMicroUsd))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
