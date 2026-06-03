import { API_URL } from "@/lib/env";
import { clearToken, getToken } from "@/lib/auth/token-store";

/** Stable error shape the gateway returns: `{ error: { code, message } }`. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** JSON body; serialized automatically. */
  body?: unknown;
  /** Attach the stored bearer token. Defaults to true. */
  auth?: boolean;
  signal?: AbortSignal;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

/**
 * Single fetch entry point for the gateway. Serializes JSON, attaches the
 * bearer token, and normalizes failures into {@link ApiError}. A 401 on an
 * authenticated call clears the stale token so the guard can bounce to login.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (signal) init.signal = signal;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection.");
  }

  if (!response.ok) {
    if (response.status === 401 && auth) clearToken();
    let code = "REQUEST_FAILED";
    let message = `Request failed (${response.status}).`;
    try {
      const data = (await response.json()) as ErrorEnvelope;
      if (data.error?.code) code = data.error.code;
      if (data.error?.message) message = data.error.message;
    } catch {
      /* non-JSON error body — keep the defaults */
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
