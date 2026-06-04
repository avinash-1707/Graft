import { API_URL, WEB_URL } from "@/lib/env";
import { clearAccessToken, getAccessToken } from "@/lib/auth/access-token";

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
  /** JSON body; serialized automatically. Ignored when `formData` is set. */
  body?: unknown;
  /** Multipart payload (e.g. file upload); sent as-is, no content-type override. */
  formData?: FormData;
  /** Attach the minted bearer JWT. Defaults to true. */
  auth?: boolean;
  /** Target service base URL. Defaults to the gateway (`API_URL`). */
  baseUrl?: string;
  signal?: AbortSignal;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    window.location.href = `${WEB_URL}/login`;
  }
}

async function doFetch(
  path: string,
  options: RequestOptions,
  attachToken: boolean,
): Promise<Response> {
  const { method = "GET", body, formData, signal, baseUrl = API_URL } = options;
  const headers: Record<string, string> = {};
  // Let the browser set the multipart boundary for FormData; only set JSON otherwise.
  if (formData === undefined && body !== undefined) headers["content-type"] = "application/json";
  if (attachToken) {
    const token = await getAccessToken();
    if (token) headers["authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers, credentials: "include" };
  if (formData !== undefined) init.body = formData;
  else if (body !== undefined) init.body = JSON.stringify(body);
  if (signal) init.signal = signal;

  return fetch(`${baseUrl}${path}`, init);
}

/**
 * Single fetch entry point for the gateway. Attaches the session-minted JWT as a
 * bearer token. On a 401 it mints a fresh JWT from the session cookie once and
 * retries; if that still fails the session is gone, so it bounces to the web login.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true } = options;

  let response: Response;
  try {
    response = await doFetch(path, options, auth);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection.");
  }

  // Stale/expired JWT: re-mint from the cookie and retry once.
  if (response.status === 401 && auth) {
    clearAccessToken();
    const fresh = await getAccessToken(true);
    if (fresh) {
      try {
        response = await doFetch(path, options, true);
      } catch {
        throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection.");
      }
    }
    if (response.status === 401) {
      redirectToLogin();
    }
  }

  if (!response.ok) {
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
