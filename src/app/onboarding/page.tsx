"use client";

import { FormEvent, useEffect, useState } from "react";

import { AuthBrand } from "@/app/auth/AuthBrand";

type MeResponse = {
  membership: { role: string } | null;
};

function formatPreviewDate(value: string) {
  if (!value) return "Your wedding date";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(`${value}T00:00:00.000Z`));
}

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
    <main className="auth-design-page onboarding-design-page">
      <header className="auth-design-header">
        <div className="auth-design-header__inner">
          <div className="auth-design-header__leading"><AuthBrand /><span className="auth-design-divider" aria-hidden="true" /><span className="onboarding-header-context">Wedding workspace setup</span></div>
          <div className="auth-design-header__trailing"><span className="onboarding-step">Step 1 of 1</span><span className="auth-design-profile" aria-hidden="true"><span className="material-symbols-outlined">person</span></span></div>
        </div>
      </header>

      <div className="auth-design-main">
        <div className="auth-design-content onboarding-design-content">
          <div className="auth-design-ambient auth-design-ambient--top" aria-hidden="true" />
          <div className="auth-design-ambient auth-design-ambient--bottom" aria-hidden="true" />
          <section className="onboarding-stage" aria-labelledby="onboarding-heading">
            <div className="onboarding-breadcrumb"><span>Make My Marriage</span><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span><strong>Wedding setup</strong></div>
            <div className="onboarding-grid">
              <section className="onboarding-form-panel">
                <header className="onboarding-heading">
                  <span className="section-eyebrow">Create your wedding</span>
                  <h1 id="onboarding-heading">Let&apos;s give your plans a home.</h1>
                  <p>Start with the details you already know. You can refine everything as your plans take shape.</p>
                </header>

                {isLoading ? <div className="onboarding-form-skeleton" aria-live="polite" role="status"><span className="onboarding-skeleton-line onboarding-skeleton-line--wide" /><span className="onboarding-skeleton-line" /><div className="onboarding-skeleton-fields"><span /><span /><span /><span /></div></div> : (
                  <form className="onboarding-form onboarding-form--design" onSubmit={handleSubmit}>
                    <div className="onboarding-form-section"><span className="onboarding-form-section__label">The people at the centre</span><div className="form-grid"><label className="field"><span>Bride&apos;s name</span><input value={brideName} onChange={(event) => setBrideName(event.target.value)} required /></label><label className="field"><span>Groom&apos;s name</span><input value={groomName} onChange={(event) => setGroomName(event.target.value)} required /></label></div></div>
                    <div className="onboarding-form-section"><span className="onboarding-form-section__label">When and where</span><div className="form-grid"><label className="field"><span>Wedding date</span><input type="date" value={weddingDate} onChange={(event) => setWeddingDate(event.target.value)} required /></label><label className="field"><span>City or location</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Bengaluru" required /></label><label className="field"><span>State <em>optional</em></span><input value={state} onChange={(event) => setState(event.target.value)} placeholder="e.g. Karnataka" /></label><label className="field"><span>Timezone</span><select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}><option value="Asia/Kolkata">India — Asia/Kolkata</option><option value="Asia/Dubai">UAE — Asia/Dubai</option><option value="Asia/Singapore">Singapore — Asia/Singapore</option><option value="UTC">UTC</option></select></label></div></div>
                    {error ? <p className="form-error" role="alert">{error}</p> : null}
                    <div className="onboarding-actions"><button className="button button--auth" disabled={isSubmitting} type="submit">{isSubmitting ? "Creating workspace…" : "Create wedding workspace"}</button><span>Your first wedding membership will be set as Admin.</span></div>
                  </form>
                )}
              </section>

              <aside className="onboarding-preview" aria-label="Wedding workspace preview">
                <div className="onboarding-preview__top"><span className="section-eyebrow">A first look</span><span className="onboarding-preview__status"><span aria-hidden="true">●</span> Private workspace</span></div>
                <div className="onboarding-preview__card">
                  <span className="onboarding-preview__label">Wedding space</span>
                  <h2>{brideName || "Your names"}{brideName || groomName ? " & " : " and "}{groomName || "your partner"}</h2>
                  <div className="onboarding-preview__details"><div><span className="material-symbols-outlined" aria-hidden="true">calendar_month</span><span><small>Date</small><strong>{formatPreviewDate(weddingDate)}</strong></span></div><div><span className="material-symbols-outlined" aria-hidden="true">location_on</span><span><small>Destination</small><strong>{city || "Your wedding city"}{state ? `, ${state}` : ""}</strong></span></div><div><span className="material-symbols-outlined" aria-hidden="true">schedule</span><span><small>Timezone</small><strong>{timeZone}</strong></span></div></div>
                </div>
                <div className="onboarding-preview__foundation"><span className="section-eyebrow">Your planning foundation</span><div className="onboarding-preview__foundation-grid"><div><span className="material-symbols-outlined" aria-hidden="true">event</span><strong>Events</strong><small>Ready to shape</small></div><div><span className="material-symbols-outlined" aria-hidden="true">checklist</span><strong>Tasks</strong><small>Ready to organise</small></div><div><span className="material-symbols-outlined" aria-hidden="true">groups</span><strong>Guests</strong><small>Add when ready</small></div></div></div>
                <p className="onboarding-preview__note"><span className="material-symbols-outlined" aria-hidden="true">lock</span>Your details stay inside your private wedding workspace.</p>
              </aside>
            </div>
          </section>
        </div>
        <footer className="auth-design-footer"><p>© 2025 Make My Marriage Technologies. Crafted with architectural warmth.</p><nav aria-label="Legal navigation"><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#help">Help</a></nav></footer>
      </div>
    </main>
  );
}
