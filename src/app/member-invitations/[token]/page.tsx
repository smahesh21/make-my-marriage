"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { AuthBrand } from "@/app/auth/AuthBrand";
import { normalizeEmail } from "@/shared/auth/schemas";

type Invitation = {
  email: string;
  role: "ADMIN" | "MANAGER";
  wedding: {
    brideName: string;
    groomName: string;
    weddingDate: string;
    location: { city: string; state?: string };
  };
  requiresLogin: boolean;
};

type ApiError = { code?: string; message?: string };

function formatWeddingDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(`${value}T00:00:00.000Z`));
}

function roleLabel(role: Invitation["role"]) {
  return role === "ADMIN" ? "Admin" : "Manager";
}

function roleSummary(role: Invitation["role"]) {
  return role === "ADMIN"
    ? "invite family members and manage workspace access"
    : "collaborate on ceremony timelines, review guest arrival logistics, and coordinate vendor milestones";
}

function formatLocation(location: Invitation["wedding"]["location"]) {
  return [location.city, location.state].filter(Boolean).join(", ");
}

export default function MemberInvitationPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    setActionError(null);

    Promise.all([
      fetch(`/api/public/member-invitations/${encodeURIComponent(token)}`),
      fetch("/api/auth/me"),
    ])
      .then(async ([invitationResponse, authResponse]) => {
        const invitationPayload = (await invitationResponse.json()) as { data?: Invitation; error?: ApiError };
        const authPayload = (await authResponse.json()) as { data?: { user?: { email?: string } } };
        if (!active) return;
        if (!invitationResponse.ok) {
          setLoadError(invitationPayload.error?.message ?? "This invitation is no longer available.");
          return;
        }
        setInvitation(invitationPayload.data ?? null);
        setSignedInEmail(authResponse.ok ? authPayload.data?.user?.email ?? null : null);
      })
      .catch(() => {
        if (active) setLoadError("We couldn’t open this invitation. Please try again.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt, token]);

  const authQuery = useMemo(
    () => `?inviteToken=${encodeURIComponent(token ?? "")}&mode=accept`,
    [token],
  );

  async function acceptInvitation() {
    setIsAccepting(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/member-invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
      const payload = (await response.json()) as { data?: { role?: string }; error?: ApiError };
      if (response.status === 401) {
        window.location.href = `/login${authQuery}`;
        return;
      }
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to accept this invitation.");
      window.location.href = "/dashboard";
    } catch (acceptError) {
      setActionError(acceptError instanceof Error ? acceptError.message : "Unable to accept this invitation.");
      setIsAccepting(false);
    }
  }

  async function switchAccount() {
    setIsSwitchingAccount(true);
    setActionError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("We couldn’t switch accounts right now. Please try again.");
      window.location.href = `/login${authQuery}`;
    } catch (switchError) {
      setActionError(switchError instanceof Error ? switchError.message : "We couldn’t switch accounts right now. Please try again.");
      setIsSwitchingAccount(false);
    }
  }

  function retryInvitation() {
    setInvitation(null);
    setSignedInEmail(null);
    setLoadError(null);
    setActionError(null);
    setIsLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  }

  const isEmailMismatch = Boolean(
    invitation && signedInEmail && normalizeEmail(signedInEmail) !== normalizeEmail(invitation.email),
  );

  return (
    <main className="auth-design-page member-invite-page">
      <header className="auth-design-header">
        <div className="auth-design-header__inner">
          <div className="auth-design-header__leading">
            <AuthBrand />
            <span className="auth-design-divider" aria-hidden="true" />
            <Link className="auth-design-back" href="/"><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>Back to home</Link>
          </div>
          <div className="auth-design-header__trailing">
            <nav className="auth-design-nav" aria-label="Authentication navigation">
              <Link href="/#features">Explore</Link>
              <Link href="/#how-it-works">Concierge</Link>
              <Link className="is-active" href={`/login${authQuery}`} aria-current="page">Sign In</Link>
            </nav>
            <span className="auth-design-profile" aria-hidden="true"><span className="material-symbols-outlined">person</span></span>
          </div>
        </div>
      </header>

      <div className="auth-design-main">
        <div className="auth-design-content">
          <div className="auth-design-ambient auth-design-ambient--top" aria-hidden="true" />
          <div className="auth-design-ambient auth-design-ambient--bottom" aria-hidden="true" />
          <div className="member-invite-stage">
            <div className="member-invite-context">
              <div className="member-invite-context__icon"><span className="material-symbols-outlined" aria-hidden="true">diversity_1</span></div>
              <span className="section-eyebrow">Make My Marriage · Wedding Workspace</span>
            </div>

            <section className="member-invite-card member-invite-card--design" aria-label="Wedding workspace invitation">
              {isLoading ? <div className="member-invite-loading" aria-live="polite" role="status"><span className="section-eyebrow">Opening invitation</span><h1>Preparing your workspace invitation…</h1><span className="member-invite-loading__bar" aria-hidden="true" /></div> : loadError || !invitation ? <div className="member-invite-error" aria-live="polite" role="alert"><div className="member-invite-icon member-invite-icon--error"><span className="material-symbols-outlined" aria-hidden="true">link_off</span></div><span className="section-eyebrow">Invitation unavailable</span><h1>This invitation needs a little attention.</h1><p>{loadError ?? "This invitation could not be found."}</p><div className="member-invite-error-actions"><button className="button" onClick={retryInvitation} type="button">Try again</button><Link className="button button--quiet" href="/">Return home</Link></div></div> : <>
                <header className="member-invite-card__header">
                  <span className="section-eyebrow">Workspace invitation</span>
                  <h1 id="member-invite-heading">You&apos;re invited to help plan this wedding</h1>
                  <p>Join the collaborative digital space to manage ceremonies, coordinate with your partner, family, and invited vendors.</p>
                </header>

                <div className="member-invite-workspace" aria-label="Wedding workspace details">
                  <div className="member-invite-workspace__header">
                    <div>
                      <span className="member-invite-workspace__eyebrow">Wedding space</span>
                      <strong>{invitation.wedding.brideName} &amp; {invitation.wedding.groomName}&apos;s Wedding</strong>
                    </div>
                    <span className="member-invite-status"><span aria-hidden="true">●</span> Active</span>
                  </div>
                  <div className="member-invite-workspace__grid">
                    <div className="member-invite-workspace__item">
                      <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
                      <div><small>Date</small><strong>{formatWeddingDate(invitation.wedding.weddingDate)}</strong></div>
                    </div>
                    <div className="member-invite-workspace__item">
                      <span className="material-symbols-outlined" aria-hidden="true">location_on</span>
                      <div><small>Destination</small><strong>{formatLocation(invitation.wedding.location)}</strong></div>
                    </div>
                    <div className="member-invite-workspace__item">
                      <span className="material-symbols-outlined" aria-hidden="true">mail</span>
                      <div><small>Invited email</small><strong>{invitation.email}</strong></div>
                    </div>
                    <div className="member-invite-workspace__item">
                      <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                      <div><small>Assigned access</small><strong>{roleLabel(invitation.role)} <em>Invited</em></strong></div>
                    </div>
                  </div>
                </div>

                <div className="member-invite-benefits">
                  <p><span className="material-symbols-outlined" aria-hidden="true">check_circle</span><span>As a {roleLabel(invitation.role)}, you will be able to {roleSummary(invitation.role)} alongside the family.</span></p>
                  <p><span className="material-symbols-outlined" aria-hidden="true">lock</span><span>Private internal planning access only. This is not a guest RSVP or public event ticket.</span></p>
                </div>

                {isEmailMismatch ? <div className="member-invite-mismatch" role="alert"><p>This invitation was sent to <strong>{invitation.email}</strong>, but you&apos;re signed in as <strong>{signedInEmail}</strong>.</p><button className="button" disabled={isSwitchingAccount} onClick={switchAccount} type="button">{isSwitchingAccount ? "Switching account…" : "Switch account"}</button>{actionError ? <p className="member-invite-action-error">{actionError}</p> : null}</div> : signedInEmail ? <div className="member-invite-authenticated"><p>Signed in as <strong>{signedInEmail}</strong>. You can accept this invitation.</p>{actionError ? <p className="member-invite-action-error" role="alert">{actionError}</p> : null}<button className="button member-invite-accept" disabled={isAccepting} onClick={acceptInvitation} type="button">{isAccepting ? "Joining workspace…" : "Accept invitation"}</button></div> : <div className="member-invite-auth"><Link className="button member-invite-create-action" href={`/signup${authQuery}`}>Create account to join <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></Link><Link className="button member-invite-sign-in-action" href={`/login${authQuery}`}>Sign in to accept</Link></div>}
              </>}
            </section>
            <p className="member-invite-security-note"><span className="material-symbols-outlined" aria-hidden="true">verified_user</span>Make My Marriage ensures bank-grade encryption and granular permissions for every family workspace.</p>
          </div>
        </div>

        <footer className="auth-design-footer">
          <p>© 2025 Make My Marriage Technologies. Crafted with architectural warmth.</p>
          <nav aria-label="Legal navigation"><Link href="#privacy">Privacy</Link><Link href="#terms">Terms</Link><Link href="#help">Help</Link></nav>
        </footer>
      </div>
    </main>
  );
}
