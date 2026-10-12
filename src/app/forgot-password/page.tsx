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
    <main className="auth-design-page auth-recovery-page">
      <header className="auth-design-header">
        <div className="auth-design-header__inner">
          <div className="auth-design-header__leading">
            <AuthBrand />
            <span className="auth-design-divider" aria-hidden="true" />
            <Link className="auth-design-back" href="/"><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>Back to home</Link>
          </div>
          <div className="auth-design-header__trailing">
            <nav className="auth-design-nav" aria-label="Authentication navigation">
              <Link href="/#features">Explore</Link>
              <Link href="/#how-it-works">Concierge</Link>
              <Link className="is-active" href="/login" aria-current="page">Sign In</Link>
            </nav>
            <span className="auth-design-profile" aria-hidden="true"><span className="material-symbols-outlined">person</span></span>
          </div>
        </div>
      </header>

      <div className="auth-design-main">
        <div className="auth-design-content">
          <div className="auth-design-ambient auth-design-ambient--top" aria-hidden="true" />
          <div className="auth-design-ambient auth-design-ambient--bottom" aria-hidden="true" />
          <section className="recovery-card" aria-labelledby="forgot-password-heading">
            <header className="recovery-card__header">
              <span className="section-eyebrow">Account access</span>
              <h1 id="forgot-password-heading">Find your way back.</h1>
              <p>We&apos;ll help you return to the wedding workspace you&apos;ve been building together.</p>
            </header>

            {isSubmitted ? (
              <div className="recovery-success" role="status">
                <span className="recovery-success__icon"><span className="material-symbols-outlined" aria-hidden="true">mark_email_read</span></span>
                <h2>Check your inbox.</h2>
                <p>If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. Check your spam folder too.</p>
                <Link className="button button--auth" href="/login">Back to sign in</Link>
              </div>
            ) : (
              <form className="auth-form recovery-form" onSubmit={handleSubmit}>
                <p className="recovery-form__intro">Enter your account email and we&apos;ll send a secure link to choose a new password.</p>
                <label className="field">
                  <span>Email address</span>
                  <input autoComplete="email" inputMode="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                {error ? <p className="form-error" role="alert">{error}</p> : null}
                <button className="button button--auth" disabled={isSubmitting} type="submit">{isSubmitting ? "Sending link…" : "Send reset link"}</button>
                <p className="recovery-form__note"><span className="material-symbols-outlined" aria-hidden="true">lock</span>Reset links expire after 30 minutes and can only be used once.</p>
              </form>
            )}

            <p className="auth-switch">Remembered it? <Link href="/login">Return to sign in</Link></p>
          </section>
        </div>
        <footer className="auth-design-footer">
          <p>© 2025 Make My Marriage Technologies. Crafted with architectural warmth.</p>
          <nav aria-label="Legal navigation"><Link href="#privacy">Privacy</Link><Link href="#terms">Terms</Link><Link href="#help">Help</Link></nav>
        </footer>
      </div>
    </main>
  );
}
