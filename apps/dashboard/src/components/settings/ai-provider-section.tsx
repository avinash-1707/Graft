"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  openRouterModelSchema,
  setAiProviderCredentialRequestSchema,
  SUGGESTED_CHAT_MODELS,
  SUGGESTED_EMBEDDING_MODELS,
  type AiSettings,
} from "@graft/shared";
import { Check, Trash2 } from "lucide-react";

import { configApi } from "@/lib/api/config";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { validate } from "@/lib/form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { SettingsCard } from "./settings-card";

const CUSTOM = "__custom__";

export function AiProviderSection() {
  const keyring = useQuery({ queryKey: queryKeys.aiProviders, queryFn: configApi.getAiProviders });
  const settings = useQuery({ queryKey: queryKeys.aiSettings, queryFn: configApi.getAiSettings });

  const configured = keyring.data?.configured ?? false;

  return (
    <SettingsCard
      title="OpenRouter"
      description="Store your OpenRouter API key, then choose which model answers chats and which embeds your knowledge base. Both run on this one key."
      isLoading={keyring.isPending}
    >
      <div className="space-y-6">
        <OpenRouterKeyRow configured={configured} updatedAt={keyring.data?.updatedAt ?? null} />

        {keyring.isError ? <Alert>Could not load the OpenRouter key.</Alert> : null}

        <div className="border-t border-border pt-5">
          <ModelSelection
            disabled={settings.isPending}
            chatModel={settings.data?.chatModel ?? null}
            embeddingModel={settings.data?.embeddingModel ?? null}
          />
        </div>
      </div>
    </SettingsCard>
  );
}

function OpenRouterKeyRow({
  configured,
  updatedAt,
}: {
  configured: boolean;
  updatedAt: string | null;
}) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => configApi.setAiProvider({ apiKey }),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.aiProviders, status);
      setApiKey("");
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the key."),
  });

  const remove = useMutation({
    mutationFn: () => configApi.deleteAiProvider(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders });
    },
  });

  function handleSave() {
    const result = validate(setAiProviderCredentialRequestSchema, { apiKey });
    if (!result.ok) {
      setError(result.errors.apiKey ?? "Invalid API key.");
      return;
    }
    save.mutate();
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          OpenRouter API key
          {configured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-normal text-success">
              <Check className="size-3" /> Key set
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              No key
            </span>
          )}
        </div>
        {configured ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove OpenRouter key"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? <Spinner /> : <Trash2 className="text-destructive" />}
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          autoComplete="off"
          placeholder={configured ? "Enter a new key to rotate" : "Paste OpenRouter API key"}
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
        />
        <Button onClick={handleSave} disabled={save.isPending || apiKey.trim() === ""}>
          {save.isPending ? <Spinner /> : configured ? "Rotate" : "Save"}
        </Button>
      </div>
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
      {configured && updatedAt ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Last updated {new Date(updatedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

function ModelSelection({
  disabled,
  chatModel,
  embeddingModel,
}: {
  disabled: boolean;
  chatModel: string | null;
  embeddingModel: string | null;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (next: AiSettings) => configApi.setAiSettings(next),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.aiSettings, data);
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save selection."),
  });

  function commit(next: AiSettings) {
    // Validate non-null selections before sending; null = platform default.
    for (const value of [next.chatModel, next.embeddingModel]) {
      if (value !== null && !validate(openRouterModelSchema, value).ok) {
        setError("Enter a valid OpenRouter model slug, e.g. anthropic/claude-haiku-4-5");
        return;
      }
    }
    save.mutate(next);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <ModelField
          id="chat-model"
          label="Chat model"
          value={chatModel}
          defaultModel={DEFAULT_CHAT_MODEL}
          suggestions={SUGGESTED_CHAT_MODELS}
          disabled={disabled || save.isPending}
          onChange={(value) => commit({ chatModel: value, embeddingModel })}
        />
        <ModelField
          id="embedding-model"
          label="Embedding model"
          value={embeddingModel}
          defaultModel={DEFAULT_EMBEDDING_MODEL}
          suggestions={SUGGESTED_EMBEDDING_MODELS}
          disabled={disabled || save.isPending}
          onChange={(value) => commit({ chatModel, embeddingModel: value })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Changing the embedding model re-bases your vector space — re-index your knowledge base after
        switching, and use a 1536-dimension model.
      </p>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}

function ModelField({
  id,
  label,
  value,
  defaultModel,
  suggestions,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  defaultModel: string;
  suggestions: readonly string[];
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const isCustom = value !== null && !suggestions.includes(value);
  const [custom, setCustom] = useState(isCustom ? value : "");
  const [showCustom, setShowCustom] = useState(isCustom);

  const selectValue = value === null ? "" : isCustom ? CUSTOM : value;

  function handleSelect(next: string) {
    if (next === "") {
      setShowCustom(false);
      onChange(null);
    } else if (next === CUSTOM) {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange(next);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        value={selectValue}
        disabled={disabled}
        onChange={(e) => handleSelect(e.target.value)}
      >
        <option value="">Default ({defaultModel})</option>
        {suggestions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </Select>
      {showCustom ? (
        <div className="flex gap-2">
          <Input
            placeholder="vendor/model"
            value={custom}
            disabled={disabled}
            onChange={(e) => setCustom(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={disabled || custom.trim() === ""}
            onClick={() => onChange(custom.trim())}
          >
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  );
}
