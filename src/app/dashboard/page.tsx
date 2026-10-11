"use client";

import Link from "next/link";

import { AuthBrand } from "@/app/auth/AuthBrand";
import { useEffect, useState } from "react";

type DashboardData = {
  user?: { name: string };
  wedding: { brideName: string; groomName: string; weddingDate: string; location: { city: string } };
  membership: { role: string };
  countdown: { daysRemaining: number };
  summary: { events: number; tasks: { total: number; completed: number }; guests: number; vendors: number };
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (response) => {
        const payload = (await response.json()) as { data?: DashboardData; error?: { code?: string; message?: string } };
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (payload.error?.code === "WEDDING_NOT_FOUND") {
          window.location.href = "/onboarding";
          return;
        }
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to load your dashboard.");
        setData(payload.data ?? null);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load your dashboard."));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (error) return <main className="app-page"><div className="app-message"><h1>We couldn&apos;t open your workspace.</h1><p>{error}</p><Link className="button button--auth" href="/">Back home</Link></div></main>;
  if (!data) return <main className="app-page"><div className="app-message"><span className="section-eyebrow">Make My Marriage</span><h1>Opening your workspace…</h1></div></main>;

  const weddingDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(`${data.wedding.weddingDate}T00:00:00Z`));

  return (
    <main className="app-page">
      <header className="app-header"><AuthBrand className="auth-logo" markClassName="auth-logo__mark" /><div className="app-header-actions"><span>{data.membership.role}</span><Link className="text-button" href="/settings/wedding">Wedding details</Link><button className="text-button" onClick={logout} type="button">Sign out</button></div></header>
      <div className="app-shell">
        <section className="workspace-welcome"><div><span className="section-eyebrow">Your wedding workspace</span><h1>{data.wedding.brideName} &amp; {data.wedding.groomName}</h1><p>{weddingDate} · {data.wedding.location.city}</p></div><span className="countdown-badge">{data.countdown.daysRemaining} days to go</span></section>
        <section className="dashboard-grid" aria-label="Workspace summary">
          <article className="workspace-card"><span className="material-symbols-outlined">calendar_month</span><strong>{data.summary.events}</strong><span>Events planned</span></article>
          <article className="workspace-card"><span className="material-symbols-outlined">checklist</span><strong>{data.summary.tasks.completed}/{data.summary.tasks.total}</strong><span>Tasks complete</span></article>
          <article className="workspace-card"><span className="material-symbols-outlined">groups</span><strong>{data.summary.guests}</strong><span>Guests added</span></article>
          <article className="workspace-card"><span className="material-symbols-outlined">storefront</span><strong>{data.summary.vendors}</strong><span>Vendors saved</span></article>
        </section>
        <section className="dashboard-empty"><span className="material-symbols-outlined">celebration</span><h2>Your shared plan starts here.</h2><p>Events, tasks, guests, invitations, and every thoughtful detail can grow from this first workspace.</p><div className="dashboard-empty__actions"><button className="button button--auth" type="button">Add your first event</button><button className="button button--quiet" type="button">Create a task</button></div><small>Planning modules will open as you add them.</small></section>
      </div>
    </main>
  );
}
