"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { API_URL } from "@/lib/env";

/**
 * Better Auth browser client. Points at the gateway-hosted auth server; the
 * session lives in an httpOnly cookie, so `credentials: "include"` is required for
 * the cross-origin (web -> gateway) calls. Once signed in, the cookie is shared
 * with the dashboard app (same parent domain), which reads the session there.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
  plugins: [emailOTPClient()],
});
