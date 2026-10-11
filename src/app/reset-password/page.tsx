"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { AuthBrand } from "@/app/auth/AuthBrand";
import { resetPasswordSchema } from "@/shared/auth/schemas";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReset, setIsReset] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
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

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-intro">
          <AuthBrand className="auth-logo" markClassName="auth-logo__mark" />
          <div>
            <span className="section-eyebrow">Account access</span>
            <h1>A fresh start, securely.</h1>
            <p>Choose a new password and return to the plans that matter.</p>
          </div>
          <span className="auth-note">Your existing wedding workspace stays unchanged.</span>
        </section>
        <section className="auth-card" aria-labelledby="reset-password-heading">
          <span className="section-eyebrow">Reset password</span>
          <h2 id="reset-password-heading">Choose a new password.</h2>
          {isReset ? (
            <>
              <p className="auth-card__intro">Your password has been reset. All previous sign-in sessions have been closed.</p>
              <Link className="button button--auth" href="/login">Continue to sign in</Link>
            </>
          ) : (
            <>
              <p className="auth-card__intro">Use at least eight characters. This reset link can only be used once.</p>
              <form className="auth-form" onSubmit={handleSubmit}>
                <label className="field"><span>New password</span><input autoComplete="new-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
                <label className="field"><span>Confirm new password</span><input autoComplete="new-password" name="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} /></label>
                {error ? <p className="form-error" role="alert">{error}</p> : null}
                <button className="button button--auth" disabled={isSubmitting} type="submit">{isSubmitting ? "Resetting password…" : "Reset password"}</button>
              </form>
            </>
          )}
          <p className="auth-switch"><Link href="/login">Return to sign in</Link></p>
        </section>
      </div>
    </main>
  );
}
