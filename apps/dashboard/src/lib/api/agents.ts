import type { AgentSummary, InviteAgentRequest } from "@graft/shared";

import { apiFetch } from "./http";

/** Owner-only agent management on the gateway (unit 10). */
export const agentsApi = {
  list: () => apiFetch<AgentSummary[]>("/org/agents"),
  /** Invite a support agent by email; the gateway emails them an activation OTP. */
  invite: (body: InviteAgentRequest) =>
    apiFetch<{ agent: AgentSummary }>("/org/agents", { method: "POST", body }),
  remove: (id: string) => apiFetch<void>(`/org/agents/${id}`, { method: "DELETE" }),
};
