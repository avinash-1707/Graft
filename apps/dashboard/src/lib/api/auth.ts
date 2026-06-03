import type {
  AuthTokenResponse,
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
  SignupRequest,
  VerifyEmailRequest,
} from "@graft/shared";
import { apiFetch } from "./http";

/** Identity returned by `GET /auth/me` (a subset of the JWT claims). */
export interface MeResponse {
  id: AuthUser["id"];
  organizationId: AuthUser["organizationId"];
  role: AuthUser["role"];
  email: string;
}

export const authApi = {
  signup: (body: SignupRequest) =>
    apiFetch<{ user: AuthUser }>("/auth/signup", { method: "POST", body, auth: false }),

  login: (body: LoginRequest) =>
    apiFetch<AuthTokenResponse>("/auth/login", { method: "POST", body, auth: false }),

  verifyEmail: (body: VerifyEmailRequest) =>
    apiFetch<AuthTokenResponse>("/auth/verify-email", { method: "POST", body, auth: false }),

  resendVerification: (body: { email: string }) =>
    apiFetch<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body,
      auth: false,
    }),

  forgotPassword: (body: ForgotPasswordRequest) =>
    apiFetch<{ message: string }>("/auth/forgot-password", { method: "POST", body, auth: false }),

  resetPassword: (body: ResetPasswordRequest) =>
    apiFetch<{ message: string }>("/auth/reset-password", { method: "POST", body, auth: false }),

  me: () => apiFetch<MeResponse>("/auth/me"),
};
