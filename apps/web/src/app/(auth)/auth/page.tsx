import { AuthShell } from "@/components/auth/auth-shell";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui/alert";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; verified?: string; reset?: string }>;
}) {
  const { mode, verified, reset } = await searchParams;
  const notice = verified ? (
    <Alert tone="success">Email verified. You can sign in now.</Alert>
  ) : reset ? (
    <Alert tone="success">Password updated. Sign in with your new password.</Alert>
  ) : null;

  return (
    <AuthShell>
      <AuthCard initialMode={mode === "signup" ? "signup" : "login"} notice={notice} />
    </AuthShell>
  );
}
