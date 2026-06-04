import type { AuthUser } from "@graft/shared";
import { apiFetch } from "./http";

/** Identity returned by `GET /auth/me` (a subset of the JWT claims). */
export interface MeResponse {
  id: AuthUser["id"];
  organizationId: AuthUser["organizationId"];
  role: AuthUser["role"];
  email: string;
}

/**
 * Authentication flows (sign-in, signup, verification, password reset) live on the
 * web app via Better Auth. The dashboard only reads the current identity, derived
 * from the gateway-verified JWT.
 */
export const authApi = {
  me: () => apiFetch<MeResponse>("/auth/me"),
};
