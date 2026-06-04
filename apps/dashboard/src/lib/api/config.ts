import type {
  AiCredentialStatus,
  AiSettings,
  EscalationConfig,
  SetAiProviderCredentialRequest,
  SetAiSettingsRequest,
  WidgetConfig,
} from "@graft/shared";

import { apiFetch } from "./http";

/**
 * Owner-only tenant configuration endpoints on the gateway (units 08/09/13). Each
 * config is a single per-org document: GET returns the stored row or effective
 * defaults, PUT is a full-document upsert.
 */
export const configApi = {
  /** Keyring: whether an OpenRouter key is stored (never the key itself). */
  getAiProviders: () => apiFetch<AiCredentialStatus>("/org/ai-providers"),
  /** Set or rotate the OpenRouter key; echoes the refreshed keyring status. */
  setAiProvider: (body: SetAiProviderCredentialRequest) =>
    apiFetch<AiCredentialStatus>("/org/ai-providers", { method: "PUT", body }),
  /** Remove the OpenRouter key. */
  deleteAiProvider: () => apiFetch<void>("/org/ai-providers", { method: "DELETE" }),

  /** Which OpenRouter model the tenant uses for chat vs. embeddings (null = default). */
  getAiSettings: () => apiFetch<AiSettings>("/org/ai-settings"),
  setAiSettings: (body: SetAiSettingsRequest) =>
    apiFetch<AiSettings>("/org/ai-settings", { method: "PUT", body }),

  getWidgetConfig: () => apiFetch<WidgetConfig>("/org/widget-config"),
  setWidgetConfig: (body: WidgetConfig) =>
    apiFetch<WidgetConfig>("/org/widget-config", { method: "PUT", body }),

  getEscalationConfig: () => apiFetch<EscalationConfig>("/org/escalation-config"),
  setEscalationConfig: (body: EscalationConfig) =>
    apiFetch<EscalationConfig>("/org/escalation-config", { method: "PUT", body }),
};
