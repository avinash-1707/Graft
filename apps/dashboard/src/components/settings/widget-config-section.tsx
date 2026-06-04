"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_WIDGET_CONFIG,
  WIDGET_LAUNCHER_POSITIONS,
  WIDGET_PRESETS,
  widgetConfigSchema,
  type WidgetConfig,
} from "@graft/shared";

import { configApi } from "@/lib/api/config";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { validate, type FieldErrors } from "@/lib/form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SettingsCard } from "./settings-card";
import { WidgetPreview } from "./widget-preview";

const PRESET_LABELS: Record<(typeof WIDGET_PRESETS)[number], string> = {
  LIGHT: "Light",
  DARK: "Dark",
  BRAND: "Brand",
};
const POSITION_LABELS: Record<(typeof WIDGET_LAUNCHER_POSITIONS)[number], string> = {
  BOTTOM_RIGHT: "Bottom right",
  BOTTOM_LEFT: "Bottom left",
};

const COLOR_FIELDS = [
  { key: "accentPrimary", label: "Accent" },
  { key: "bgSurface", label: "Surface" },
  { key: "textPrimary", label: "Text" },
  { key: "textMuted", label: "Muted text" },
] as const;

export function WidgetConfigSection() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.widgetConfig, queryFn: configApi.getWidgetConfig });

  const [form, setForm] = useState<WidgetConfig>(DEFAULT_WIDGET_CONFIG);
  const [errors, setErrors] = useState<FieldErrors<WidgetConfig>>({});
  const [saved, setSaved] = useState(false);

  // Hydrate the form once the stored config arrives.
  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: (config: WidgetConfig) => configApi.setWidgetConfig(config),
    onSuccess: (config) => {
      queryClient.setQueryData(queryKeys.widgetConfig, config);
      setSaved(true);
    },
  });

  function set<K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSave() {
    const result = validate(widgetConfigSchema, form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    save.mutate(result.data);
  }

  return (
    <SettingsCard
      title="Widget appearance"
      description="Theme the chat widget your customers see and set the assistant's name and greeting."
      isLoading={query.isPending}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <Field
            id="widget-bot-name"
            label="Assistant name"
            value={form.botName}
            maxLength={60}
            onChange={(e) => set("botName", e.target.value)}
            error={errors.botName}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="widget-greeting">Greeting</Label>
            <Textarea
              id="widget-greeting"
              value={form.greeting}
              maxLength={280}
              onChange={(e) => set("greeting", e.target.value)}
              aria-invalid={errors.greeting ? true : undefined}
            />
            {errors.greeting ? <p className="text-xs text-destructive">{errors.greeting}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COLOR_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`widget-${key}`}>{label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`${label} color picker`}
                    value={normalizeColor(form[key])}
                    onChange={(e) => set(key, e.target.value)}
                    className="size-9 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1"
                  />
                  <input
                    id={`widget-${key}`}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    aria-invalid={errors[key] ? true : undefined}
                    className="h-9 w-full min-w-0 rounded-lg border border-input bg-card px-2 font-mono text-xs uppercase outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive"
                  />
                </div>
                {errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null}
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="widget-preset">Preset</Label>
              <Select id="widget-preset" value={form.preset} onChange={(e) => set("preset", e.target.value as WidgetConfig["preset"])}>
                {WIDGET_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {PRESET_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="widget-position">Launcher position</Label>
              <Select
                id="widget-position"
                value={form.launcherPosition}
                onChange={(e) => set("launcherPosition", e.target.value as WidgetConfig["launcherPosition"])}
              >
                {WIDGET_LAUNCHER_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {POSITION_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {save.isError ? (
            <Alert>{save.error instanceof ApiError ? save.error.message : "Could not save."}</Alert>
          ) : null}
          {saved ? <Alert tone="success">Widget appearance saved.</Alert> : null}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save appearance"}
            </Button>
          </div>
        </div>

        <WidgetPreview config={form} />
      </div>
    </SettingsCard>
  );
}

/** `<input type=color>` only accepts `#rrggbb`; coerce shorthand/alpha for the swatch. */
function normalizeColor(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7);
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const [r, g, b] = [v[1], v[2], v[3]];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#000000";
}
