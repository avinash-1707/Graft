"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStatus, useLogout } from "@/lib/auth/use-auth";

/** Identity summary + sign-out. Compact so it fits the topbar and drawer foot. */
function UserMenu() {
  const { user } = useAuthStatus();
  const logout = useLogout();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="flex items-center gap-3">
      {user ? (
        <div className="hidden min-w-0 flex-col text-right sm:flex">
          <span className="truncate text-sm font-medium">{user.email}</span>
          <span className="text-xs text-muted-foreground capitalize">
            {user.role.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>
      ) : null}
      <Button variant="outline" size="sm" onClick={handleLogout}>
        <LogOut className="size-4" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}

export { UserMenu };
