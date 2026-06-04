/** Central registry of TanStack Query cache keys. */
export const queryKeys = {
  me: ["auth", "me"] as const,
  aiProviders: ["config", "ai-providers"] as const,
  aiSettings: ["config", "ai-settings"] as const,
  widgetConfig: ["config", "widget"] as const,
  escalationConfig: ["config", "escalation"] as const,
  agents: ["agents"] as const,
  kbDocuments: ["kb", "documents"] as const,
  notes: (conversationId: string) => ["notes", conversationId] as const,
};
