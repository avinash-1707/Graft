"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { WEB_URL } from "@/lib/env";
import { authClient, signOut } from "./client";
import { clearAccessToken } from "./access-token";

/**
 * Current identity. Gated on an active Better Auth session (cookie); only then does
 * it fetch `/auth/me` (which needs the minted JWT). A 401 means the session is gone —
 * report unauthenticated rather than retrying.
 */
export function useMe() {
  const { data: session } = authClient.useSession();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: authApi.me,
    enabled: Boolean(session),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Whether the user is signed in, plus loading/error flags for the guard. */
export function useAuthStatus() {
  const session = authClient.useSession();
  const hasSession = Boolean(session.data);
  const me = useMe();
  return {
    user: me.data ?? null,
    isAuthenticated: hasSession && me.isSuccess,
    isLoading: session.isPending || (hasSession && me.isPending),
    isError: me.isError || (!session.isPending && !hasSession),
  };
}

/** Signs out (clears the session cookie + cached JWT) and returns to the web login. */
export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    await signOut();
    clearAccessToken();
    queryClient.clear();
    if (typeof window !== "undefined") window.location.href = `${WEB_URL}/login`;
  };
}
