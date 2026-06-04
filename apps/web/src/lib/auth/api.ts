import type { SignupRequest } from "@graft/shared";
import { API_URL } from "@/lib/env";

/** Stable error shape the gateway returns: `{ error: { code, message } }`. */
export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

/**
 * Org + owner signup. This is a custom gateway endpoint (not a Better Auth route)
 * because it also creates the organization. Credentials are included so the
 * verification flow that follows shares the auth cookie context.
 */
export async function signup(body: SignupRequest): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Could not reach the server. Check your connection.");
  }

  if (!response.ok) {
    let code = "REQUEST_FAILED";
    let message = `Request failed (${response.status}).`;
    try {
      const data = (await response.json()) as ErrorEnvelope;
      if (data.error?.code) code = data.error.code;
      if (data.error?.message) message = data.error.message;
    } catch {
      /* non-JSON error body — keep defaults */
    }
    throw new ApiError(code, message);
  }
}
