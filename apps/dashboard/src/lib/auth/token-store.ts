/**
 * Owner/agent access token persistence. The gateway issues a bearer JWT; we
 * keep it in localStorage so a refresh stays signed in. A tiny pub/sub lets
 * React subscribe to changes (login/logout) without prop-drilling.
 */
const TOKEN_KEY = "graft:dashboard:token";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  notify();
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  notify();
}

export function subscribeToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
