import type { MessageRole } from "@graft/shared";

/** Compact relative time ("just now", "3m ago", "2h ago", "4d ago") for feed activity. */
export function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const ROLE_LABELS: Record<MessageRole, string> = {
  CUSTOMER: "Customer",
  AI: "AI",
  AGENT: "Agent",
  SYSTEM: "System",
};

export function roleLabel(role: MessageRole): string {
  return ROLE_LABELS[role];
}

/** Short, stable handle for an anonymous session (the feed never exposes raw ids). */
export function sessionLabel(sessionId: string): string {
  return `Visitor ${sessionId.slice(0, 4).toUpperCase()}`;
}
