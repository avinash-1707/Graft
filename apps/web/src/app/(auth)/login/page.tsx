import { AuthShell } from "@/components/auth/auth-shell";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui/alert";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; reset?: string }>;
}) {
  const { verified, reset } = await searchParams;
  const notice = verified ? (
    <Alert tone="success">Email verified. You can sign in now.</Alert>
  ) : reset ? (
    <Alert tone="success">Password updated. Sign in with your new password.</Alert>
  ) : null;

  return (
    <AuthShell>
      <AuthCard initialMode="login" notice={notice} />
    </AuthShell>
  );
}
