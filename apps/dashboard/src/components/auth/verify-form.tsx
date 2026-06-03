"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { verifyEmailRequestSchema } from "@graft/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/http";
import { useResendVerification, useVerifyEmail } from "@/lib/auth/use-auth";
import { validate, type FieldErrors } from "@/lib/form";
import type { VerifyEmailRequest } from "@graft/shared";

function VerifyForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [errors, setErrors] = useState<FieldErrors<VerifyEmailRequest>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = { email: form.get("email"), code: form.get("code") };

    const result = validate(verifyEmailRequestSchema, input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    verify.mutate(result.data, { onSuccess: () => router.replace("/dashboard") });
  }

  function handleResend() {
    const email = (document.getElementById("email") as HTMLInputElement | null)?.value ?? initialEmail;
    if (email) resend.mutate({ email });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {verify.isError ? (
        <Alert>
          {verify.error instanceof ApiError ? verify.error.message : "Something went wrong."}
        </Alert>
      ) : null}
      {resend.isSuccess ? <Alert tone="success">If the email is registered, a new code is on its way.</Alert> : null}

      <Field
        id="email"
        name="email"
        type="email"
        label="Work email"
        autoComplete="email"
        defaultValue={initialEmail}
        error={errors.email}
      />
      <Field
        id="code"
        name="code"
        inputMode="numeric"
        label="Verification code"
        autoComplete="one-time-code"
        placeholder="6-digit code"
        error={errors.code}
      />

      <Button type="submit" disabled={verify.isPending}>
        {verify.isPending ? <Spinner /> : null}
        Verify email
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={handleResend} disabled={resend.isPending}>
        {resend.isPending ? <Spinner /> : null}
        Resend code
      </Button>
    </form>
  );
}

export { VerifyForm };
