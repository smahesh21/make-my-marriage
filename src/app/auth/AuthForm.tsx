"use client";

import { FormEvent, useRef, useState } from "react";

import { loginSchema, signupSchema } from "@/shared/auth/schemas";

type AuthMode = "signup" | "login";
type FieldName = "name" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;
type ApiFieldErrors = Partial<Record<FieldName, string[]>>;

function firstFieldErrors(fields?: ApiFieldErrors): FieldErrors {
  const nextErrors: FieldErrors = {};

  for (const field of ["name", "email", "password"] as const) {
    const message = fields?.[field]?.[0];
    if (message) {
      nextErrors[field] = message;
    }
  }

  return nextErrors;
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function focusFirstInvalid(nextErrors: FieldErrors) {
    if (nextErrors.name) {
      nameRef.current?.focus();
    } else if (nextErrors.email) {
      emailRef.current?.focus();
    } else if (nextErrors.password) {
      passwordRef.current?.focus();
    }
  }

  function clearFieldError(field: FieldName) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleNativeInvalid(field: FieldName, input: HTMLInputElement) {
    const message = input.validity.valueMissing
      ? field === "name"
        ? "Enter your full name."
        : field === "email"
          ? "Enter your email address."
          : "Enter your password."
      : field === "password" && isSignup && input.validity.tooShort
        ? "Password must be at least 8 characters."
        : field === "email"
          ? "Enter a valid email address."
          : undefined;

    if (!message) {
      return;
    }

    const nextErrors = { ...fieldErrors, [field]: message };
    setFieldErrors(nextErrors);
    focusFirstInvalid(nextErrors);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validation = isSignup
      ? signupSchema.safeParse({ name, email, password })
      : loginSchema.safeParse({ email, password });

    if (!validation.success) {
      const nextErrors = firstFieldErrors(validation.error.flatten().fieldErrors);
      setFieldErrors(nextErrors);
      focusFirstInvalid(nextErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });
      const payload = (await response.json()) as {
        data?: { hasWedding?: boolean };
        error?: { message?: string; fields?: ApiFieldErrors };
      };

      if (!response.ok) {
        const nextErrors = firstFieldErrors(payload.error?.fields);
        if (Object.keys(nextErrors).length > 0) {
          setFieldErrors(nextErrors);
          focusFirstInvalid(nextErrors);
          setIsSubmitting(false);
          return;
        }

        throw new Error(payload.error?.message ?? "Something went wrong. Please try again.");
      }

      window.location.href = payload.data?.hasWedding ? "/dashboard" : "/onboarding";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {isSignup ? (
        <label className="field">
          <span>Your name</span>
          <input
            ref={nameRef}
            aria-describedby={fieldErrors.name ? "signup-name-error" : undefined}
            aria-invalid={Boolean(fieldErrors.name)}
            autoComplete="name"
            id="signup-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError("name");
            }}
            onInvalid={(event) => handleNativeInvalid("name", event.currentTarget)}
            required
          />
          {fieldErrors.name ? <small id="signup-name-error" className="field-error">{fieldErrors.name}</small> : null}
        </label>
      ) : null}

      <label className="field">
        <span>Email address</span>
        <input
          autoComplete="email"
          inputMode="email"
          type="email"
          id={`${mode}-email`}
          ref={emailRef}
          value={email}
          aria-describedby={fieldErrors.email ? `${mode}-email-error` : undefined}
          aria-invalid={Boolean(fieldErrors.email)}
          onChange={(event) => {
            setEmail(event.target.value);
            clearFieldError("email");
          }}
          onInvalid={(event) => handleNativeInvalid("email", event.currentTarget)}
          required
        />
        {fieldErrors.email ? <small id={`${mode}-email-error`} className="field-error">{fieldErrors.email}</small> : null}
      </label>

      <label className="field">
        <span>Password</span>
        <input
          ref={passwordRef}
          aria-describedby={fieldErrors.password ? `${mode}-password-error` : isSignup ? `${mode}-password-hint` : undefined}
          aria-invalid={Boolean(fieldErrors.password)}
          autoComplete={isSignup ? "new-password" : "current-password"}
          id={`${mode}-password`}
          minLength={isSignup ? 8 : 1}
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            clearFieldError("password");
          }}
          onInvalid={(event) => handleNativeInvalid("password", event.currentTarget)}
          required
        />
        {fieldErrors.password ? <small id={`${mode}-password-error`} className="field-error">{fieldErrors.password}</small> : null}
        {isSignup ? <small id={`${mode}-password-hint`}>Use at least 8 characters.</small> : null}
      </label>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <button className="button button--auth" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Please wait…" : isSignup ? "Create your workspace" : "Sign in"}
      </button>
    </form>
  );
}
