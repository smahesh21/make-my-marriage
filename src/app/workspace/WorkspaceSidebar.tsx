"use client";

import Link from "next/link";

import { AuthBrand } from "@/app/auth/AuthBrand";

type WorkspaceSection = "overview" | "members" | "wedding";

type WorkspaceSidebarProps = {
  weddingName?: string;
  active: WorkspaceSection;
};

export function WorkspaceSidebar({ weddingName = "Your wedding workspace", active }: WorkspaceSidebarProps) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <aside className="members-sidebar" aria-label="Wedding workspace navigation">
      <AuthBrand className="auth-logo" markClassName="auth-logo__mark" />
      <div className="members-sidebar__wedding"><span className="members-sidebar__eyebrow">Current workspace</span><strong>{weddingName}</strong><span>Wedding planning</span></div>
      <nav className="members-nav">
        <Link className={active === "overview" ? "is-active" : ""} href="/dashboard" aria-current={active === "overview" ? "page" : undefined}><span className="material-symbols-outlined" aria-hidden="true">space_dashboard</span>Overview</Link>
        <span className="members-nav__section">Collaborate</span>
        <Link className={active === "members" ? "is-active" : ""} href="/settings/members" aria-current={active === "members" ? "page" : undefined}><span className="material-symbols-outlined" aria-hidden="true">group</span>Wedding Members</Link>
        <span className="members-nav__disabled"><span className="material-symbols-outlined" aria-hidden="true">event</span>Events &amp; schedule</span>
        <span className="members-nav__disabled"><span className="material-symbols-outlined" aria-hidden="true">checklist</span>Tasks</span>
        <span className="members-nav__section">Workspace</span>
        <Link className={active === "wedding" ? "is-active" : ""} href="/settings/wedding" aria-current={active === "wedding" ? "page" : undefined}><span className="material-symbols-outlined" aria-hidden="true">tune</span>Wedding details</Link>
      </nav>
      <div className="members-sidebar__footer"><span className="members-sidebar__hint">A calm place for the details that matter.</span><button className="members-sidebar__signout" onClick={logout} type="button"><span className="material-symbols-outlined" aria-hidden="true">logout</span>Sign out</button></div>
    </aside>
  );
}
