import type {
  AiCredentialStatus,
  AiProvider,
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
  /** Keyring: the set of providers that have a stored key (never the key itself). */
  getAiProviders: () => apiFetch<AiCredentialStatus>("/org/ai-providers"),
  /** Set or rotate one provider's key; echoes the refreshed keyring status. */
  setAiProvider: (body: SetAiProviderCredentialRequest) =>
    apiFetch<AiCredentialStatus>("/org/ai-providers", { method: "PUT", body }),
  /** Remove a provider's key (also clears any settings selection pointing at it). */
  deleteAiProvider: (provider: AiProvider) =>
    apiFetch<void>(`/org/ai-providers/${provider}`, { method: "DELETE" }),

  /** Which provider the tenant uses for chat vs. embeddings (independent axes). */
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
