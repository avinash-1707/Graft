"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import { useAuthStatus } from "@/lib/auth/use-auth";

/**
 * Gates the authenticated app. Redirects to /login when there is no token or
 * the token is rejected, and shows a spinner while `/auth/me` is in flight.
 * Auth is client-side here (token in localStorage) — the gateway still enforces
 * it on every request, so this is UX, not the security boundary.
 */
function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, isAuthenticated, isError } = useAuthStatus();

  useEffect(() => {
    if (token === null || isError) router.replace("/login");
  }, [token, isError, router]);

  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}

export { AuthGuard };
