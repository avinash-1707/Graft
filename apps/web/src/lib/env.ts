/**
 * Public runtime config for the web app. Only `NEXT_PUBLIC_*` vars reach the
 * browser. `API_URL` is the gateway (Better Auth lives at `${API_URL}/api/auth`);
 * `DASHBOARD_URL` is where a signed-in user is sent after login.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8080";

export const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL?.replace(/\/+$/, "") ?? "http://localhost:3001";
