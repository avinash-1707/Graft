"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_ESCALATION_CONFIG,
  escalationConfigSchema,
  type EscalationConfig,
} from "@graft/shared";

import { configApi } from "@/lib/api/config";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { validate } from "@/lib/form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SettingsCard } from "./settings-card";

export function EscalationSection() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.escalationConfig, queryFn: configApi.getEscalationConfig });

  const [form, setForm] = useState<EscalationConfig>(DEFAULT_ESCALATION_CONFIG);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: (config: EscalationConfig) => configApi.setEscalationConfig(config),
    onSuccess: (config) => {
      queryClient.setQueryData(queryKeys.escalationConfig, config);
      setSaved(true);
    },
  });

  function set<K extends keyof EscalationConfig>(key: K, value: EscalationConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    const result = validate(escalationConfigSchema, form);
    if (result.ok) save.mutate(result.data);
  }

  return (
    <SettingsCard
      title="Escalation rules"
      description="Decide when a conversation hands off from the AI to a human agent."
      isLoading={query.isPending}
    >
      <div className="divide-y divide-border">
        <Trigger
          title="Repeated human requests"
          description="Escalate after the customer asks for a person enough times."
          enabled={form.thirdHumanRequestEnabled}
          onToggle={(v) => set("thirdHumanRequestEnabled", v)}
        >
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Escalate after
            <input
              type="number"
              min={1}
              max={10}
              value={form.humanRequestCountToEscalate}
              onChange={(e) => set("humanRequestCountToEscalate", clampInt(e.target.value, 1, 10))}
              className="h-8 w-16 rounded-lg border border-input bg-card px-2 text-center text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            request(s)
          </label>
          <ThresholdSlider
            label="Detection confidence"
            value={form.humanRequestConfidenceThreshold}
            onChange={(v) => set("humanRequestConfidenceThreshold", v)}
          />
        </Trigger>

        <Trigger
          title="Weak grounding"
          description="Escalate when the knowledge base doesn't confidently cover the question."
          enabled={form.weakGroundingEnabled}
          onToggle={(v) => set("weakGroundingEnabled", v)}
        >
          <ThresholdSlider
            label="Minimum grounding score"
            value={form.weakGroundingThreshold}
            onChange={(v) => set("weakGroundingThreshold", v)}
          />
        </Trigger>

        <Trigger
          title="AI requests handoff"
          description="Let the assistant escalate itself when it judges it can't help."
          enabled={form.modelInvokedEnabled}
          onToggle={(v) => set("modelInvokedEnabled", v)}
        />

        <Trigger
          title="Negative sentiment"
          description="Escalate when the customer sounds frustrated or upset."
          enabled={form.negativeSentimentEnabled}
          onToggle={(v) => set("negativeSentimentEnabled", v)}
        >
          <ThresholdSlider
            label="Sentiment confidence"
            value={form.negativeSentimentThreshold}
            onChange={(v) => set("negativeSentimentThreshold", v)}
          />
        </Trigger>

        <Trigger
          title="Provider failure"
          description="Escalate if the AI provider errors out and can't answer."
          enabled={form.providerFailureEnabled}
          onToggle={(v) => set("providerFailureEnabled", v)}
        />
      </div>

      <div className="mt-5 space-y-3">
        {save.isError ? (
          <Alert>{save.error instanceof ApiError ? save.error.message : "Could not save."}</Alert>
        ) : null}
        {saved ? <Alert tone="success">Escalation rules saved.</Alert> : null}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save rules"}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function Trigger({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-md space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        {enabled && children ? <div className="mt-3 space-y-3">{children}</div> : null}
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

function ThresholdSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="w-40 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-1.5 flex-1 cursor-pointer accent-brand"
      />
      <span className="w-10 text-right font-mono text-xs text-foreground">{Math.round(value * 100)}%</span>
    </label>
  );
}

function clampInt(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}
