"use client";

import { useSyncExternalStore } from "react";
import { getToken, subscribeToken } from "./token-store";

/**
 * Reactive read of the stored bearer token. Returns `null` on the server and
 * during the first client render (localStorage is unavailable until mount),
 * then updates whenever login/logout mutates the store.
 */
export function useToken(): string | null {
  return useSyncExternalStore(subscribeToken, getToken, () => null);
}
