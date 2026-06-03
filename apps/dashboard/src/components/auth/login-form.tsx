"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginRequestSchema } from "@graft/shared";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/http";
import { useLogin } from "@/lib/auth/use-auth";
import { validate, type FieldErrors } from "@/lib/form";
import type { LoginRequest } from "@graft/shared";

function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [errors, setErrors] = useState<FieldErrors<LoginRequest>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = { email: form.get("email"), password: form.get("password") };

    const result = validate(loginRequestSchema, input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    login.mutate(result.data, { onSuccess: () => router.replace("/dashboard") });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {login.isError ? (
        <Alert>
          {login.error instanceof ApiError ? login.error.message : "Something went wrong."}
        </Alert>
      ) : null}

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
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password}
      />

      <Button type="submit" disabled={login.isPending}>
        {login.isPending ? <Spinner /> : null}
        Sign in
      </Button>
    </form>
  );
}

export { LoginForm };
