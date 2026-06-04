import { API_URL } from "@/lib/env";

/**
 * Short-lived JWT used to call the gateway and downstream services (which verify it
 * via JWKS). It is minted from the Better Auth session cookie at
 * `GET /api/auth/token` and cached in memory only — never persisted, so it is not
 * XSS-exfiltratable from storage. Refreshed lazily and on a 401 (see http.ts).
 */
let cached: string | null = null;
let inFlight: Promise<string | null> | null = null;

async function mint(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/token`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

/** Returns a cached JWT, minting one if absent (or if `force`). De-dupes concurrent mints. */
export async function getAccessToken(force = false): Promise<string | null> {
  if (cached && !force) return cached;
  if (!inFlight) {
    inFlight = mint().then((token) => {
      cached = token;
      inFlight = null;
      return token;
    });
  }
  return inFlight;
}

export function clearAccessToken(): void {
  cached = null;
}
