"use client";

import Link from "next/link";

import { WorkspaceSidebar } from "@/app/workspace/WorkspaceSidebar";
import { formatEventDateTime } from "@/shared/events/time";
import { useEffect, useState } from "react";

type DashboardData = {
  user?: { name: string };
  wedding: { brideName: string; groomName: string; weddingDate: string; timeZone: string; location: { city: string } };
  membership: { role: string };
  countdown: { daysRemaining: number };
  summary: { events: number; tasks: { total: number; completed: number; dueSoon?: number; assignedToCurrent?: number }; guests: number; vendors: number };
  upcomingEvents: Array<{ id: string; name: string; startsAt: string; venueName: string | null }>;
  upcomingTasks: Array<{ id: string; title: string; dueDate: string | null; priority: string; event: { name: string } | null }>;
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

  if (error) return <main className="app-page"><div className="app-message"><h1>We couldn&apos;t open your workspace.</h1><p>{error}</p><Link className="button button--auth" href="/">Back home</Link></div></main>;
  if (!data) return <main className="app-page"><div className="app-message"><span className="section-eyebrow">Make My Marriage</span><h1>Opening your workspace…</h1></div></main>;

  const weddingDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(`${data.wedding.weddingDate}T00:00:00Z`));

  return (
    <main className="workspace-page app-page">
      <WorkspaceSidebar active="overview" />
      <section className="workspace-main">
        <header className="workspace-topbar"><div><span className="section-eyebrow">{data.membership.role} workspace</span><p>Everything important, in one calm place.</p></div><Link className="text-button" href="/settings/wedding">Wedding details</Link></header>
        <div className="app-shell">
        <section className="workspace-welcome"><div><span className="section-eyebrow">Your wedding workspace</span><h1>{data.wedding.brideName} &amp; {data.wedding.groomName}</h1><p>{weddingDate} · {data.wedding.location.city}</p></div><span className="countdown-badge">{data.countdown.daysRemaining} days to go</span></section>
        <section className="dashboard-grid" aria-label="Workspace summary">
          <article className="workspace-card"><span className="material-symbols-outlined">calendar_month</span><strong>{data.summary.events}</strong><span>Events planned</span></article>
          <article className="workspace-card"><span className="material-symbols-outlined">checklist</span><strong>{data.summary.tasks.completed}/{data.summary.tasks.total}</strong><span>Tasks complete</span></article>
          <article className="workspace-card"><span className="material-symbols-outlined">groups</span><strong>{data.summary.guests}</strong><span>Guests added</span></article>
          <article className="workspace-card"><span className="material-symbols-outlined">storefront</span><strong>{data.summary.vendors}</strong><span>Vendors saved</span></article>
        </section>
        <section className="dashboard-planning"><div className="dashboard-planning__header"><div><span className="section-eyebrow">The next moments</span><h2>Upcoming events &amp; tasks</h2></div><div className="dashboard-planning__links"><Link className="text-button" href="/events">View schedule</Link><Link className="text-button" href="/tasks">View checklist</Link></div></div><div className="dashboard-planning-grid"><div><span className="dashboard-planning__label">Events</span>{data.upcomingEvents.length > 0 ? <div className="dashboard-events-list">{data.upcomingEvents.map((event) => <Link className="dashboard-event-row" href="/events" key={event.id}><span className="dashboard-event-row__icon material-symbols-outlined" aria-hidden="true">event</span><span><strong>{event.name}</strong><small>{formatEventDateTime(event.startsAt, data.wedding.timeZone)}{event.venueName ? ` · ${event.venueName}` : ""}</small></span><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></Link>)}</div> : <p className="dashboard-planning__empty">No events are planned yet.</p>}</div><div><span className="dashboard-planning__label">Tasks</span>{data.upcomingTasks.length > 0 ? <div className="dashboard-events-list">{data.upcomingTasks.map((task) => <Link className="dashboard-event-row" href="/tasks" key={task.id}><span className="dashboard-event-row__icon material-symbols-outlined" aria-hidden="true">checklist</span><span><strong>{task.title}</strong><small>{task.dueDate ? `Due ${formatEventDateTime(task.dueDate, data.wedding.timeZone)}` : "No deadline"}{task.event ? ` · ${task.event.name}` : ""}</small></span><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></Link>)}</div> : <div className="dashboard-planning__empty"><p>No upcoming tasks yet.</p><Link className="text-button" href="/tasks">Add a task</Link></div>}</div></div></section>
        </div>
      </section>
    </main>
  );
}
