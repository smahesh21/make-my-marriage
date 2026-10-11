"use client";

import { FormEvent, useEffect, useState } from "react";

import { AuthBrand } from "@/app/auth/AuthBrand";

type MeResponse = {
  membership: { role: string } | null;
};

export default function OnboardingPage() {
  const [brideName, setBrideName] = useState("");
  const [groomName, setGroomName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me")
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return null;
        }
        const payload = (await response.json()) as { data?: MeResponse; error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load your account.");
        return payload.data;
      })
      .then((data) => {
        if (active && data?.membership) window.location.href = "/dashboard";
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load your account.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/wedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brideName,
          groomName,
          weddingDate,
          timeZone,
          location: { city, state },
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to create your wedding workspace.");
      window.location.href = "/dashboard";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create your wedding workspace.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-shell">
        <header className="onboarding-header">
          <AuthBrand className="auth-logo" markClassName="auth-logo__mark" />
          <span>Step 1 of 1</span>
        </header>
        <section className="onboarding-card" aria-labelledby="onboarding-heading">
          <div className="onboarding-heading">
            <span className="section-eyebrow">Set up your wedding</span>
            <h1 id="onboarding-heading">Let&apos;s give your plans a home.</h1>
            <p>Start with the details you already know. You can refine everything as your plans take shape.</p>
          </div>

          {isLoading ? <p className="loading-message">Checking your workspace…</p> : (
            <form className="onboarding-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="field"><span>Bride&apos;s name</span><input value={brideName} onChange={(event) => setBrideName(event.target.value)} required /></label>
                <label className="field"><span>Groom&apos;s name</span><input value={groomName} onChange={(event) => setGroomName(event.target.value)} required /></label>
                <label className="field"><span>Wedding date</span><input type="date" value={weddingDate} onChange={(event) => setWeddingDate(event.target.value)} required /></label>
                <label className="field"><span>City or location</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Bengaluru" required /></label>
                <label className="field"><span>State <em>optional</em></span><input value={state} onChange={(event) => setState(event.target.value)} placeholder="e.g. Karnataka" /></label>
                <label className="field"><span>Timezone</span><select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}><option value="Asia/Kolkata">India — Asia/Kolkata</option><option value="Asia/Dubai">UAE — Asia/Dubai</option><option value="Asia/Singapore">Singapore — Asia/Singapore</option><option value="UTC">UTC</option></select></label>
              </div>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <div className="onboarding-actions"><button className="button button--auth" disabled={isSubmitting} type="submit">{isSubmitting ? "Creating workspace…" : "Create wedding workspace"}</button><span>Your first wedding membership will be set as Admin.</span></div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
