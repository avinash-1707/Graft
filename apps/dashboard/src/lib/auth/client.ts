"use client";

import { createAuthClient } from "better-auth/react";
import { API_URL } from "@/lib/env";

/**
 * Better Auth browser client for the dashboard. The session lives in an httpOnly
 * cookie set during sign-in on the web app and shared with this app (same parent
 * domain in prod; shared across localhost ports in dev). `credentials: "include"`
 * sends that cookie on the cross-origin calls to the gateway.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
});

export const { useSession, signOut } = authClient;
