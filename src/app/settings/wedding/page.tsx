"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { AuthBrand } from "@/app/auth/AuthBrand";
import { updateWeddingSchema } from "@/shared/wedding/schemas";

type WeddingData = {
  brideName: string;
  groomName: string;
  description?: string;
  weddingDate: string;
  timeZone: string;
  location: {
    city: string;
    state?: string;
    country?: string;
    formattedAddress?: string;
  };
};

type ApiPayload = {
  data?: WeddingData;
  error?: {
    message?: string;
    fields?: Record<string, string[] | undefined>;
  };
};

const timeZones = [
  ["Asia/Kolkata", "India — Asia/Kolkata"],
  ["Asia/Dubai", "UAE — Asia/Dubai"],
  ["Asia/Singapore", "Singapore — Asia/Singapore"],
  ["UTC", "UTC"],
] as const;

export default function WeddingDetailsPage() {
  const [brideName, setBrideName] = useState("");
  const [groomName, setGroomName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [formattedAddress, setFormattedAddress] = useState("");
  const [description, setDescription] = useState("");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/wedding")
      .then(async (response) => {
        const payload = (await response.json()) as ApiPayload;
        if (response.status === 401) {
          window.location.href = "/login";
          return null;
        }
        if (response.status === 404) {
          window.location.href = "/onboarding";
          return null;
        }
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load your wedding details.");
        return payload.data ?? null;
      })
      .then((wedding) => {
        if (!active || !wedding) return;
        setBrideName(wedding.brideName);
        setGroomName(wedding.groomName);
        setWeddingDate(wedding.weddingDate);
        setCity(wedding.location.city);
        setState(wedding.location.state ?? "");
        setCountry(wedding.location.country ?? "");
        setFormattedAddress(wedding.location.formattedAddress ?? "");
        setDescription(wedding.description ?? "");
        setTimeZone(wedding.timeZone);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load your wedding details.");
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
    setSuccess(null);

    const input = {
      brideName,
      groomName,
      weddingDate,
      timeZone,
      description,
      location: { city, state, country, formattedAddress },
    };
    const parsed = updateWeddingSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the highlighted details.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/wedding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        const fieldError = Object.values(payload.error?.fields ?? {})[0]?.[0];
        throw new Error(fieldError ?? payload.error?.message ?? "Unable to save your wedding details.");
      }
      setSuccess("Wedding details saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your wedding details.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-page settings-page">
      <header className="app-header">
        <AuthBrand className="auth-logo" markClassName="auth-logo__mark" />
        <div className="app-header-actions">
          <Link className="text-button" href="/dashboard">Back to dashboard</Link>
        </div>
      </header>

      <div className="app-shell settings-shell">
        <section className="settings-card" aria-labelledby="wedding-details-heading">
          <div className="settings-heading">
            <span className="section-eyebrow">Wedding settings</span>
            <h1 id="wedding-details-heading">Keep the important details close.</h1>
            <p>Update the details your family and planning workspace use as your celebration takes shape.</p>
          </div>

          {isLoading ? <p className="loading-message">Loading your wedding details…</p> : (
            <form className="settings-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="field"><span>Bride&apos;s name</span><input value={brideName} onChange={(event) => setBrideName(event.target.value)} required /></label>
                <label className="field"><span>Groom&apos;s name</span><input value={groomName} onChange={(event) => setGroomName(event.target.value)} required /></label>
                <label className="field"><span>Wedding date</span><input type="date" value={weddingDate} onChange={(event) => setWeddingDate(event.target.value)} required /></label>
                <label className="field"><span>Timezone</span><select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>{timeZones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="field"><span>City or location</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Bengaluru" required /></label>
                <label className="field"><span>State <em>optional</em></span><input value={state} onChange={(event) => setState(event.target.value)} placeholder="e.g. Karnataka" /></label>
                <label className="field"><span>Country <em>optional</em></span><input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="e.g. India" /></label>
                <label className="field"><span>Full location <em>optional</em></span><input value={formattedAddress} onChange={(event) => setFormattedAddress(event.target.value)} placeholder="e.g. Bengaluru, Karnataka, India" /></label>
              </div>
              <label className="field"><span>Description <em>optional</em></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} placeholder="A short note about your celebration" /></label>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              {success ? <p className="form-success" role="status">{success}</p> : null}
              <div className="settings-actions"><button className="button button--auth" disabled={isSaving} type="submit">{isSaving ? "Saving changes…" : "Save changes"}</button><Link className="button button--quiet" href="/dashboard">Cancel</Link></div>
              <p className="settings-note">Your wedding website address stays the same when you update these details.</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
