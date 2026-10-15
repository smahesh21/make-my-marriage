"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AuthBrand } from "@/app/auth/AuthBrand";
import { GuestApiError, requestGuestApi } from "@/app/guests/api";
import { formatEventDate, formatEventTime } from "@/shared/events/time";
import {
  invitationTokenSchema,
  rsvpSchema,
  type PublicInvitation,
} from "@/shared/guests/invitations";

const failureMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "We couldn't load your invitation. Please try again.";
function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  );
}

export function PublicInvitationPage({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"ATTENDING" | "NOT_ATTENDING" | "">("");
  const [count, setCount] = useState("1");
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const draft = useRef(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const submissionId = useRef(0);
  const endpoint = `/api/public/invitations/${encodeURIComponent(token)}`;

  const load = useCallback(async () => {
    const current = ++generation.current;
    if (!invitationTokenSchema.safeParse(token).success) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const response = await requestGuestApi<{ data: PublicInvitation }>(
        endpoint,
      );
      if (current !== generation.current) return;
      if (
        !response.data?.guest ||
        !response.data.wedding ||
        !Array.isArray(response.data.events)
      )
        throw new Error("We couldn't read this invitation. Please try again.");
      setInvitation(response.data);
      setUnavailable(false);
      if (!draft.current) {
        setStatus(
          response.data.guest.rsvpStatus === "PENDING"
            ? ""
            : response.data.guest.rsvpStatus,
        );
        setCount(String(response.data.guest.attendingCount || 1));
        setEditing(response.data.guest.rsvpStatus === "PENDING");
      }
    } catch (error) {
      if (current !== generation.current) return;
      if (error instanceof GuestApiError && error.status === 404) {
        setUnavailable(true);
        setInvitation(null);
      } else setLoadError(failureMessage(error));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [endpoint, token]);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    // A different token represents a different household: never carry a draft.
    draft.current = false;
    submissionId.current++;
    inFlight.current = false;
    setSubmitting(false);
    setDirty(false);
    setInvitation(null);
    setLoading(true);
    setUnavailable(false);
    setError(null);
    setNotice(null);
    setRetryAt(0);
    void load();
    const refresh = () => {
      if (!inFlight.current) void load();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "mmm-rsvp-updated") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storage);
    return () => {
      invalidate();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storage);
    };
  }, [load, invalidate]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const changed = () => {
    draft.current = true;
    setDirty(true);
    setNotice(null);
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || Date.now() < retryAt || !invitation) return;
    const parsed = rsvpSchema.safeParse({
      status,
      attendingCount: status === "NOT_ATTENDING" ? 0 : Number(count),
    });
    if (!parsed.success) {
      setError(
        status
          ? "Choose a valid whole-number party size."
          : "Please tell us whether your group will attend.",
      );
      return;
    }
    if (parsed.data.attendingCount > invitation.guest.maxGuests) {
      setError(
        `Your invitation allows up to ${invitation.guest.maxGuests} people, including the named guest.`,
      );
      return;
    }
    inFlight.current = true;
    const currentSubmission = ++submissionId.current;
    setSubmitting(true);
    setError(null);
    try {
      const response = await requestGuestApi<{
        data: { status: "ATTENDING" | "NOT_ATTENDING"; attendingCount: number };
      }>(`${endpoint}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (currentSubmission !== submissionId.current) return;
      if (
        !response.data ||
        !["ATTENDING", "NOT_ATTENDING"].includes(response.data.status) ||
        !Number.isInteger(response.data.attendingCount)
      )
        throw new Error(
          "We couldn't confirm the saved response. Refresh the invitation before trying again.",
        );
      setInvitation((current) =>
        current
          ? {
              ...current,
              guest: {
                ...current.guest,
                rsvpStatus: response.data.status,
                attendingCount: response.data.attendingCount,
              },
            }
          : current,
      );
      draft.current = false;
      setDirty(false);
      setEditing(false);
      setNotice("Your RSVP has been saved.");
      try {
        localStorage.setItem("mmm-rsvp-updated", String(Date.now()));
      } catch {
        /* No tokens or RSVP details are stored. */
      }
      await load();
    } catch (error) {
      if (currentSubmission !== submissionId.current) return;
      setError(failureMessage(error));
      if (error instanceof GuestApiError) {
        if (error.status === 404) {
          setUnavailable(true);
          setInvitation(null);
        }
        if (error.status === 409 || error.code === "PARTY_SIZE_CHANGED")
          await load();
        if (error.status === 429) {
          setRetryAt(Date.now() + (error.retryAfterSeconds ?? 60) * 1000);
          setNow(Date.now());
        }
      }
    } finally {
      if (currentSubmission === submissionId.current) {
        inFlight.current = false;
        setSubmitting(false);
      }
    }
  }

  const weddingDate = invitation
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${invitation.wedding.weddingDate}T00:00:00Z`))
    : "";
  const couple = invitation
    ? `${invitation.wedding.brideName} & ${invitation.wedding.groomName}`
    : "Wedding invitation";
  const wait = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return (
    <div className="public-invitation">
      <header className="invitation-topbar">
        <AuthBrand />
        {invitation && !unavailable ? (
          <nav aria-label="Invitation sections">
            <a href="#ceremonies">Ceremonies</a>
            <a href="#rsvp">RSVP</a>
          </nav>
        ) : null}
      </header>
      <main className="invitation-shell">
        {loading ? (
          <section
            className="invitation-loading"
            role="status"
            aria-label="Loading invitation"
          >
            <div />
            <div />
            <p>Opening your invitation…</p>
          </section>
        ) : unavailable ? (
          <section className="invitation-message">
            <Icon name="mail_lock" />
            <h1>This invitation is unavailable.</h1>
            <p>
              Please contact the wedding organiser for the correct invitation
              link.
            </p>
          </section>
        ) : !invitation ? (
          <section className="invitation-message" role="alert">
            <h1>We couldn&apos;t open your invitation.</h1>
            <p>{loadError}</p>
            <button
              className="button"
              onClick={() => void load()}
              type="button"
            >
              Try again
            </button>
          </section>
        ) : (
          <>
            {loadError ? (
              <div className="guest-alert" role="alert">
                <p>
                  {notice
                    ? "Your response was saved, but we couldn't refresh the ceremony details."
                    : loadError}
                </p>
                <button
                  className="button button--quiet"
                  onClick={() => void load()}
                  type="button"
                >
                  Refresh invitation
                </button>
              </div>
            ) : null}
            <section className="invitation-hero">
              <div className="invitation-rings" aria-hidden="true">
                ∞
              </div>
              <span className="section-eyebrow">
                {invitation.wedding.title || "A celebration of togetherness"}
              </span>
              <h1>{couple}</h1>
              <span className="invitation-personal">
                A personal invitation · Up to {invitation.guest.maxGuests}{" "}
                {invitation.guest.maxGuests === 1 ? "person" : "people"}
              </span>
              <h2>Dear {invitation.guest.name},</h2>
              <p>
                {invitation.wedding.welcomeMessage ||
                  "We would love for you to celebrate our wedding with us. Your presence will make these moments even more meaningful."}
              </p>
              <dl>
                <div>
                  <dt>When</dt>
                  <dd>{weddingDate}</dd>
                </div>
                <div>
                  <dt>Where</dt>
                  <dd>
                    {invitation.wedding.location ||
                      "Please contact the organiser for location details."}
                  </dd>
                </div>
                <div>
                  <dt>Your invitation</dt>
                  <dd>
                    {invitation.events.length} invited{" "}
                    {invitation.events.length === 1 ? "ceremony" : "ceremonies"}
                  </dd>
                </div>
              </dl>
            </section>
            <div className="invitation-grid">
              <section className="invitation-ceremonies" id="ceremonies">
                <header>
                  <h2>Invited ceremonies</h2>
                  <p>
                    These are the celebrations included in your group&apos;s
                    invitation.
                  </p>
                </header>
                {invitation.events.length ? (
                  invitation.events.map((event, index) => (
                    <article
                      className="invitation-event"
                      key={`${event.startsAt}-${index}`}
                    >
                      <div className="invitation-event__heading">
                        <div>
                          <small>
                            Ceremony {String(index + 1).padStart(2, "0")}
                          </small>
                          <h3>{event.name}</h3>
                        </div>
                        <span>
                          {formatEventDate(
                            event.startsAt,
                            invitation.wedding.timeZone,
                          )}
                        </span>
                      </div>
                      <dl>
                        <div>
                          <dt>
                            <Icon name="schedule" />
                            Time
                          </dt>
                          <dd>
                            {formatEventTime(
                              event.startsAt,
                              invitation.wedding.timeZone,
                            )}
                            {event.endsAt
                              ? ` – ${formatEventTime(event.endsAt, invitation.wedding.timeZone)}`
                              : ""}
                          </dd>
                        </div>
                        <div>
                          <dt>
                            <Icon name="location_on" />
                            Venue
                          </dt>
                          <dd>
                            {event.venueName || "Details to follow"}
                            {event.address ? (
                              <small>{event.address}</small>
                            ) : null}
                          </dd>
                        </div>
                        {event.dressCode ? (
                          <div>
                            <dt>
                              <Icon name="checkroom" />
                              Dress code
                            </dt>
                            <dd>{event.dressCode}</dd>
                          </div>
                        ) : null}
                      </dl>
                      {event.description ? <p>{event.description}</p> : null}
                    </article>
                  ))
                ) : (
                  <article className="invitation-event">
                    <h3>Ceremony details will follow.</h3>
                    <p>
                      Your organiser hasn&apos;t assigned any active ceremonies
                      yet. You can still send your RSVP below.
                    </p>
                  </article>
                )}
              </section>
              <aside className="invitation-response" id="rsvp">
                <span className="section-eyebrow">Your response</span>
                <h2>Confirm your presence</h2>
                {!editing && invitation.guest.rsvpStatus !== "PENDING" ? (
                  <div className="invitation-confirmation">
                    <Icon name="check_circle" />
                    <h3>
                      {invitation.guest.rsvpStatus === "ATTENDING"
                        ? "We look forward to celebrating with you."
                        : "Thank you for letting us know."}
                    </h3>
                    <p>
                      {invitation.guest.rsvpStatus === "ATTENDING"
                        ? `${invitation.guest.attendingCount} ${invitation.guest.attendingCount === 1 ? "person" : "people"} confirmed, including the named guest.`
                        : "Your group is marked as Not Attending. You'll be missed."}
                    </p>
                    {notice ? <p role="status">{notice}</p> : null}
                    <button
                      className="button button--quiet"
                      onClick={() => {
                        setEditing(true);
                        setError(null);
                      }}
                      type="button"
                    >
                      Change response
                    </button>
                  </div>
                ) : (
                  <form noValidate onSubmit={submit}>
                    <fieldset disabled={submitting}>
                      <legend>Will you be attending?</legend>
                      <label>
                        <input
                          checked={status === "ATTENDING"}
                          name="attendance"
                          onChange={() => {
                            setStatus("ATTENDING");
                            changed();
                          }}
                          type="radio"
                        />
                        Yes, we&apos;ll be there
                      </label>
                      <label>
                        <input
                          checked={status === "NOT_ATTENDING"}
                          name="attendance"
                          onChange={() => {
                            setStatus("NOT_ATTENDING");
                            changed();
                          }}
                          type="radio"
                        />
                        No, we can&apos;t attend
                      </label>
                    </fieldset>
                    {status === "ATTENDING" ? (
                      <label className="field">
                        <span>How many people will attend?</span>
                        {invitation.guest.maxGuests === 1 &&
                        Number(count) === 1 ? (
                          <p>1 person — this invitation is for you.</p>
                        ) : (
                          <input
                            aria-describedby="party-help"
                            disabled={submitting}
                            max={invitation.guest.maxGuests}
                            min={1}
                            onChange={(event) => {
                              setCount(event.target.value);
                              changed();
                            }}
                            step={1}
                            type="number"
                            value={count}
                          />
                        )}
                        <small id="party-help">
                          Includes the named guest. Maximum:{" "}
                          {invitation.guest.maxGuests}.
                        </small>
                      </label>
                    ) : null}
                    {error ? (
                      <p className="form-error" role="alert">
                        {error}
                      </p>
                    ) : null}
                    {wait > 0 ? (
                      <p role="status">
                        Please wait {wait} seconds before submitting again.
                      </p>
                    ) : null}
                    <button
                      className="button"
                      disabled={submitting || wait > 0}
                      type="submit"
                    >
                      {submitting ? "Saving your response…" : "Submit RSVP"}
                    </button>
                    {invitation.guest.rsvpStatus !== "PENDING" ? (
                      <button
                        className="text-button"
                        disabled={submitting}
                        onClick={() => {
                          draft.current = false;
                          setDirty(false);
                          setStatus(
                            invitation.guest.rsvpStatus === "ATTENDING"
                              ? "ATTENDING"
                              : "NOT_ATTENDING",
                          );
                          setCount(
                            String(invitation.guest.attendingCount || 1),
                          );
                          setEditing(false);
                          setError(null);
                        }}
                        type="button"
                      >
                        Cancel changes
                      </button>
                    ) : null}
                  </form>
                )}
                <p className="invitation-private-note">
                  <Icon name="lock" />
                  No account needed. Return to this same private link to change
                  your response. Share it only with your invitation group.
                </p>
              </aside>
            </div>
            <footer className="invitation-footer">
              <p>We look forward to sharing these moments with you.</p>
              <strong>{couple}</strong>
              <small>Powered by Make My Marriage</small>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
