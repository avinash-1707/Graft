"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { loginRequestSchema, type LoginRequest } from "@graft/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { DASHBOARD_URL } from "@/lib/env";
import { validate, type FieldErrors } from "@graft/shared";

/** Email + password sign-in. On success the session cookie is set and the user is
 *  sent to the dashboard app (separate origin, shared auth cookie). */
function LoginForm() {
  const [errors, setErrors] = useState<FieldErrors<LoginRequest>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = { email: form.get("email"), password: form.get("password") };

    const result = validate(loginRequestSchema, input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);

    const { error } = await authClient.signIn.email(result.data);
    if (error) {
      setPending(false);
      setFormError(
        error.code === "EMAIL_NOT_VERIFIED"
          ? "Verify your email before signing in."
          : "Invalid email or password.",
      );
      return;
    }
    // Hard navigation to the dashboard origin; the shared cookie carries the session.
    window.location.href = `${DASHBOARD_URL}/dashboard`;
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
        error={errors.email}
      />
      <div className="flex flex-col gap-1.5">
        <Field
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password}
        />
        <Link
          href="/forgot-password"
          className="self-end text-xs text-muted-foreground hover:text-foreground"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : null}
        Sign in
      </Button>
    </form>
  );
}

export { LoginForm };
