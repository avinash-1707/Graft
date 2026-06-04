"use client";

import { useEffect, type ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { WEB_URL } from "@/lib/env";
import { useAuthStatus } from "@/lib/auth/use-auth";

/**
 * Gates the authenticated app. When there is no session (or `/auth/me` is rejected)
 * it sends the user to the web app's login. Auth is enforced by the gateway on every
 * request — this is UX, not the security boundary.
 */
function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isError } = useAuthStatus();

  useEffect(() => {
    if (!isLoading && (isError || !isAuthenticated)) {
      window.location.href = `${WEB_URL}/login`;
    }
  }, [isAuthenticated, isLoading, isError]);

  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}

export { AuthGuard };
