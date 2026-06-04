"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signupRequestSchema, type SignupRequest } from "@graft/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, signup } from "@/lib/auth/api";
import { validate, type FieldErrors } from "@graft/shared";

/** Org + owner signup. On success, routes to the verification screen with the email
 *  so the owner can enter the OTP they were just emailed. */
function SignupForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<SignupRequest>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      organizationName: form.get("organizationName"),
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    };

    const result = validate(signupRequestSchema, input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);

    try {
      await signup(result.data);
      router.push(`/verify-email?email=${encodeURIComponent(result.data.email)}`);
    } catch (err) {
      setPending(false);
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {formError ? <Alert>{formError}</Alert> : null}

      <Field
        id="organizationName"
        name="organizationName"
        label="Organization name"
        placeholder="Acme Inc."
        error={errors.organizationName}
      />
      <Field id="name" name="name" label="Your name" placeholder="Jane Doe" error={errors.name} />
      <Field
        id="email"
        name="email"
        type="email"
        label="Work email"
        autoComplete="email"
        placeholder="you@company.com"
        error={errors.email}
      />
      <Field
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={errors.password}
      />

      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : null}
        Create account
      </Button>
    </form>
  );
}

export { SignupForm };
