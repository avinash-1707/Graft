"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { forgotPasswordRequestSchema } from "@graft/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { validate } from "@graft/shared";

/** Requests a password-reset OTP, then routes to the reset screen. The response is
 *  intentionally uniform (no account enumeration). */
function ForgotForm() {
  const router = useRouter();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");

    const result = validate(forgotPasswordRequestSchema, { email });
    if (!result.ok) {
      setEmailError(result.errors.email);
      return;
    }
    setEmailError(undefined);
    setFormError(null);
    setPending(true);

    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    if (error) {
      setPending(false);
      setFormError("Could not send a reset code. Try again shortly.");
      return;
    }
    router.push(`/reset-password?email=${encodeURIComponent(email)}`);
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {formError ? <Alert>{formError}</Alert> : null}

      <Field
        id="email"
        name="email"
        type="email"
        label="Work email"
        autoComplete="email"
        placeholder="you@company.com"
        error={emailError}
      />

      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : null}
        Send reset code
      </Button>
    </form>
  );
}

export { ForgotForm };
