export type MemberUiFixtureState =
  | "empty-members"
  | "active-invitation"
  | "expired-invitation"
  | "email-mismatch"
  | "signed-out"
  | "acceptance-success";

export type MemberUiFixture = {
  id: string;
  state: MemberUiFixtureState;
  path: string;
  description: string;
  data: Record<string, string>;
};

/**
 * Stable state references for browser/QA coverage. These are intentionally
 * transport-free so future end-to-end tests can map them to seeded records.
 */
export const memberUiFixtures: readonly MemberUiFixture[] = [
  {
    id: "members-empty",
    state: "empty-members",
    path: "/settings/members",
    description: "Admin has a wedding workspace but no invited collaborators.",
    data: { members: "1", invitations: "0", role: "ADMIN" },
  },
  {
    id: "invitation-active",
    state: "active-invitation",
    path: "/member-invitations/active-fixture-token",
    description: "A valid Manager invitation is ready for acceptance.",
    data: { role: "MANAGER", status: "PENDING", expiresInDays: "7" },
  },
  {
    id: "invitation-expired",
    state: "expired-invitation",
    path: "/member-invitations/expired-fixture-token",
    description: "The invitation has passed its expiry date and cannot be accepted.",
    data: { role: "MANAGER", status: "EXPIRED" },
  },
  {
    id: "invitation-email-mismatch",
    state: "email-mismatch",
    path: "/member-invitations/mismatch-fixture-token",
    description: "The signed-in account does not match the invited email address.",
    data: { invitedEmail: "invited@example.com", signedInEmail: "other@example.com" },
  },
  {
    id: "invitation-signed-out",
    state: "signed-out",
    path: "/member-invitations/signed-out-fixture-token",
    description: "A visitor is viewing a valid invitation without an account session.",
    data: { role: "MANAGER", auth: "SIGNED_OUT" },
  },
  {
    id: "invitation-accepted",
    state: "acceptance-success",
    path: "/dashboard",
    description: "The invitation was accepted and the member is entering the workspace.",
    data: { membership: "CREATED", role: "MANAGER" },
  },
] as const;
