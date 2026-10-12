"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { WorkspaceSidebar } from "@/app/workspace/WorkspaceSidebar";
import { inviteMemberSchema } from "@/shared/members/schemas";

type Role = "ADMIN" | "MANAGER";

type Member = {
  membershipId: string;
  user: { id: string; name: string; email: string };
  role: Role;
  joinedAt: string;
};

type Invitation = {
  id: string;
  email: string;
  role: Role;
  status: "PENDING";
  expiresAt: string;
  createdAt: string;
};

type ApiError = { code?: string; message?: string; fields?: Record<string, string[] | undefined> };

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function MembersLoadingState() {
  return (
    <main className="members-page members-page--loading" aria-busy="true">
      <aside className="members-sidebar members-sidebar--skeleton" aria-hidden="true"><span className="members-skeleton members-skeleton--brand" /><span className="members-skeleton members-skeleton--wedding" /><span className="members-skeleton" /><span className="members-skeleton" /><span className="members-skeleton" /></aside>
      <section className="members-content members-loading" aria-live="polite" role="status">
        <div className="members-loading__header"><span className="members-skeleton members-skeleton--eyebrow" /><span className="members-skeleton members-skeleton--title" /><span className="members-skeleton members-skeleton--copy" /></div>
        <div className="members-loading__metrics"><span /><span /><span /></div>
        <div className="members-loading__panel"><span className="members-skeleton members-skeleton--panel-title" /><span className="members-skeleton members-skeleton--row" /><span className="members-skeleton members-skeleton--row" /><span className="members-skeleton members-skeleton--row" /></div>
        <span className="members-loading__message">Opening your collaboration space…</span>
      </section>
    </main>
  );
}

function MembersLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="members-page members-page--loading">
      <section className="members-load-error" role="alert" aria-live="assertive">
        <span className="member-invite-icon member-invite-icon--error"><span className="material-symbols-outlined" aria-hidden="true">cloud_off</span></span>
        <span className="section-eyebrow">Workspace members</span>
        <h1>We couldn&apos;t open your member space.</h1>
        <p>{message}</p>
        <button className="button" onClick={onRetry} type="button">Try again</button>
      </section>
    </main>
  );
}

export default function WeddingMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [weddingName, setWeddingName] = useState("Your wedding workspace");
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MANAGER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const inviteButtonRef = useRef<HTMLButtonElement>(null);

  const isAdmin = currentRole === "ADMIN";
  const adminCount = useMemo(() => members.filter((member) => member.role === "ADMIN").length, [members]);

  const loadData = useCallback(async () => {
    setError(null);
    const [memberResponse, authResponse] = await Promise.all([fetch("/api/members"), fetch("/api/auth/me")]);
    const memberPayload = (await memberResponse.json()) as { data?: Member[]; error?: ApiError };
    const authPayload = (await authResponse.json()) as {
      data?: { user?: { id: string }; membership?: { role: Role } | null; wedding?: { brideName: string; groomName: string } | null };
      error?: ApiError;
    };

    if (memberResponse.status === 401 || authResponse.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (memberResponse.status === 404 || authPayload.data?.membership === null) {
      window.location.href = "/onboarding";
      return;
    }
    if (!memberResponse.ok) throw new Error(memberPayload.error?.message ?? "Unable to load wedding members.");

    setMembers(memberPayload.data ?? []);
    setCurrentUserId(authPayload.data?.user?.id ?? null);
    setCurrentRole(authPayload.data?.membership?.role ?? null);
    const wedding = authPayload.data?.wedding;
    if (wedding) setWeddingName(`${wedding.brideName} & ${wedding.groomName}`);

    if (authPayload.data?.membership?.role === "ADMIN") {
      const invitationResponse = await fetch("/api/members/invitations");
      const invitationPayload = (await invitationResponse.json()) as { data?: Invitation[]; error?: ApiError };
      if (invitationResponse.ok) setInvitations(invitationPayload.data ?? []);
    } else {
      setInvitations([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (active) {
        setError("This is taking longer than expected. Check your connection and try again.");
        setIsLoading(false);
      }
    }, 10000);

    setIsLoading(true);
    loadData()
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load wedding members.");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadAttempt, loadData]);

  useEffect(() => {
    if (!isDrawerOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]";

    function handleDrawerKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;

      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleDrawerKeyDown);
    requestAnimationFrame(() => drawerCloseRef.current?.focus());

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleDrawerKeyDown);
      previouslyFocused?.focus();
    };
  }, [isDrawerOpen]);

  function retryLoad() {
    setError(null);
    setIsLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = inviteMemberSchema.safeParse({ email, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please enter a valid invitation.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/members/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as { error?: ApiError };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to send this invitation.");

      setEmail("");
      setRole("MANAGER");
      setIsDrawerOpen(false);
      setNotice("Invitation sent. It will remain valid for 7 days.");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send this invitation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateRole(membershipId: string, nextRole: Role) {
    setActingId(membershipId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const payload = (await response.json()) as { error?: ApiError };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to update this member.");
      setNotice("Member role updated.");
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update this member.");
    } finally {
      setActingId(null);
    }
  }

  async function removeMember(membershipId: string, name: string) {
    if (!window.confirm(`Remove ${name} from this wedding workspace?`)) return;
    setActingId(membershipId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/members/${membershipId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: ApiError };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to remove this member.");
      setNotice(`${name} no longer has access to this workspace.`);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to remove this member.");
    } finally {
      setActingId(null);
    }
  }

  async function revokeInvitation(invitationId: string) {
    setActingId(invitationId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/members/invitations/${invitationId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: ApiError };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to revoke this invitation.");
      setNotice("Invitation revoked.");
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to revoke this invitation.");
    } finally {
      setActingId(null);
    }
  }

  if (isLoading) return <MembersLoadingState />;
  if (error && members.length === 0 && currentRole === null) return <MembersLoadError message={error} onRetry={retryLoad} />;

  return (
    <main className="members-page">
      <WorkspaceSidebar weddingName={weddingName} active="members" />

      <section className="members-content" aria-labelledby="members-heading">
        <header className="members-content__header">
          <div><span className="section-eyebrow">People &amp; permissions</span><h1 id="members-heading">Wedding Members</h1><p>Bring your closest people into the planning, with just the access they need.</p></div>
          {isAdmin ? <button ref={inviteButtonRef} className="button members-primary-action" onClick={() => { setError(null); setNotice(null); setIsDrawerOpen(true); }} type="button"><span className="material-symbols-outlined" aria-hidden="true">person_add</span>Invite member</button> : null}
        </header>

        {error ? <p className="form-error members-alert" role="alert">{error}</p> : null}
        {notice ? <p className="form-success members-alert" role="status">{notice}</p> : null}

        <div className="members-metrics" aria-label="Member summary">
          <article><span className="material-symbols-outlined" aria-hidden="true">groups</span><div><small>Active collaborators</small><strong>{members.length}</strong></div></article>
          <article><span className="material-symbols-outlined" aria-hidden="true">admin_panel_settings</span><div><small>Admins</small><strong>{adminCount}</strong></div></article>
          <article><span className="material-symbols-outlined" aria-hidden="true">mark_email_unread</span><div><small>Pending invitations</small><strong>{invitations.length}</strong></div></article>
        </div>

        <section className="members-panel" aria-labelledby="active-members-heading">
          <div className="members-panel__heading"><div><span className="members-panel__eyebrow">The people around you</span><h2 id="active-members-heading">Active collaborators</h2></div><span className="members-panel__count">{members.length} member{members.length === 1 ? "" : "s"}</span></div>
          {members.length <= 1 ? (
            <div className="members-empty"><div className="members-empty__mark"><span className="material-symbols-outlined" aria-hidden="true">diversity_1</span></div><div><h3>Your planning circle starts with you.</h3><p>Invite a partner, parent, sibling, or trusted planner so everyone can carry a piece of the celebration.</p>{isAdmin ? <button className="button members-empty__button" onClick={() => setIsDrawerOpen(true)} type="button">Invite your first member</button> : null}</div></div>
          ) : (
            <>
            <div className="members-table-wrap members-table-wrap--desktop"><table className="members-table"><thead><tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Joined</th>{isAdmin ? <th scope="col"><span className="sr-only">Actions</span></th> : null}</tr></thead><tbody>{members.map((member) => { const isCurrentUser = member.user.id === currentUserId; return <tr key={member.membershipId}><td><div className="member-identity"><span className="member-avatar" aria-hidden="true">{initials(member.user.name)}</span><span><strong>{member.user.name}{isCurrentUser ? <em>You</em> : null}</strong><small>{member.user.email}</small></span></div></td><td><span className={`member-role member-role--${member.role.toLowerCase()}`}>{member.role === "ADMIN" ? "Admin" : "Manager"}</span></td><td>{formatDate(member.joinedAt)}</td>{isAdmin ? <td><div className="member-actions"><select aria-label={`Change role for ${member.user.name}`} value={member.role} disabled={actingId === member.membershipId} onChange={(event) => updateRole(member.membershipId, event.target.value as Role)}><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option></select><button className="icon-button icon-button--danger" aria-label={`Remove ${member.user.name}`} disabled={actingId === member.membershipId} onClick={() => removeMember(member.membershipId, member.user.name)} type="button"><span className="material-symbols-outlined" aria-hidden="true">person_remove</span></button></div></td> : null}</tr>; })}</tbody></table></div>
            <div className="members-mobile-list" aria-label="Active collaborators">{members.map((member) => { const isCurrentUser = member.user.id === currentUserId; return <article className="member-card" key={member.membershipId}><div className="member-card__header"><div className="member-identity"><span className="member-avatar" aria-hidden="true">{initials(member.user.name)}</span><span><strong>{member.user.name}{isCurrentUser ? <em>You</em> : null}</strong><small>{member.user.email}</small></span></div><span className={`member-role member-role--${member.role.toLowerCase()}`}>{member.role === "ADMIN" ? "Admin" : "Manager"}</span></div><div className="member-card__meta"><span>Joined {formatDate(member.joinedAt)}</span>{isAdmin ? <div className="member-actions"><label><span className="sr-only">Change role for {member.user.name}</span><select aria-label={`Change role for ${member.user.name}`} value={member.role} disabled={actingId === member.membershipId} onChange={(event) => updateRole(member.membershipId, event.target.value as Role)}><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option></select></label><button className="icon-button icon-button--danger" aria-label={`Remove ${member.user.name}`} disabled={actingId === member.membershipId} onClick={() => removeMember(member.membershipId, member.user.name)} type="button"><span className="material-symbols-outlined" aria-hidden="true">person_remove</span></button></div> : null}</div></article>; })}</div>
            </>
          )}
        </section>

        {isAdmin ? <section className="members-panel" aria-labelledby="pending-invitations-heading"><div className="members-panel__heading"><div><span className="members-panel__eyebrow">Still finding their way in</span><h2 id="pending-invitations-heading">Pending invitations</h2></div>{invitations.length > 0 ? <span className="members-panel__count">Valid for 7 days</span> : null}</div>{invitations.length === 0 ? <p className="members-panel__empty-copy">Invitations you send will appear here until they join the workspace.</p> : <div className="invitation-list">{invitations.map((invitation) => <article className="invitation-row" key={invitation.id}><span className="invitation-row__icon material-symbols-outlined" aria-hidden="true">mail_outline</span><div><strong>{invitation.email}</strong><span>{invitation.role === "ADMIN" ? "Admin" : "Manager"} · sent {formatDate(invitation.createdAt)}</span></div><span className="member-role member-role--pending">Pending</span><button className="text-button invitation-row__revoke" disabled={actingId === invitation.id} onClick={() => revokeInvitation(invitation.id)} type="button">Revoke</button></article>)}</div>}</section> : null}

        <section className="members-notes" aria-label="Member access guidance"><article><span className="material-symbols-outlined" aria-hidden="true">handshake</span><div><h2>Plan together, peacefully.</h2><p>Members can help with the everyday details of your wedding without losing sight of the bigger picture.</p></div></article><article><span className="material-symbols-outlined" aria-hidden="true">shield</span><div><h2>Access with intention.</h2><p>Admins manage the people in this workspace. Managers can help plan, but cannot change member access.</p></div></article></section>
      </section>

      {isDrawerOpen && isAdmin ? <div className="members-drawer-layer" role="presentation"><button className="members-drawer-backdrop" aria-label="Close invite member panel" onClick={() => setIsDrawerOpen(false)} type="button" /><aside ref={drawerRef} className="members-drawer" aria-describedby="invite-member-description" aria-labelledby="invite-member-heading" role="dialog" aria-modal="true"><div className="members-drawer__header"><div><span className="section-eyebrow">Collaboration access</span><h2 id="invite-member-heading">Invite someone to your wedding workspace</h2><p id="invite-member-description">Bring in the people who will help carry the celebration, with access that fits their role.</p></div><button ref={drawerCloseRef} className="icon-button" aria-label="Close invite member panel" onClick={() => setIsDrawerOpen(false)} type="button"><span className="material-symbols-outlined" aria-hidden="true">close</span></button></div><form className="members-invite-form" onSubmit={inviteMember}><label className="field"><span>Email address</span><input autoComplete="email" inputMode="email" placeholder="name@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><fieldset className="role-picker"><legend>Choose their access</legend><label className={`role-option ${role === "ADMIN" ? "is-selected" : ""}`}><input checked={role === "ADMIN"} name="member-role" onChange={() => setRole("ADMIN")} type="radio" value="ADMIN" /><span className="role-option__icon material-symbols-outlined" aria-hidden="true">admin_panel_settings</span><span><strong>Admin</strong><small>Can invite members and manage workspace access.</small></span><span className="role-option__check material-symbols-outlined" aria-hidden="true">{role === "ADMIN" ? "radio_button_checked" : "radio_button_unchecked"}</span></label><label className={`role-option ${role === "MANAGER" ? "is-selected" : ""}`}><input checked={role === "MANAGER"} name="member-role" onChange={() => setRole("MANAGER")} type="radio" value="MANAGER" /><span className="role-option__icon material-symbols-outlined" aria-hidden="true">edit_note</span><span><strong>Manager</strong><small>Can help with planning, but cannot manage members.</small></span><span className="role-option__check material-symbols-outlined" aria-hidden="true">{role === "MANAGER" ? "radio_button_checked" : "radio_button_unchecked"}</span></label></fieldset><div className="members-drawer__note"><span className="material-symbols-outlined" aria-hidden="true">info</span><p>Manager is selected by default to keep new access limited. The invitation link remains valid for 7 days.</p></div><div className="members-drawer__footer"><button className="button button--quiet" onClick={() => setIsDrawerOpen(false)} type="button">Cancel</button><button className="button" disabled={isSubmitting} type="submit">{isSubmitting ? "Sending invitation…" : "Send invitation"}</button></div></form></aside></div> : null}
    </main>
  );
}
