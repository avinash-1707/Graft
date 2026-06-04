import type { InternalNote, ListNotesResponse } from "@graft/shared";

import { CHAT_URL } from "@/lib/env";
import { apiFetch } from "./http";

/**
 * Internal-note endpoints on chat-service (unit 28), which also hosts the org feed.
 * Calls carry the minted bearer JWT (verified via JWKS) and target `CHAT_URL`. Notes
 * are agent-only and never surface to the customer.
 */
export const notesApi = {
  list: (conversationId: string) =>
    apiFetch<ListNotesResponse>(`/org/conversations/${conversationId}/notes`, {
      baseUrl: CHAT_URL,
    }),
  create: (conversationId: string, content: string) =>
    apiFetch<{ note: InternalNote }>(`/org/conversations/${conversationId}/notes`, {
      method: "POST",
      baseUrl: CHAT_URL,
      body: { content },
    }),
};
