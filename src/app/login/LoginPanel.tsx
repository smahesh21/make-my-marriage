"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type DemoState = "default" | "error" | "loading";

export function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoState, setDemoState] = useState<DemoState>("default");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPreviewLoading = demoState === "loading" && !isSubmitting;
  const isLoading = isSubmitting || isPreviewLoading;
  const visibleError = error ?? (demoState === "error" ? "Invalid email or password." : null);

  function selectDemoState(nextState: DemoState) {
    setDemoState(nextState);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDemoState("default");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberDevice }),
      });
      const payload = (await response.json()) as {
        data?: { hasWedding?: boolean };
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Something went wrong. Please try again.");
      }

      window.location.href = payload.data?.hasWedding ? "/dashboard" : "/onboarding";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
      setDemoState("error");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-stage">
      <div className="auth-state-switcher" role="group" aria-label="Sign in preview states">
        <span>Simulate:</span>
        <button className={demoState === "default" ? "is-active" : ""} onClick={() => selectDemoState("default")} type="button" aria-pressed={demoState === "default"}>
          Default
        </button>
        <button className={demoState === "error" ? "is-active" : ""} onClick={() => selectDemoState("error")} type="button" aria-pressed={demoState === "error"}>
          Error Alert
        </button>
        <button className={demoState === "loading" ? "is-active" : ""} onClick={() => selectDemoState("loading")} type="button" aria-pressed={demoState === "loading"}>
          Loading
        </button>
      </div>

      <section className="login-card" aria-labelledby="login-heading">
        <header className="login-card__header">
          <div className="login-card__eyebrow"><span aria-hidden="true" />Welcome back</div>
          <h1 id="login-heading">Welcome back.</h1>
          <p>Pick up where your wedding plans left off.</p>
        </header>

        {visibleError ? (
          <div className="login-error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            <div>
              <p>{visibleError}</p>
              <small>Please check your details and try again, or reset your password.</small>
            </div>
          </div>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Email address</span>
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="login-field">
            <span className="login-field__label-row">
              <span>Password</span>
              <Link href="/forgot-password">Forgot password?</Link>
            </span>
            <span className="login-input-wrap">
              <input
                autoComplete="current-password"
                name="password"
                placeholder="••••••••••••"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="login-password-toggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">{showPassword ? "visibility_off" : "visibility"}</span>
              </button>
            </span>
          </label>

          <label className="login-remember">
            <input
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
              type="checkbox"
            />
            <span className="login-checkbox" aria-hidden="true">
              {rememberDevice ? <span className="material-symbols-outlined">check</span> : null}
            </span>
            <span>Remember this device for 30 days</span>
          </label>

          <button className="login-submit" disabled={isLoading} type="submit">
            {isLoading ? (
              <span className="login-submit__content"><span className="login-spinner" aria-hidden="true" />Signing in...</span>
            ) : "Sign in"}
          </button>
        </form>

        <footer className="login-card__footer">
          <p>New here? <Link href="/signup">Create an account</Link></p>
          <div className="login-security"><span className="material-symbols-outlined" aria-hidden="true">lock</span>Secured with enterprise-grade session encryption.</div>
        </footer>
      </section>

      <div className="login-workspace-label">Wedding Planner &amp; Workspace</div>
    </div>
  );
}
