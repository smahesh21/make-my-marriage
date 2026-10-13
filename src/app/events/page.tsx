"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { WorkspaceSidebar } from "@/app/workspace/WorkspaceSidebar";
import { dateTimeInputToIso, formatEventDate, formatEventTime, toDateInputValue, toTimeInputValue } from "@/shared/events/time";
import { type EventType } from "@/shared/events/schemas";

type WeddingEvent = {
  id: string;
  name: string;
  type: EventType | null;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  address: string | null;
  description: string | null;
  dressCode: string | null;
  archivedAt: string | null;
};

type ApiError = { code?: string; message?: string; fields?: Record<string, string[] | undefined> };
type AuthData = {
  user?: { name?: string };
  membership?: { role: "ADMIN" | "MANAGER" } | null;
  wedding?: { brideName: string; groomName: string; weddingDate: string; timeZone: string } | null;
};

type EventForm = {
  name: string;
  type: EventType | "";
  date: string;
  startTime: string;
  endTime: string;
  venueName: string;
  address: string;
  dressCode: string;
  description: string;
};

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  ROKA: "Roka",
  ENGAGEMENT: "Engagement",
  MEHENDI: "Mehendi",
  HALDI: "Haldi",
  SANGEET: "Sangeet",
  COCKTAIL: "Cocktail",
  WEDDING: "Wedding ceremony",
  RECEPTION: "Reception",
  CUSTOM: "Custom event",
};

const EVENT_TYPE_ICONS: Record<EventType, string> = {
  ROKA: "favorite",
  ENGAGEMENT: "diamond",
  MEHENDI: "spa",
  HALDI: "wb_sunny",
  SANGEET: "music_note",
  COCKTAIL: "local_bar",
  WEDDING: "church",
  RECEPTION: "celebration",
  CUSTOM: "event_note",
};

const defaultForm: EventForm = {
  name: "",
  type: "",
  date: "",
  startTime: "10:00",
  endTime: "12:00",
  venueName: "",
  address: "",
  dressCode: "",
  description: "",
};

function getEventLabel(event: WeddingEvent) {
  return event.type ? EVENT_TYPE_LABELS[event.type] : "Wedding event";
}

function sortEvents(events: WeddingEvent[]) {
  return [...events].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
}

function toForm(event: WeddingEvent, timeZone: string): EventForm {
  return {
    name: event.name,
    type: event.type ?? "",
    date: toDateInputValue(event.startsAt, timeZone),
    startTime: toTimeInputValue(event.startsAt, timeZone),
    endTime: event.endsAt ? toTimeInputValue(event.endsAt, timeZone) : "",
    venueName: event.venueName ?? "",
    address: event.address ?? "",
    dressCode: event.dressCode ?? "",
    description: event.description ?? "",
  };
}

function EventsLoadingState() {
  return (
    <main className="workspace-page events-page--loading" aria-busy="true">
      <aside className="members-sidebar members-sidebar--skeleton" aria-hidden="true"><span className="members-skeleton members-skeleton--brand" /><span className="members-skeleton members-skeleton--wedding" /><span className="members-skeleton" /><span className="members-skeleton" /><span className="members-skeleton" /></aside>
      <section className="events-content events-loading" aria-live="polite" role="status">
        <div className="events-loading__header"><span className="members-skeleton members-skeleton--eyebrow" /><span className="members-skeleton members-skeleton--title" /><span className="members-skeleton members-skeleton--copy" /></div>
        <div className="events-loading__metrics"><span /><span /><span /></div>
        <div className="events-loading__timeline"><span /><span /><span /></div>
        <span className="members-loading__message">Opening your ceremony schedule…</span>
      </section>
    </main>
  );
}

function EventsLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="workspace-page events-page--loading">
      <section className="members-load-error" role="alert" aria-live="assertive">
        <span className="member-invite-icon member-invite-icon--error"><span className="material-symbols-outlined" aria-hidden="true">cloud_off</span></span>
        <span className="section-eyebrow">Events &amp; schedule</span>
        <h1>We couldn&apos;t open your schedule.</h1>
        <p>{message}</p>
        <button className="button" onClick={onRetry} type="button">Try again</button>
      </section>
    </main>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<WeddingEvent[]>([]);
  const [weddingName, setWeddingName] = useState("Your wedding workspace");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [currentRole, setCurrentRole] = useState<"ADMIN" | "MANAGER" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<WeddingEvent | null>(null);
  const [form, setForm] = useState<EventForm>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [eventsResponse, authResponse] = await Promise.all([fetch("/api/events"), fetch("/api/auth/me")]);
      const eventsPayload = (await eventsResponse.json()) as { data?: WeddingEvent[]; error?: ApiError };
      const authPayload = (await authResponse.json()) as { data?: AuthData; error?: ApiError };

      if (eventsResponse.status === 401 || authResponse.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (eventsResponse.status === 404 || authPayload.data?.membership === null) {
        window.location.href = "/onboarding";
        return;
      }
      if (!eventsResponse.ok) throw new Error(eventsPayload.error?.message ?? "Unable to load wedding events.");

      setEvents(sortEvents(eventsPayload.data ?? []));
      const wedding = authPayload.data?.wedding;
      if (wedding) {
        setWeddingName(`${wedding.brideName} & ${wedding.groomName}`);
        setTimeZone(wedding.timeZone);
      }
      setCurrentRole(authPayload.data?.membership?.role ?? null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load wedding events.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData, loadAttempt]);

  const upcomingEvents = useMemo(() => events.filter((event) => new Date(event.startsAt).getTime() >= Date.now()), [events]);
  const visibleEvents = filter === "upcoming" ? upcomingEvents : events;
  const nextEvent = upcomingEvents[0] ?? null;

  function openCreate() {
    setEditingEvent(null);
    setForm({ ...defaultForm, date: nextEvent ? toDateInputValue(nextEvent.startsAt, timeZone) : "" });
    setError(null);
    setNotice(null);
    setIsDrawerOpen(true);
  }

  function openEdit(event: WeddingEvent) {
    setEditingEvent(event);
    setForm(toForm(event, timeZone));
    setError(null);
    setNotice(null);
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    if (isSubmitting) return;
    setIsDrawerOpen(false);
    setEditingEvent(null);
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!form.date || !form.startTime) {
      setError("Choose a date and start time for this event.");
      return;
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        startsAt: dateTimeInputToIso(form.date, form.startTime, timeZone),
        ...(form.type ? { type: form.type } : {}),
        ...(form.endTime ? { endsAt: dateTimeInputToIso(form.date, form.endTime, timeZone) } : editingEvent ? { endsAt: null } : {}),
        venueName: form.venueName,
        address: form.address,
        dressCode: form.dressCode,
        description: form.description,
      };
      const response = await fetch(editingEvent ? `/api/events/${editingEvent.id}` : "/api/events", {
        method: editingEvent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { data?: WeddingEvent; error?: ApiError };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Unable to save this event.");

      setEvents((current) => sortEvents(editingEvent ? current.map((item) => item.id === payload.data!.id ? payload.data! : item) : [...current, payload.data!]));
      setNotice(editingEvent ? "Event details updated." : "Event added to your schedule.");
      setIsDrawerOpen(false);
      setEditingEvent(null);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function archiveEvent(event: WeddingEvent) {
    if (!window.confirm(`Archive ${event.name}? It will be kept safely but removed from the active schedule.`)) return;
    setActingId(event.id);
    setError(null);
    try {
      const response = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: ApiError };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to archive this event.");
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setNotice("Event archived from the active schedule.");
    } catch (archiveError: unknown) {
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive this event.");
    } finally {
      setActingId(null);
    }
  }

  if (isLoading) return <EventsLoadingState />;
  if (error && events.length === 0 && !isDrawerOpen) return <EventsLoadError message={error} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />;

  return (
    <main className="workspace-page events-page">
      <WorkspaceSidebar weddingName={weddingName} active="events" />
      <section className="events-content">
        <header className="workspace-topbar"><div><span className="section-eyebrow">{currentRole ?? "Member"} workspace</span><p>Give every meaningful moment its place.</p></div><Link className="text-button" href="/settings/wedding">Wedding details</Link></header>
        <div className="events-shell">
          <header className="events-hero">
            <div className="events-hero__copy"><span className="section-eyebrow">Your wedding timeline</span><h1>Events &amp; schedule</h1><p>Shape the rhythm of your celebration, from the first family gathering to the final toast.</p></div>
            <button className="button events-primary-action" onClick={openCreate} type="button"><span className="material-symbols-outlined" aria-hidden="true">add</span>Add event</button>
          </header>

          {error ? <div className="members-alert form-error" role="alert">{error}</div> : null}
          {notice ? <div className="members-alert form-success" role="status">{notice}</div> : null}

          <section className="events-metrics" aria-label="Schedule summary">
            <article><span className="material-symbols-outlined" aria-hidden="true">event</span><div><small>Total events</small><strong>{events.length}</strong><span>in your schedule</span></div></article>
            <article><span className="material-symbols-outlined" aria-hidden="true">schedule</span><div><small>Upcoming</small><strong>{upcomingEvents.length}</strong><span>still to come</span></div></article>
            <article><span className="material-symbols-outlined" aria-hidden="true">calendar_month</span><div><small>Wedding date</small><strong>{nextEvent ? formatEventDate(nextEvent.startsAt, timeZone).split(",")[0] : "—"}</strong><span>{nextEvent ? formatEventTime(nextEvent.startsAt, timeZone) : "Add your first event"}</span></div></article>
          </section>

          <section className="events-layout">
            <div className="events-main-panel">
              <div className="events-panel-heading"><div><span className="events-panel-eyebrow">The family plan</span><h2>Every moment, beautifully in sequence</h2></div><div className="events-filter" role="tablist" aria-label="Filter events"><button className={filter === "upcoming" ? "is-active" : ""} onClick={() => setFilter("upcoming")} role="tab" aria-selected={filter === "upcoming"} type="button">Upcoming</button><button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")} role="tab" aria-selected={filter === "all"} type="button">All events</button></div></div>
              {visibleEvents.length === 0 ? (
                <div className="events-empty"><span className="events-empty__mark"><span className="material-symbols-outlined" aria-hidden="true">event_available</span></span><div><h3>{filter === "upcoming" && events.length > 0 ? "Your past moments are here." : "Begin your wedding timeline."}</h3><p>{filter === "upcoming" && events.length > 0 ? "Switch to all events to revisit the moments already planned." : "Add the ceremonies, gatherings, and celebrations that will make your wedding yours."}</p>{filter === "upcoming" && events.length > 0 ? <button className="button button--quiet" onClick={() => setFilter("all")} type="button">View all events</button> : <button className="button" onClick={openCreate} type="button">Add your first event</button>}</div></div>
              ) : (
                <ol className="events-timeline">
                  {visibleEvents.map((event, index) => <li className="events-timeline__item" key={event.id}><div className="events-timeline__rail" aria-hidden="true"><span>{String(index + 1).padStart(2, "0")}</span></div><article className="event-card"><div className="event-card__date"><span>{formatEventDate(event.startsAt, timeZone)}</span><strong>{formatEventTime(event.startsAt, timeZone)}</strong></div><div className="event-card__body"><div className="event-card__icon"><span className="material-symbols-outlined" aria-hidden="true">{event.type ? EVENT_TYPE_ICONS[event.type] : "event_note"}</span></div><div className="event-card__copy"><span className="event-card__type">{getEventLabel(event)}</span><h3>{event.name}</h3>{event.venueName || event.address ? <p className="event-card__location"><span className="material-symbols-outlined" aria-hidden="true">location_on</span>{[event.venueName, event.address].filter(Boolean).join(" · ")}</p> : null}{event.description ? <p className="event-card__description">{event.description}</p> : null}<div className="event-card__meta">{event.endsAt ? <span><span className="material-symbols-outlined" aria-hidden="true">schedule</span>Until {formatEventTime(event.endsAt, timeZone)}</span> : null}{event.dressCode ? <span><span className="material-symbols-outlined" aria-hidden="true">checkroom</span>{event.dressCode}</span> : null}</div></div><div className="event-card__actions"><button aria-label={`Edit ${event.name}`} className="icon-button" onClick={() => openEdit(event)} type="button"><span className="material-symbols-outlined" aria-hidden="true">edit</span></button><button aria-label={`Archive ${event.name}`} className="icon-button icon-button--muted" disabled={actingId === event.id} onClick={() => void archiveEvent(event)} type="button"><span className="material-symbols-outlined" aria-hidden="true">archive</span></button></div></div></article></li>)}
                </ol>
              )}
            </div>
            <aside className="events-aside">
              <div className="events-aside__card events-aside__card--accent"><span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span><span className="events-panel-eyebrow">A thoughtful rhythm</span><h2>One shared calendar for every celebration.</h2><p>Keep family members aligned on dates, places, and the little details that make each event special.</p></div>
              <div className="events-aside__card"><span className="events-panel-eyebrow">Planning notes</span><div className="events-aside__note"><span className="material-symbols-outlined" aria-hidden="true">public</span><p>Times are shown in your wedding timezone.</p></div><div className="events-aside__note"><span className="material-symbols-outlined" aria-hidden="true">group</span><p>Admins and Managers can keep the schedule up to date.</p></div><div className="events-aside__note"><span className="material-symbols-outlined" aria-hidden="true">lock</span><p>Your timeline stays private to this wedding workspace.</p></div></div>
            </aside>
          </section>
        </div>
      </section>

      {isDrawerOpen ? <div className="events-drawer-layer"><button className="events-drawer-backdrop" aria-label="Close event form" onClick={closeDrawer} type="button" /><aside className="events-drawer" aria-labelledby="event-form-title"><header className="events-drawer__header"><div><span className="section-eyebrow">{editingEvent ? "Edit schedule" : "New ceremony"}</span><h2 id="event-form-title">{editingEvent ? "Refine this moment" : "Add an event"}</h2><p>Capture the details your family will want close at hand.</p></div><button className="icon-button" aria-label="Close event form" onClick={closeDrawer} type="button"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></header><form className="events-form" onSubmit={submitEvent}><div className="events-form__section"><span className="events-form__label">The occasion</span><label className="field">Event name<input autoFocus maxLength={160} onChange={(change) => setForm((current) => ({ ...current, name: change.target.value }))} required value={form.name} /></label><label className="field">Event type<select onChange={(change) => setForm((current) => ({ ...current, type: change.target.value as EventType | "" }))} value={form.type}><option value="">Choose a type</option>{Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="events-form__section"><span className="events-form__label">When it happens</span><div className="form-grid"><label className="field">Date<input onChange={(change) => setForm((current) => ({ ...current, date: change.target.value }))} required type="date" value={form.date} /></label><label className="field">Start time<input onChange={(change) => setForm((current) => ({ ...current, startTime: change.target.value }))} required type="time" value={form.startTime} /></label></div><label className="field">End time <em>optional</em><input onChange={(change) => setForm((current) => ({ ...current, endTime: change.target.value }))} type="time" value={form.endTime} /></label></div><div className="events-form__section"><span className="events-form__label">Where it happens</span><div className="form-grid"><label className="field">Venue name <em>optional</em><input maxLength={160} onChange={(change) => setForm((current) => ({ ...current, venueName: change.target.value }))} value={form.venueName} /></label><label className="field">Dress code <em>optional</em><input maxLength={160} onChange={(change) => setForm((current) => ({ ...current, dressCode: change.target.value }))} value={form.dressCode} /></label></div><label className="field">Address <em>optional</em><input maxLength={240} onChange={(change) => setForm((current) => ({ ...current, address: change.target.value }))} value={form.address} /></label></div><div className="events-form__section"><span className="events-form__label">A little more</span><label className="field">Description <em>optional</em><textarea maxLength={1000} onChange={(change) => setForm((current) => ({ ...current, description: change.target.value }))} rows={4} value={form.description} /></label></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<footer className="events-drawer__footer"><button className="button button--quiet" disabled={isSubmitting} onClick={closeDrawer} type="button">Cancel</button><button className="button" disabled={isSubmitting} type="submit">{isSubmitting ? "Saving…" : editingEvent ? "Save changes" : "Add event"}</button></footer></form></aside></div> : null}
    </main>
  );
}

