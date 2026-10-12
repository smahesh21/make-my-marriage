"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { AuthBrand } from "@/app/auth/AuthBrand";
import { resetPasswordSchema } from "@/shared/auth/schemas";

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

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const passwordMeter = passwordStrength(password);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please choose a valid password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to reset your password.");
      setIsReset(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reset your password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasToken = token !== null && token.length > 0;

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
          <section className="recovery-card" aria-labelledby="reset-password-heading">
            <header className="recovery-card__header">
              <span className="section-eyebrow">Account access</span>
              <h1 id="reset-password-heading">Choose a new password.</h1>
              <p>Set a fresh password and return to the plans that matter.</p>
            </header>

            {isReset ? (
              <div className="recovery-success" role="status">
                <span className="recovery-success__icon"><span className="material-symbols-outlined" aria-hidden="true">verified</span></span>
                <h2>You&apos;re all set.</h2>
                <p>Your password has been reset and all previous sign-in sessions have been closed.</p>
                <Link className="button button--auth" href="/login">Continue to sign in</Link>
              </div>
            ) : !hasToken ? (
              <div className="recovery-error" role="alert">
                <span className="recovery-error__icon"><span className="material-symbols-outlined" aria-hidden="true">link_off</span></span>
                <h2>This reset link is missing.</h2>
                <p>Request a new password reset link to continue.</p>
                <Link className="button button--auth" href="/forgot-password">Request a new link</Link>
              </div>
            ) : (
              <form className="auth-form recovery-form" onSubmit={handleSubmit}>
                <p className="recovery-form__intro">Use at least eight characters. This reset link can only be used once.</p>
                <label className="field">
                  <span>New password</span>
                  <input autoComplete="new-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
                </label>
                <div className="password-strength" aria-live="polite">
                  <div className="password-strength__label"><span>Password strength</span><strong>{passwordMeter.label}</strong></div>
                  <div className="password-strength__track" aria-hidden="true"><i style={{ width: `${passwordMeter.score * 25}%` }} /></div>
                </div>
                <label className="field">
                  <span>Confirm new password</span>
                  <input autoComplete="new-password" name="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} />
                </label>
                {error ? <p className="form-error" role="alert">{error}</p> : null}
                <button className="button button--auth" disabled={isSubmitting} type="submit">{isSubmitting ? "Resetting password…" : "Reset password"}</button>
              </form>
            )}

            <p className="auth-switch"><Link href="/login">Return to sign in</Link></p>
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
