import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  if (!email) redirect("/auth?mode=signup");

  return (
    <AuthShell
      title="Verify your email"
      description="One quick step to secure your account."
      footer={
        <Link href="/auth" className="text-foreground hover:underline">
          Back to sign in
        </Link>
      }
    >
      <VerifyForm email={email} />
    </AuthShell>
  );
}
