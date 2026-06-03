"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthTokenResponse } from "@graft/shared";
import { authApi } from "@/lib/api/auth";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError } from "@/lib/api/http";
import { clearToken, setToken } from "./token-store";
import { useToken } from "./use-token";

/**
 * Current identity. Enabled only once a token exists, so logged-out renders
 * never fire `/auth/me`. A 401 means the token is stale — clear it and report
 * unauthenticated rather than retrying.
 */
export function useMe() {
  const token = useToken();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: authApi.me,
    enabled: token !== null,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Whether the user is signed in, plus a loading flag while `/auth/me` resolves. */
export function useAuthStatus() {
  const token = useToken();
  const me = useMe();
  return {
    token,
    user: me.data ?? null,
    isAuthenticated: token !== null && me.isSuccess,
    isLoading: token !== null && me.isPending,
    isError: me.isError,
  };
}

/** Persist a freshly issued token and prime the identity cache. */
function adoptSession(queryClient: ReturnType<typeof useQueryClient>, result: AuthTokenResponse) {
  setToken(result.token);
  queryClient.setQueryData(queryKeys.me, {
    id: result.user.id,
    organizationId: result.user.organizationId,
    role: result.user.role,
    email: result.user.email,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (result) => adoptSession(queryClient, result),
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: (result) => adoptSession(queryClient, result),
  });
}

export function useSignup() {
  return useMutation({ mutationFn: authApi.signup });
}

export function useResendVerification() {
  return useMutation({ mutationFn: authApi.resendVerification });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    clearToken();
    queryClient.removeQueries({ queryKey: queryKeys.me });
  };
}
