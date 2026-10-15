"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Guest } from "@/shared/guests/types";
import { GuestApiError, requestGuestApi } from "./api";

export function GuestInvitationActions({
  guest,
  checkOwner,
  onSent,
  onBusyChange,
}: {
  guest: Guest;
  checkOwner: () => Promise<void>;
  onSent: (kind: "invitation" | "reminder") => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<
    "invitation" | "reminder" | null
  >(null);
  const [sending, setSending] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const busy = useRef(false);
  const verify = useRef(checkOwner);
  useEffect(() => {
    verify.current = checkOwner;
  }, [checkOwner]);
  const loadLink = useCallback(async () => {
    setLinkLoading(true);
    setLinkError(null);
    try {
      await verify.current();
      const response = await requestGuestApi<{ data: { url: string } }>(
        `/api/guests/${guest.id}/invitation-link`,
      );
      if (
        !response.data?.url ||
        !["http:", "https:"].includes(new URL(response.data.url).protocol)
      )
        throw new Error("The invitation link is unavailable.");
      setUrl(response.data.url);
    } catch (error) {
      setLinkError(
        error instanceof Error
          ? error.message
          : "We couldn't retrieve the invitation link.",
      );
      if (error instanceof GuestApiError && error.status === 401)
        setSignIn(true);
    } finally {
      setLinkLoading(false);
    }
  }, [guest.id]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Invitation link copied.");
      setLinkError(null);
    } catch {
      setLinkError(
        "Clipboard access is unavailable. Select and copy the private link below.",
      );
    }
  }
  async function send() {
    if (!confirmation || busy.current) return;
    const kind = confirmation;
    busy.current = true;
    onBusyChange?.(true);
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await verify.current();
      await requestGuestApi<{ success: true }>(
        `/api/guests/${guest.id}/${kind === "reminder" ? "send-reminder" : "send-invitation"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      setNotice(
        `${kind === "reminder" ? "Reminder" : "Invitation"} sent — accepted by the email service. This does not confirm inbox delivery.`,
      );
      setConfirmation(null);
      try {
        await onSent(kind);
      } catch {
        setError(
          "The email was accepted, but the guest record could not be refreshed. Refresh the list instead of sending again.",
        );
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "We couldn't send the email.",
      );
      if (error instanceof GuestApiError && error.status === 401)
        setSignIn(true);
    } finally {
      busy.current = false;
      onBusyChange?.(false);
      setSending(false);
    }
  }
  return (
    <section
      className="guest-invitation-actions"
      aria-label="Invitation sharing and email"
    >
      <h3>Private invitation</h3>
      <p>
        This link lets its holder view the invited ceremonies and update this
        group&apos;s RSVP. Share it only with the intended guests.
      </p>
      {!url ? (
        <button
          className="button button--quiet"
          disabled={linkLoading}
          onClick={() => void loadLink()}
          type="button"
        >
          {linkLoading ? "Retrieving link…" : "Get invitation link"}
        </button>
      ) : (
        <>
          <label className="field">
            <span>Private invitation URL</span>
            <input
              className="guest-private-url"
              onFocus={(event) => event.target.select()}
              readOnly
              value={url}
            />
          </label>
          <div className="guest-share-buttons">
            <button
              className="button"
              onClick={() => void copy()}
              type="button"
            >
              Copy link
            </button>
            <a
              className="button button--quiet"
              href={url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open invitation
            </a>
            <a
              className="button button--quiet"
              href={`https://wa.me/?text=${encodeURIComponent(`You're invited to celebrate with us. View your private invitation and RSVP: ${url}`)}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              Share in WhatsApp
            </a>
          </div>
          <small>
            You can select and copy the URL manually. WhatsApp sharing opens a
            draft; it does not send a message automatically.
          </small>
        </>
      )}
      {linkError ? (
        <div className="form-error" role="alert">
          <p>{linkError}</p>
          {!url ? (
            <button
              className="text-button"
              disabled={linkLoading}
              onClick={() => void loadLink()}
              type="button"
            >
              Retry link
            </button>
          ) : null}
        </div>
      ) : null}
      <small>
        Copying or opening a link does not mark an invitation email as sent.
      </small>
      <h3>Email invitation</h3>
      {!guest.email ? (
        <p>
          Add an email address to send an invitation, or copy the invitation
          link to share it yourself.
        </p>
      ) : (
        <>
          <div className="guest-share-buttons">
            <button
              className="button button--quiet"
              disabled={sending}
              onClick={() => {
                setConfirmation("invitation");
                setError(null);
              }}
              type="button"
            >
              {guest.invitationSentAt
                ? "Resend invitation email"
                : "Send invitation email"}
            </button>
            {guest.rsvpStatus === "PENDING" ? (
              <button
                className="button button--quiet"
                disabled={sending}
                onClick={() => {
                  setConfirmation("reminder");
                  setError(null);
                }}
                type="button"
              >
                Send RSVP reminder
              </button>
            ) : (
              <small>Reminders are only available for pending RSVPs.</small>
            )}
          </div>
          {confirmation ? (
            <div className="guest-email-confirmation">
              <h4>
                {confirmation === "reminder"
                  ? "Send this RSVP reminder?"
                  : guest.invitationSentAt
                    ? "Resend this invitation?"
                    : "Send this invitation?"}
              </h4>
              <p>
                Email recipient: <strong>{guest.email}</strong>. The email
                includes the couple&apos;s names, wedding date, and this
                group&apos;s private RSVP link.
              </p>
              <div className="guest-share-buttons">
                <button
                  className="button button--quiet"
                  disabled={sending}
                  onClick={() => setConfirmation(null)}
                  type="button"
                >
                  Cancel email
                </button>
                <button
                  className="button"
                  disabled={sending}
                  onClick={() => void send()}
                  type="button"
                >
                  {sending ? "Sending…" : "Confirm send"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
      {notice ? (
        <p className="form-success" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error} Refresh the guest details before retrying if the outcome is
          uncertain.
        </p>
      ) : null}
      {signIn ? (
        <p>
          <a href="/login" rel="noopener noreferrer" target="_blank">
            Sign in again
          </a>
          , then retry from this tab.
        </p>
      ) : null}
    </section>
  );
}
