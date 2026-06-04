"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { verifyEmailRequestSchema } from "@graft/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { validate } from "@graft/shared";

/** Confirms the email-verification OTP, then routes to sign-in. */
function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");

    const result = validate(verifyEmailRequestSchema, { email, code });
    if (!result.ok) {
      setCodeError(result.errors.code ?? result.errors.email);
      return;
    }
    setCodeError(undefined);
    setFormError(null);
    setPending(true);

    const { error } = await authClient.emailOtp.verifyEmail({ email, otp: code });
    if (error) {
      setPending(false);
      setFormError("That code is invalid or has expired.");
      return;
    }
    router.push("/auth?verified=1");
  }

  async function resend() {
    setResending(true);
    setFormError(null);
    setNotice(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    setResending(false);
    if (error) setFormError("Could not resend the code. Try again shortly.");
    else setNotice("A new code is on its way.");
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {formError ? <Alert>{formError}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <p className="text-sm text-muted-foreground">
        We sent a verification code to <span className="text-foreground">{email}</span>.
      </p>

      <Field
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        label="Verification code"
        placeholder="123456"
        error={codeError}
      />

      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : null}
        Verify email
      </Button>

      <button
        type="button"
        onClick={resend}
        disabled={resending}
        className="text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {resending ? "Sending…" : "Resend code"}
      </button>
    </form>
  );
}

export { VerifyForm };
