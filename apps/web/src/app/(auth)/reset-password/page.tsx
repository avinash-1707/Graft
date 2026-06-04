import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "@/components/auth/reset-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  if (!email) redirect("/forgot-password");

  return (
    <AuthShell
      title="Choose a new password"
      description="Enter the code we emailed and your new password."
      footer={
        <Link href="/login" className="text-foreground hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ResetForm email={email} />
    </AuthShell>
  );
}
