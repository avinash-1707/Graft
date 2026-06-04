import { AuthShell } from "@/components/auth/auth-shell";
import { AuthCard } from "@/components/auth/auth-card";

export default function SignupPage() {
  return (
    <AuthShell>
      <AuthCard initialMode="signup" />
    </AuthShell>
  );
}
