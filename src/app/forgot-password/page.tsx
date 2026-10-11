"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { AuthBrand } from "@/app/auth/AuthBrand";
import { forgotPasswordSchema } from "@/shared/auth/schemas";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to request a password reset.");
      setIsSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to request a password reset.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-intro">
          <AuthBrand className="auth-logo" markClassName="auth-logo__mark" />
          <div>
            <span className="section-eyebrow">Account access</span>
            <h1>A calm way back in.</h1>
            <p>We&apos;ll help you return to the wedding workspace you&apos;ve been building together.</p>
          </div>
          <span className="auth-note">Reset links are short-lived and can only be used once.</span>
        </section>
        <section className="auth-card" aria-labelledby="forgot-password-heading">
          <span className="section-eyebrow">Forgot password</span>
          <h2 id="forgot-password-heading">Find your way back.</h2>
          {isSubmitted ? (
            <>
              <p className="auth-card__intro">If an account exists for that email, we&apos;ve sent a password reset link. Check your inbox and spam folder.</p>
              <Link className="button button--auth" href="/login">Back to sign in</Link>
            </>
          ) : (
            <>
              <p className="auth-card__intro">Enter your account email and we&apos;ll send a secure link to choose a new password.</p>
              <form className="auth-form" onSubmit={handleSubmit}>
                <label className="field"><span>Email address</span><input autoComplete="email" inputMode="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
                {error ? <p className="form-error" role="alert">{error}</p> : null}
                <button className="button button--auth" disabled={isSubmitting} type="submit">{isSubmitting ? "Sending link…" : "Send reset link"}</button>
              </form>
            </>
          )}
          <p className="auth-switch">Remembered it? <Link href="/login">Return to sign in</Link></p>
        </section>
      </div>
    </main>
  );
}
