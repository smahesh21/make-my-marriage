"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { WorkspaceSidebar } from "@/app/workspace/WorkspaceSidebar";
import { createGuestSchema } from "@/shared/guests/schemas";
import type {
  Guest,
  GuestPagination,
  GuestSummary,
} from "@/shared/guests/types";
import { GuestApiError, requestGuestApi } from "./api";
import { GuestDialog } from "./GuestDialog";
import { GuestInvitationActions } from "./GuestInvitationActions";

type EventOption = {
  id: string;
  name: string;
  startsAt: string;
  archivedAt: string | null;
};
type Workspace = {
  user: { id: string };
  membership: { weddingId: string; role: "ADMIN" | "MANAGER" } | null;
  wedding: { brideName: string; groomName: string; timeZone: string } | null;
};
type Form = {
  name: string;
  email: string;
  phone: string;
  maxGuests: string;
  invitedEventIds: string[];
  notes: string;
};
type Registry = { data: Guest[]; pagination: GuestPagination };
type Filters = {
  search: string;
  rsvpStatus: string;
  eventId: string;
  invitationSent: string;
};
const initialForm: Form = {
  name: "",
  email: "",
  phone: "",
  maxGuests: "1",
  invitedEventIds: [],
  notes: "",
};
const initialFilters: Filters = {
  search: "",
  rsvpStatus: "",
  eventId: "",
  invitationSent: "",
};
const labels = {
  PENDING: "Pending",
  ATTENDING: "Attending",
  NOT_ATTENDING: "Not Attending",
};
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Unable to complete this request. Please try again.";
const identity = (workspace: Workspace) =>
  `${workspace.user.id}:${workspace.membership?.weddingId}`;
function toForm(guest: Guest): Form {
  return {
    name: guest.name,
    email: guest.email ?? "",
    phone: guest.phone ?? "",
    maxGuests: String(guest.maxGuests),
    invitedEventIds: guest.invitedEventIds,
    notes: guest.notes ?? "",
  };
}
function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  );
}
function RsvpBadge({ guest }: { guest: Guest }) {
  return (
    <span
      className={`guest-status guest-status--${guest.rsvpStatus.toLowerCase()}`}
    >
      {labels[guest.rsvpStatus]}
      {guest.attendingCount !== null ? (
        <small> · {guest.attendingCount} confirmed</small>
      ) : null}
    </span>
  );
}

export default function GuestsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [summary, setSummary] = useState<GuestSummary | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<
    "add" | "edit" | "details" | "delete" | null
  >(null);
  const [selected, setSelected] = useState<Guest | null>(null);
  const [form, setForm] = useState<Form>(initialForm);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [uncertainWrite, setUncertainWrite] = useState(false);
  const generation = useRef(0);
  const owner = useRef<string | null>(null);
  const mutationInFlight = useRef(false);
  const guestRows = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    const openMenus = () =>
      guestRows.current?.querySelectorAll<HTMLDetailsElement>(
        "details.guest-actions[open]",
      ) ?? [];
    const dismiss = (event: Event) => {
      if (!(event.target instanceof Node)) return;
      for (const menu of openMenus()) {
        const actionSelected =
          event.type === "click" &&
          event.target instanceof Element &&
          !!event.target.closest("button");
        if (!menu.contains(event.target) || actionSelected) {
          menu.open = false;
          if (actionSelected && menu.contains(event.target))
            menu.querySelector("summary")?.focus();
        }
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const menu of openMenus()) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
        event.preventDefault();
      }
    };
    // Capture clicks before an action opens its dialog, so the menu cannot
    // remain open underneath it or reappear when the dialog is dismissed.
    document.addEventListener("click", dismiss, true);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", dismiss, true);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const checkOwner = useCallback(async () => {
    const auth = await requestGuestApi<{ data: Workspace }>("/api/auth/me");
    if (
      !auth.data?.membership ||
      !auth.data.wedding ||
      identity(auth.data) !== owner.current
    ) {
      setMode(null);
      setDirty(false);
      setSelected(null);
      setForm(initialForm);
      setRegistry(null);
      setSummary(null);
      throw new GuestApiError(
        "Your account or wedding changed. Refresh the list before making changes.",
        409,
        "ACCOUNT_CHANGED",
      );
    }
  }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setLoadError(null);
    try {
      const auth = await requestGuestApi<{ data: Workspace }>("/api/auth/me");
      if (current !== generation.current) return;
      if (!auth.data?.membership || !auth.data.wedding) {
        window.location.href = "/onboarding";
        return;
      }
      if (owner.current && owner.current !== identity(auth.data)) {
        setMode(null);
        setSelected(null);
        setForm(initialForm);
        setDirty(false);
        setDiscard(false);
        setRegistry(null);
        setSummary(null);
        setNotice(
          "Your account or wedding changed. The previous draft was cleared.",
        );
      }
      owner.current = identity(auth.data);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      for (const [key, value] of Object.entries(filters))
        if (value) params.set(key, value);
      const [list, totals, ceremonies] = await Promise.all([
        requestGuestApi<Registry>(`/api/guests?${params}`),
        requestGuestApi<{ data: GuestSummary }>("/api/guests/rsvp-summary"),
        requestGuestApi<{ data: EventOption[] }>(
          "/api/events?includeArchived=true",
        ),
      ]);
      if (current !== generation.current) return;
      if (
        !Array.isArray(list.data) ||
        !list.pagination ||
        !totals.data ||
        !Array.isArray(ceremonies.data) ||
        !Object.values(totals.data).every(Number.isFinite)
      )
        throw new Error(
          "The server returned an unexpected response. Please try again.",
        );
      setWorkspace(auth.data);
      setRegistry(list);
      setSummary(totals.data);
      setEvents(ceremonies.data);
      setNeedsSignIn(false);
      if (page > Math.max(1, list.pagination.totalPages))
        setPage(Math.max(1, list.pagination.totalPages));
    } catch (error) {
      if (current !== generation.current) return;
      setLoadError(message(error));
      if (error instanceof GuestApiError && error.status === 401)
        setNeedsSignIn(true);
      if (error instanceof GuestApiError && error.code === "WEDDING_NOT_FOUND")
        window.location.href = "/onboarding";
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [filters, page]);

  const invalidateLoads = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    void load();
    return invalidateLoads;
  }, [load, invalidateLoads]);
  useEffect(() => {
    const refresh = () => {
      if (mutationInFlight.current || (mode && mode !== "details")) return;
      void load();
      if (mode === "details" && selected) {
        void checkOwner()
          .then(() =>
            requestGuestApi<{ data: Guest }>(`/api/guests/${selected.id}`),
          )
          .then((response) =>
            setSelected((current) =>
              current?.id === selected.id ? response.data : current,
            ),
          )
          .catch((error: unknown) => {
            setActionError(message(error));
            if (error instanceof GuestApiError && error.status === 401)
              setNeedsSignIn(true);
          });
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "mmm-rsvp-updated") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [load, mode, selected, checkOwner]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.search === search.trim()
          ? current
          : { ...current, search: search.trim() },
      );
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function close() {
    if (mutationInFlight.current) return;
    if (dirty && !discard) {
      setDiscard(true);
      return;
    }
    if (dirty) return;
    setMode(null);
    setSelected(null);
    setActionError(null);
    setDiscard(false);
  }
  function open(next: NonNullable<typeof mode>, guest?: Guest) {
    setSelected(guest ?? null);
    setMode(next);
    setForm(guest ? toForm(guest) : initialForm);
    setDirty(false);
    setDiscard(false);
    setActionError(null);
    setFieldErrors({});
    setUncertainWrite(false);
  }
  function change<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setDiscard(false);
  }
  function failed(error: unknown) {
    setActionError(message(error));
    if (error instanceof GuestApiError) {
      setFieldErrors(error.fields ?? {});
      if (error.status === 401) setNeedsSignIn(true);
      if (error.status === 0 || error.code === "INVALID_RESPONSE")
        setUncertainWrite(true);
      if (error.code === "ACCOUNT_CHANGED") setLoadError(error.message);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (mutationInFlight.current) return;
    setActionError(null);
    setFieldErrors({});
    setUncertainWrite(false);
    const result = createGuestSchema.safeParse({
      ...form,
      maxGuests: Number(form.maxGuests),
    });
    if (!result.success) {
      setFieldErrors(result.error.flatten().fieldErrors);
      setActionError("Please check the highlighted fields.");
      return;
    }
    if (selected && result.data.maxGuests < (selected.attendingCount ?? 0)) {
      setFieldErrors({
        maxGuests: [
          "Party size cannot be less than already confirmed attendance.",
        ],
      });
      return;
    }
    mutationInFlight.current = true;
    setBusy(true);
    try {
      await checkOwner();
      await requestGuestApi<{ data: Guest }>(
        selected ? `/api/guests/${selected.id}` : "/api/guests",
        {
          method: selected ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        },
      );
      setMode(null);
      setDirty(false);
      setSelected(null);
      setForm(initialForm);
      setNotice(
        selected ? "Guest details updated." : "Guest invitation group added.",
      );
      await load();
    } catch (error) {
      failed(error);
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (!selected || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await checkOwner();
      await requestGuestApi<{ success: true }>(`/api/guests/${selected.id}`, {
        method: "DELETE",
      });
      setMode(null);
      setSelected(null);
      setNotice("Guest invitation group deleted.");
      await load();
    } catch (error) {
      failed(error);
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }
  function filter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }
  function reset() {
    setSearch("");
    setFilters(initialFilters);
    setPage(1);
  }
  function date(value: string | null) {
    return value
      ? new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeZone: workspace?.wedding?.timeZone ?? "Asia/Kolkata",
        }).format(new Date(value))
      : "Not sent";
  }
  const filtered = Object.values(filters).some(Boolean) || Boolean(search);
  const editEvents = [
    ...events.filter(
      (event) =>
        !event.archivedAt || selected?.invitedEventIds.includes(event.id),
    ),
    ...(selected?.invitedEvents
      .filter(
        (event) =>
          event.unavailable && !events.some((item) => item.id === event.id),
      )
      .map((event) => ({
        ...event,
        startsAt: "",
        archivedAt: "unavailable",
      })) ?? []),
  ];
  const fieldError = (key: keyof Form) =>
    fieldErrors[key]?.length ? (
      <span className="guest-field-error" id={`guest-error-${key}`}>
        {fieldErrors[key]?.[0]}
      </span>
    ) : null;
  const recovery = needsSignIn ? (
    <p>
      <Link href="/login" target="_blank" rel="noopener noreferrer">
        Sign in again
      </Link>{" "}
      in a new tab, then return here. Your draft stays in this tab.
    </p>
  ) : null;
  const stats: [string, number, string][] = summary
    ? [
        ["Invitation groups", summary.totalGuests, "groups"],
        ["Pending", summary.pendingInvitations, "schedule"],
        ["Attending groups", summary.attendingInvitations, "check_circle"],
        ["Not Attending", summary.notAttendingInvitations, "cancel"],
        ["Confirmed attendees", summary.totalPeopleAttending, "groups"],
      ]
    : [];

  return (
    <>
      <main className="workspace-page guests-page" inert={mode !== null}>
        {workspace ? (
          <WorkspaceSidebar active="guests" />
        ) : (
          <aside
            className="members-sidebar members-sidebar--skeleton"
            aria-hidden="true"
          >
            <span className="members-skeleton members-skeleton--brand" />
            <span className="members-skeleton" />
            <span className="members-skeleton" />
          </aside>
        )}
        <section className="workspace-main">
          <header className="workspace-topbar">
            <div>
              <span className="section-eyebrow">
                {workspace?.membership?.role ?? "Wedding"} workspace
              </span>
              <p>
                {workspace?.wedding
                  ? `${workspace.wedding.brideName} & ${workspace.wedding.groomName}`
                  : "Your wedding circle"}
              </p>
            </div>
            <Link className="text-button" href="/settings/wedding">
              Wedding details
            </Link>
          </header>
          <div className="guests-shell">
            <header className="guests-heading">
              <div>
                <h1>Guests &amp; RSVP</h1>
                <p>
                  Manage invitation groups, assign ceremonies, and keep your
                  wedding circle in one place.
                </p>
              </div>
              {workspace ? (
                <button
                  className="button"
                  onClick={() => open("add")}
                  type="button"
                >
                  <Icon name="person_add" />
                  Add guest
                </button>
              ) : null}
            </header>
            {notice ? (
              <p className="form-success" role="status">
                {notice}
              </p>
            ) : null}
            {loadError ? (
              <div className="guest-alert" role="alert">
                <h2>We couldn&apos;t refresh your guest list.</h2>
                <p>{loadError}</p>
                {recovery}
                <button
                  className="button button--quiet"
                  disabled={loading}
                  onClick={() => void load()}
                  type="button"
                >
                  Refresh list
                </button>
              </div>
            ) : null}
            {!registry && loading ? (
              <div
                className="guests-skeleton"
                role="status"
                aria-label="Loading guests"
              >
                <div />
                <div />
                <div />
                <div />
                <div />
                <section />
              </div>
            ) : null}
            {summary ? (
              <section className="guests-metrics" aria-label="Guest summary">
                {stats.map(([label, value, icon]) => (
                  <article key={label}>
                    <span>
                      {label}
                      <Icon name={icon} />
                    </span>
                    <strong>{value}</strong>
                    <small>
                      {label === "Confirmed attendees"
                        ? "People attending, not party capacity"
                        : label === "Invitation groups"
                          ? `${summary.totalGuestCapacity} maximum guest capacity`
                          : "Invitation groups"}
                    </small>
                  </article>
                ))}
              </section>
            ) : null}
            {registry ? (
              <>
                <section className="guests-filters" aria-label="Filter guests">
                  <label className="guest-search">
                    <span className="sr-only">Search guests</span>
                    <Icon name="search" />
                    <input
                      maxLength={120}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search name, email, or phone…"
                      value={search}
                    />
                  </label>
                  <label>
                    <span className="sr-only">RSVP status</span>
                    <select
                      onChange={(event) =>
                        filter("rsvpStatus", event.target.value)
                      }
                      value={filters.rsvpStatus}
                    >
                      <option value="">All RSVP statuses</option>
                      {Object.entries(labels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Invited event</span>
                    <select
                      onChange={(event) =>
                        filter("eventId", event.target.value)
                      }
                      value={filters.eventId}
                    >
                      <option value="">All invited events</option>
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name}
                          {event.archivedAt ? " (archived)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Invitation email status</span>
                    <select
                      onChange={(event) =>
                        filter("invitationSent", event.target.value)
                      }
                      value={filters.invitationSent}
                    >
                      <option value="">All email statuses</option>
                      <option value="true">Sent</option>
                      <option value="false">Not sent</option>
                    </select>
                  </label>
                  <button
                    className="button button--quiet"
                    onClick={reset}
                    type="button"
                  >
                    Reset
                  </button>
                </section>
                {loading ? (
                  <p className="guest-refreshing" role="status">
                    Refreshing guests…
                  </p>
                ) : null}
                <section
                  className="guests-panel"
                  aria-label="Guest registry"
                  aria-busy={loading}
                >
                  {registry.data.length ? (
                    <table className="guests-table">
                      <caption className="sr-only">
                        Wedding invitation groups
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Guest / group &amp; contact</th>
                          <th scope="col">Max party</th>
                          <th scope="col">Invited events</th>
                          <th scope="col">RSVP &amp; attendees</th>
                          <th scope="col">Invitation email</th>
                          <th scope="col">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody ref={guestRows}>
                        {registry.data.map((guest) => (
                          <tr key={guest.id}>
                            <td data-label="Guest">
                              <div className="guest-person">
                                <span
                                  className="guest-avatar"
                                  aria-hidden="true"
                                >
                                  {guest.name
                                    .split(/\s+/)
                                    .slice(0, 2)
                                    .map((word) => word[0])
                                    .join("")}
                                </span>
                                <div>
                                  <button
                                    className="guest-name"
                                    onClick={() => open("details", guest)}
                                    type="button"
                                  >
                                    {guest.name}
                                  </button>
                                  <small>
                                    {[guest.email, guest.phone]
                                      .filter(Boolean)
                                      .join(" · ") || "No contact details"}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td data-label="Max party">{guest.maxGuests}</td>
                            <td data-label="Invited events">
                              <div className="guest-tags">
                                {guest.invitedEvents
                                  .slice(0, 2)
                                  .map((event) => (
                                    <span key={event.id}>
                                      {event.name}
                                      {event.archivedAt ? " (archived)" : ""}
                                    </span>
                                  ))}
                                {guest.invitedEvents.length > 2 ? (
                                  <button
                                    onClick={() => open("details", guest)}
                                    type="button"
                                  >
                                    +{guest.invitedEvents.length - 2} more
                                  </button>
                                ) : null}
                                {!guest.invitedEvents.length ? (
                                  <small>Not assigned yet</small>
                                ) : null}
                              </div>
                            </td>
                            <td data-label="RSVP">
                              <RsvpBadge guest={guest} />
                            </td>
                            <td data-label="Invitation email">
                              <span className="guest-email-status">
                                {guest.invitationSentAt
                                  ? `Sent ${date(guest.invitationSentAt)}`
                                  : "Not sent"}
                              </span>
                            </td>
                            <td className="guest-actions-cell">
                              <details className="guest-actions">
                                <summary
                                  aria-label={`Actions for ${guest.name}`}
                                >
                                  <Icon name="more_vert" />
                                </summary>
                                <div>
                                  <button
                                    onClick={() => open("details", guest)}
                                    type="button"
                                  >
                                    <Icon name="visibility" />
                                    View details
                                  </button>
                                  <button
                                    onClick={() => open("edit", guest)}
                                    type="button"
                                  >
                                    <Icon name="edit" />
                                    Edit guest
                                  </button>
                                  <button
                                    className="guest-delete-text"
                                    onClick={() => open("delete", guest)}
                                    type="button"
                                  >
                                    <Icon name="delete" />
                                    Delete invitation
                                  </button>
                                </div>
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="guests-empty">
                      <Icon name={filtered ? "search_off" : "groups"} />
                      <h2>
                        {filtered
                          ? "No guests match these filters."
                          : "Make room for your wedding circle."}
                      </h2>
                      <p>
                        {filtered
                          ? "Try a different name, ceremony, or RSVP status."
                          : "Add your first invitation group. One record can cover a guest, couple, or family."}
                      </p>
                      <button
                        className="button"
                        onClick={filtered ? reset : () => open("add")}
                        type="button"
                      >
                        {filtered ? "Clear filters" : "Add your first guest"}
                      </button>
                    </div>
                  )}
                  <footer className="guests-pagination">
                    <span>
                      {registry.pagination.total
                        ? `Showing ${(registry.pagination.page - 1) * registry.pagination.limit + 1}–${(registry.pagination.page - 1) * registry.pagination.limit + registry.data.length} of ${registry.pagination.total} invitation groups`
                        : "0 invitation groups"}
                    </span>
                    <div>
                      <button
                        className="button button--quiet"
                        disabled={loading || page <= 1}
                        onClick={() => setPage((value) => value - 1)}
                        type="button"
                      >
                        Previous
                      </button>
                      <span>
                        Page {registry.pagination.page} of{" "}
                        {Math.max(1, registry.pagination.totalPages)}
                      </span>
                      <button
                        className="button button--quiet"
                        disabled={
                          loading || page >= registry.pagination.totalPages
                        }
                        onClick={() => setPage((value) => value + 1)}
                        type="button"
                      >
                        Next
                      </button>
                    </div>
                  </footer>
                </section>
                <p className="guests-boundary">
                  <Icon name="info" />
                  Open a guest&apos;s details to share their private link or
                  send an invitation email. Guests RSVP without creating an
                  account.
                </p>
              </>
            ) : null}
          </div>
        </section>
      </main>
      {mode ? (
        <GuestDialog
          title={
            mode === "add"
              ? "Add guest"
              : mode === "edit"
                ? "Edit guest"
                : mode === "delete"
                  ? "Delete this guest invitation?"
                  : "Guest details"
          }
          onClose={close}
          confirmation={mode === "delete"}
        >
          {mode === "add" || mode === "edit" ? (
            <>
              <form
                className="guest-dialog__body guest-form"
                id="guest-form"
                noValidate
                onSubmit={save}
              >
                <p className="guest-form-note">
                  <Icon name="info" />
                  One guest record represents one invitation group or household.
                  The party size includes the named guest.
                </p>
                <label className="field" htmlFor="guest-name">
                  <span>
                    Guest / group name <strong aria-hidden="true">*</strong>
                  </span>
                  <input
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={
                      fieldErrors.name ? "guest-error-name" : undefined
                    }
                    disabled={busy}
                    id="guest-name"
                    maxLength={120}
                    onChange={(event) => change("name", event.target.value)}
                    placeholder="e.g. Rajesh Sharma & family"
                    value={form.name}
                  />
                  {fieldError("name")}
                </label>
                <label className="field" htmlFor="guest-email">
                  <span>
                    Email <em>optional</em>
                  </span>
                  <input
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={`guest-email-help${fieldErrors.email ? " guest-error-email" : ""}`}
                    disabled={busy}
                    id="guest-email"
                    maxLength={254}
                    onChange={(event) => change("email", event.target.value)}
                    type="email"
                    value={form.email}
                  />
                  <small id="guest-email-help">
                    Shared family email addresses are allowed.
                  </small>
                  {fieldError("email")}
                </label>
                <label className="field" htmlFor="guest-phone">
                  <span>
                    Phone <em>optional</em>
                  </span>
                  <input
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={
                      fieldErrors.phone ? "guest-error-phone" : undefined
                    }
                    disabled={busy}
                    id="guest-phone"
                    maxLength={40}
                    onChange={(event) => change("phone", event.target.value)}
                    type="tel"
                    value={form.phone}
                  />
                  {fieldError("phone")}
                </label>
                <label className="field" htmlFor="guest-capacity">
                  <span>
                    Maximum party size <strong aria-hidden="true">*</strong>
                  </span>
                  <input
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.maxGuests)}
                    aria-describedby={`guest-capacity-help${fieldErrors.maxGuests ? " guest-error-maxGuests" : ""}`}
                    disabled={busy}
                    id="guest-capacity"
                    max={10000}
                    min={Math.max(1, selected?.attendingCount ?? 1)}
                    onChange={(event) =>
                      change("maxGuests", event.target.value)
                    }
                    step={1}
                    type="number"
                    value={form.maxGuests}
                  />
                  <small id="guest-capacity-help">
                    1–10,000 people, including the named guest.
                    {selected?.attendingCount
                      ? ` Already confirmed: ${selected.attendingCount}.`
                      : ""}
                  </small>
                  {fieldError("maxGuests")}
                </label>
                <fieldset className="guest-event-picker" disabled={busy}>
                  <legend>
                    Invited events <em>optional</em>
                  </legend>
                  {editEvents.length ? (
                    editEvents.map((event) => (
                      <label key={event.id}>
                        <input
                          checked={form.invitedEventIds.includes(event.id)}
                          onChange={(changeEvent) =>
                            change(
                              "invitedEventIds",
                              changeEvent.target.checked
                                ? [...form.invitedEventIds, event.id]
                                : form.invitedEventIds.filter(
                                    (id) => id !== event.id,
                                  ),
                            )
                          }
                          type="checkbox"
                        />
                        <span>
                          {event.name}
                          {event.archivedAt ? (
                            <small>
                              Archived or unavailable — existing association
                              only
                            </small>
                          ) : null}
                        </span>
                      </label>
                    ))
                  ) : (
                    <p>
                      No events yet? You can add this guest now and assign
                      ceremonies later.
                    </p>
                  )}
                  {fieldError("invitedEventIds")}
                </fieldset>
                <label className="field" htmlFor="guest-notes">
                  <span>
                    Internal notes <em>optional</em>
                  </span>
                  <textarea
                    aria-invalid={Boolean(fieldErrors.notes)}
                    aria-describedby={
                      fieldErrors.notes ? "guest-error-notes" : undefined
                    }
                    disabled={busy}
                    id="guest-notes"
                    maxLength={2000}
                    onChange={(event) => change("notes", event.target.value)}
                    rows={3}
                    value={form.notes}
                  />
                  <small>
                    Private — never shown to guests. {form.notes.length}/2,000
                    characters.
                  </small>
                  {fieldError("notes")}
                </label>
                {actionError ? (
                  <div className="form-error" role="alert">
                    <p>{actionError}</p>
                    {recovery}
                    {uncertainWrite ? (
                      <p>
                        The change may have reached the server.{" "}
                        <button
                          className="text-button"
                          onClick={() => void load()}
                          type="button"
                        >
                          Refresh list
                        </button>{" "}
                        before submitting again to avoid a duplicate.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </form>
              {discard ? (
                <div className="guest-discard" role="alert">
                  <p>Discard your unsaved changes?</p>
                  <button
                    className="button button--quiet"
                    onClick={() => setDiscard(false)}
                    type="button"
                  >
                    Keep editing
                  </button>
                  <button
                    className="button guest-danger"
                    onClick={() => {
                      setDirty(false);
                      setMode(null);
                      setDiscard(false);
                    }}
                    type="button"
                  >
                    Discard changes
                  </button>
                </div>
              ) : null}
              <footer className="guest-dialog__footer">
                <small>{dirty ? "Unsaved changes" : ""}</small>
                <button
                  className="button button--quiet"
                  disabled={busy}
                  onClick={close}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button"
                  disabled={busy}
                  form="guest-form"
                  type="submit"
                >
                  {busy
                    ? "Saving…"
                    : mode === "edit"
                      ? "Save changes"
                      : "Add guest"}
                </button>
              </footer>
            </>
          ) : null}
          {mode === "details" && selected ? (
            <>
              <div className="guest-dialog__body guest-details">
                {actionError ? (
                  <div className="form-error" role="alert">
                    <p>{actionError}</p>
                    {recovery}
                  </div>
                ) : null}
                <div>
                  <h3>{selected.name}</h3>
                  <RsvpBadge guest={selected} />
                </div>
                <dl>
                  <div>
                    <dt>Email</dt>
                    <dd>{selected.email ?? "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{selected.phone ?? "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Maximum party size</dt>
                    <dd>
                      {selected.maxGuests} people, including the named guest
                    </dd>
                  </div>
                  <div>
                    <dt>Confirmed attendance</dt>
                    <dd>{selected.attendingCount ?? "Awaiting RSVP"}</dd>
                  </div>
                  <div>
                    <dt>Last invitation email</dt>
                    <dd>{date(selected.invitationSentAt)}</dd>
                  </div>
                  <div>
                    <dt>Last reminder</dt>
                    <dd>{date(selected.lastReminderSentAt)}</dd>
                  </div>
                </dl>
                <section>
                  <h3>Invited ceremonies</h3>
                  {selected.invitedEvents.length ? (
                    <ul>
                      {selected.invitedEvents.map((event) => (
                        <li key={event.id}>
                          {event.name}
                          {event.archivedAt ? " (archived)" : ""}
                          {event.startsAt ? (
                            <small>{date(event.startsAt)}</small>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No ceremonies assigned yet.</p>
                  )}
                </section>
                <section>
                  <h3>
                    <Icon name="lock" />
                    Internal notes
                  </h3>
                  <small>Private — never shown to guests</small>
                  <p className="guest-notes">
                    {selected.notes || "No internal notes."}
                  </p>
                </section>
                <GuestInvitationActions
                  key={selected.id}
                  guest={selected}
                  checkOwner={checkOwner}
                  onBusyChange={(value) => {
                    mutationInFlight.current = value;
                    setBusy(value);
                  }}
                  onSent={async () => {
                    setNotice("The guest email was accepted for sending.");
                    await load();
                    const response = await requestGuestApi<{ data: Guest }>(
                      `/api/guests/${selected.id}`,
                    );
                    setSelected((current) =>
                      current?.id === selected.id ? response.data : current,
                    );
                  }}
                />
              </div>
              <footer className="guest-dialog__footer">
                <button
                  className="button button--quiet guest-delete-text"
                  disabled={busy}
                  onClick={() => open("delete", selected)}
                  type="button"
                >
                  Delete invitation
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => open("edit", selected)}
                  type="button"
                >
                  Edit guest
                </button>
              </footer>
            </>
          ) : null}
          {mode === "delete" && selected ? (
            <>
              <div className="guest-dialog__body">
                <p>
                  This permanently removes <strong>{selected.name}</strong> and
                  their RSVP record. Any associated invitation link will no
                  longer work.
                </p>
                <p>This cannot be undone.</p>
                {actionError ? (
                  <div className="form-error" role="alert">
                    <p>{actionError}</p>
                    {recovery}
                  </div>
                ) : null}
              </div>
              <footer className="guest-dialog__footer">
                <button
                  className="button button--quiet"
                  disabled={busy}
                  onClick={close}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button guest-danger"
                  disabled={busy}
                  onClick={() => void remove()}
                  type="button"
                >
                  {busy ? "Deleting…" : "Delete invitation"}
                </button>
              </footer>
            </>
          ) : null}
        </GuestDialog>
      ) : null}
    </>
  );
}
