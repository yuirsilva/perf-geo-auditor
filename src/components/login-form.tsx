"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/glaze/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Form,
  FormActions,
  FormStatus,
} from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signup = mode === "signup";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const { error } = signup
      ? await authClient.signUp.email({ email, password, name: String(form.get("name")) })
      : await authClient.signIn.email({ email, password });

    setPending(false);
    if (error) {
      setError(error.message ?? "Something went wrong.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="type-title">{signup ? "Create an account" : "Sign in"}</h1>
      <Form onSubmit={onSubmit} pending={pending}>
        <Field name="email">
          <FieldLabel>Email</FieldLabel>
          <Input name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
          <FieldError match="valueMissing">Enter your email address.</FieldError>
          <FieldError match="typeMismatch">Enter a full email address, like you@company.com.</FieldError>
        </Field>
        <Field name="password">
          <FieldLabel>Password</FieldLabel>
          <Input
            name="password"
            mode="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          {signup && <FieldDescription>At least 8 characters.</FieldDescription>}
          <FieldError match="valueMissing">
            {signup ? "Choose a password of at least 8 characters." : "Enter your password."}
          </FieldError>
          <FieldError match="tooShort">Use at least 8 characters.</FieldError>
        </Field>
        {/* Added below the shared fields, so switching modes never moves Email or Password. */}
        {signup && (
          <Field name="name">
            <FieldLabel>Name</FieldLabel>
            <Input name="name" autoComplete="name" required />
            <FieldError match="valueMissing">Enter your name.</FieldError>
          </Field>
        )}
        {/* Rendered from the start, empty, so a screen reader hears it change. */}
        <FormStatus status={error ? "fail" : undefined}>{error}</FormStatus>
        <FormActions>
          <Button
            type="submit"
            pending={pending}
            pendingLabel={signup ? "Creating account" : "Signing in"}
          >
            {signup ? "Create account" : "Sign in"}
          </Button>
        </FormActions>
      </Form>
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setMode(signup ? "signin" : "signup")}>
        {signup ? "Already have an account? Sign in" : "No account? Create one"}
      </Button>
    </div>
  );
}
