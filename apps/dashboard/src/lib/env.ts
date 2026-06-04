/**
 * Public runtime config. Only `NEXT_PUBLIC_*` vars are readable in the browser, so
 * these are inlined at build time with localhost fallbacks. `API_URL` is the gateway
 * (Better Auth lives at `${API_URL}/api/auth`); `WEB_URL` hosts the auth pages, where
 * an unauthenticated visitor is sent to sign in.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8080";

export const WEB_URL =
  process.env.NEXT_PUBLIC_WEB_URL?.replace(/\/+$/, "") ?? "http://localhost:3000";

/** Ingestion-service base URL — runs on its own host/port, handles KB upload + list. */
export const INGESTION_URL =
  process.env.NEXT_PUBLIC_INGESTION_URL?.replace(/\/+$/, "") ?? "http://localhost:8082";
