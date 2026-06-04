"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordRequestSchema, type ResetPasswordRequest } from "@graft/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { validate, type FieldErrors } from "@graft/shared";

/** Sets a new password using the reset OTP, then routes to sign-in. */
function ResetForm({ email }: { email: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<ResetPasswordRequest>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      email,
      code: form.get("code"),
      newPassword: form.get("newPassword"),
    };

    const result = validate(resetPasswordRequestSchema, input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);

    const { error } = await authClient.emailOtp.resetPassword({
      email: result.data.email,
      otp: result.data.code,
      password: result.data.newPassword,
    });
    if (error) {
      setPending(false);
      setFormError("That code is invalid or has expired.");
      return;
    }
    router.push("/auth?reset=1");
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {formError ? <Alert>{formError}</Alert> : null}

      <p className="text-sm text-muted-foreground">
        Enter the code sent to <span className="text-foreground">{email}</span> and choose a new
        password.
      </p>

      <Field
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        label="Reset code"
        placeholder="123456"
        error={errors.code}
      />
      <Field
        id="newPassword"
        name="newPassword"
        type="password"
        label="New password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={errors.newPassword}
      />

      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : null}
        Update password
      </Button>
    </form>
  );
}

export { ResetForm };
