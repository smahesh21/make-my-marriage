"use client";

import { FormEvent, useRef, useState } from "react";

import { loginSchema, signupSchema } from "@/shared/auth/schemas";

type AuthMode = "signup" | "login";
type FieldName = "name" | "email" | "password" | "confirmPassword" | "consent";
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

function passwordStrength(value: string) {
  if (!value) return { score: 0, label: "Start with 8 characters" };

  let score = value.length >= 8 ? 1 : 0;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  return {
    score,
    label: score >= 4 ? "Strong" : score === 3 ? "Good" : score === 2 ? "Fair" : "Getting started",
  };
}

export function AuthForm({ mode, inviteToken }: { mode: AuthMode; inviteToken?: string }) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const passwordMeter = passwordStrength(password);

  function focusFirstInvalid(nextErrors: FieldErrors) {
    if (nextErrors.name) {
      nameRef.current?.focus();
    } else if (nextErrors.email) {
      emailRef.current?.focus();
    } else if (nextErrors.password) {
      passwordRef.current?.focus();
    } else if (nextErrors.confirmPassword) {
      confirmPasswordRef.current?.focus();
    } else if (nextErrors.consent) {
      consentRef.current?.focus();
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
    let message: string | undefined;
    if (input.validity.valueMissing) {
      message = field === "name"
        ? "Enter your full name."
        : field === "email"
          ? "Enter your email address."
          : field === "confirmPassword"
            ? "Confirm your password."
            : field === "consent"
              ? "Accept the terms to create your account."
              : "Enter your password.";
    } else if (field === "password" && isSignup && input.validity.tooShort) {
      message = "Password must be at least 8 characters.";
    } else if (field === "email") {
      message = "Enter a valid email address.";
    }

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
    const nextErrors: FieldErrors = validation.success ? {} : firstFieldErrors(validation.error.flatten().fieldErrors);

    if (isSignup && password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (isSignup && !acceptedTerms) {
      nextErrors.consent = "Accept the terms to create your account.";
    }

    if (!validation.success || Object.keys(nextErrors).length > 0) {
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

      window.location.href = inviteToken
        ? `/member-invitations/${encodeURIComponent(inviteToken)}`
        : payload.data?.hasWedding
          ? "/dashboard"
          : "/onboarding";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className={`auth-form ${isSignup ? "auth-form--signup" : ""}`} onSubmit={handleSubmit}>
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
        {isSignup ? <small id={`${mode}-password-hint`}>Use at least 8 characters, with a mix of letters, numbers, or symbols.</small> : null}
      </label>

      {isSignup ? (
        <>
          <div className="password-strength" aria-live="polite">
            <div className="password-strength__label"><span>Password strength</span><strong>{passwordMeter.label}</strong></div>
            <div className="password-strength__track" aria-hidden="true"><i style={{ width: `${passwordMeter.score * 25}%` }} /></div>
          </div>

          <label className="field">
            <span>Confirm password</span>
            <input
              ref={confirmPasswordRef}
              aria-describedby={fieldErrors.confirmPassword ? "signup-confirm-password-error" : undefined}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              autoComplete="new-password"
              id="signup-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                clearFieldError("confirmPassword");
              }}
              onInvalid={(event) => handleNativeInvalid("confirmPassword", event.currentTarget)}
              required
            />
            {fieldErrors.confirmPassword ? <small id="signup-confirm-password-error" className="field-error">{fieldErrors.confirmPassword}</small> : null}
          </label>

          <label className={`auth-consent ${fieldErrors.consent ? "is-invalid" : ""}`}>
            <input
              ref={consentRef}
              aria-describedby={fieldErrors.consent ? "signup-consent-error" : undefined}
              aria-invalid={Boolean(fieldErrors.consent)}
              checked={acceptedTerms}
              onChange={(event) => {
                setAcceptedTerms(event.target.checked);
                clearFieldError("consent");
              }}
              onInvalid={(event) => handleNativeInvalid("consent", event.currentTarget)}
              type="checkbox"
              required
            />
            <span>I agree to the Make My Marriage terms and understand that this is a private wedding workspace.</span>
          </label>
          {fieldErrors.consent ? <small id="signup-consent-error" className="field-error auth-consent-error">{fieldErrors.consent}</small> : null}
        </>
      ) : null}

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <button className="button button--auth" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
