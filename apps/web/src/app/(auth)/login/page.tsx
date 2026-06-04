import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; reset?: string }>;
}) {
  const { verified, reset } = await searchParams;
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your Graft dashboard."
      footer={
        <>
          New to Graft?{" "}
          <Link href="/signup" className="text-foreground hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {verified ? <Alert tone="success">Email verified. You can sign in now.</Alert> : null}
      {reset ? <Alert tone="success">Password updated. Sign in with your new password.</Alert> : null}
      <LoginForm />
    </AuthShell>
  );
}
