"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AI_PROVIDERS,
  CHAT_PROVIDERS,
  EMBEDDING_PROVIDERS,
  setAiProviderCredentialRequestSchema,
  type AiProvider,
  type ChatProvider,
  type EmbeddingProvider,
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

const PROVIDER_LABELS: Record<AiProvider, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GEMINI: "Google Gemini",
};

export function AiProviderSection() {
  const queryClient = useQueryClient();
  const keyring = useQuery({ queryKey: queryKeys.aiProviders, queryFn: configApi.getAiProviders });
  const settings = useQuery({ queryKey: queryKeys.aiSettings, queryFn: configApi.getAiSettings });

  const configured = new Set(keyring.data?.credentials.map((c) => c.provider) ?? []);

  return (
    <SettingsCard
      title="AI provider"
      description="Store an API key for each provider, then choose which one answers chats and which embeds your knowledge base."
      isLoading={keyring.isPending}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          {AI_PROVIDERS.map((provider) => (
            <ProviderKeyRow
              key={provider}
              provider={provider}
              configured={configured.has(provider)}
            />
          ))}
        </div>

        {keyring.isError ? <Alert>Could not load provider keys.</Alert> : null}

        <div className="border-t border-border pt-5">
          <ProviderSelection
            disabled={settings.isPending}
            configured={configured}
            chatProvider={settings.data?.chatProvider ?? null}
            embeddingProvider={settings.data?.embeddingProvider ?? null}
            onChange={() => {
              void queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings });
            }}
          />
        </div>
      </div>
    </SettingsCard>
  );
}

function ProviderKeyRow({ provider, configured }: { provider: AiProvider; configured: boolean }) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => configApi.setAiProvider({ provider, apiKey }),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.aiProviders, status);
      setApiKey("");
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the key."),
  });

  const remove = useMutation({
    mutationFn: () => configApi.deleteAiProvider(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiProviders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings });
    },
  });

  function handleSave() {
    const result = validate(setAiProviderCredentialRequestSchema, { provider, apiKey });
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
          {PROVIDER_LABELS[provider]}
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
            aria-label={`Remove ${PROVIDER_LABELS[provider]} key`}
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
          placeholder={configured ? "Enter a new key to rotate" : "Paste API key"}
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
    </div>
  );
}

function ProviderSelection({
  disabled,
  configured,
  chatProvider,
  embeddingProvider,
  onChange,
}: {
  disabled: boolean;
  configured: Set<AiProvider>;
  chatProvider: ChatProvider | null;
  embeddingProvider: EmbeddingProvider | null;
  onChange: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (next: { chatProvider: ChatProvider | null; embeddingProvider: EmbeddingProvider | null }) =>
      configApi.setAiSettings(next),
    onSuccess: () => {
      setError(null);
      onChange();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save selection."),
  });

  function setChat(value: string) {
    save.mutate({ chatProvider: value === "" ? null : (value as ChatProvider), embeddingProvider });
  }
  function setEmbedding(value: string) {
    save.mutate({ chatProvider, embeddingProvider: value === "" ? null : (value as EmbeddingProvider) });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chat-provider">Chat provider</Label>
          <Select
            id="chat-provider"
            value={chatProvider ?? ""}
            disabled={disabled || save.isPending}
            onChange={(e) => setChat(e.target.value)}
          >
            <option value="">Not selected</option>
            {CHAT_PROVIDERS.map((p) => (
              <option key={p} value={p} disabled={!configured.has(p)}>
                {PROVIDER_LABELS[p]}
                {configured.has(p) ? "" : " (needs key)"}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="embedding-provider">Embedding provider</Label>
          <Select
            id="embedding-provider"
            value={embeddingProvider ?? ""}
            disabled={disabled || save.isPending}
            onChange={(e) => setEmbedding(e.target.value)}
          >
            <option value="">Not selected</option>
            {EMBEDDING_PROVIDERS.map((p) => (
              <option key={p} value={p} disabled={!configured.has(p)}>
                {PROVIDER_LABELS[p]}
                {configured.has(p) ? "" : " (needs key)"}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}
