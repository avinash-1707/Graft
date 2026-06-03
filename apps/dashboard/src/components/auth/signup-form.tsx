"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signupRequestSchema } from "@graft/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/http";
import { useSignup } from "@/lib/auth/use-auth";
import { validate, type FieldErrors } from "@/lib/form";
import type { SignupRequest } from "@graft/shared";

function SignupForm() {
  const router = useRouter();
  const signup = useSignup();
  const [errors, setErrors] = useState<FieldErrors<SignupRequest>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    signup.mutate(result.data, {
      onSuccess: () =>
        router.replace(`/verify-email?email=${encodeURIComponent(result.data.email)}`),
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {signup.isError ? (
        <Alert>
          {signup.error instanceof ApiError ? signup.error.message : "Something went wrong."}
        </Alert>
      ) : null}

      <Field
        id="organizationName"
        name="organizationName"
        label="Company name"
        autoComplete="organization"
        placeholder="Acme Inc."
        error={errors.organizationName}
      />
      <Field
        id="name"
        name="name"
        label="Your name"
        autoComplete="name"
        placeholder="Jane Doe"
        error={errors.name}
      />
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

      <Button type="submit" disabled={signup.isPending}>
        {signup.isPending ? <Spinner /> : null}
        Create account
      </Button>
    </form>
  );
}

export { SignupForm };
