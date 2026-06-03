/**
 * Public runtime config. Only `NEXT_PUBLIC_*` vars are readable in the browser,
 * so the gateway base URL is inlined at build time with a localhost fallback.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8080";
