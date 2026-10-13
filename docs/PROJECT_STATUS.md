# Make My Marriage - Project Status

This document is the durable progress log for major project milestones. It summarizes what has been completed and points to the relevant source-of-truth documents and implementation areas.

The status log is not a replacement for the PRD, system design, database design, or API design documents. Those documents remain authoritative for product and architecture decisions.

## Current status

**Overall status:** Active development

**Last updated:** 2026-10-13

## Completed milestones

### 1. Project foundation and application scaffold

**Status:** Complete

The initial Make My Marriage project foundation is in place as a TypeScript Next.js modular monolith. The repository includes the documented application boundaries, product and architecture documents, baseline shared/server/module guidance, a health route, and the standard development verification commands.

**Key areas:**

- `src/app/` for pages, layouts, and route handlers
- `src/modules/` for domain-owned business logic
- `src/server/` for server-only infrastructure and provider adapters
- `src/shared/` for framework-independent types, schemas, constants, and utilities
- `docs/PRODUCT_REQUIREMENT_DOCUMENT.md`
- `docs/SYSTEM_DESIGN.md`
- `docs/DATABASE_DESIGN.md`
- `docs/API_DESIGN.md`
- `src/app/api/health/route.ts`

**Verification:** The repository's typecheck, lint, and production build checks are available and were used during the foundation work.

### 2. Stitch-designed landing page / homepage

**Status:** Complete

The public homepage was implemented to match the connected Stitch design. It includes the fixed navigation, editorial hero, dashboard preview, challenge section, connected-platform feature stories, collaboration section, process section, FAQ, final call to action, and footer.

The page uses static presentation content for items that are outside the current PRD scope. Those items are intentionally non-functional until their corresponding product features are implemented.

**Key areas:**

- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `DESIGN.md`

**Verification:** The homepage was visually checked against the Stitch reference, and the typecheck, lint, and production build checks passed. The local development server was also refreshed after resolving a stale CSS asset issue.

### 3. Design alignment across source-of-truth documents

**Status:** Complete

The PRD, system design, database design, and API design now explicitly align with `DESIGN.md`. The documentation distinguishes user-controlled manual invitation sharing from automated WhatsApp/SMS delivery, treats the landing page as a presentation surface, and prevents static Stitch examples from expanding the documented V1 scope or backend contracts.

**Updated documents:**

- `docs/PRODUCT_REQUIREMENT_DOCUMENT.md`
- `docs/SYSTEM_DESIGN.md`
- `docs/DATABASE_DESIGN.md`
- `docs/API_DESIGN.md`

### 4. Wedding onboarding

**Status:** Complete for the implementation baseline

The first authenticated product flow is now implemented: signup, login, logout, server-side sessions, wedding workspace creation, initial Admin membership, protected dashboard entry, and the homepage CTA links into the flow.

**Key areas:**

- `src/app/api/auth/`
- `src/app/api/wedding/route.ts`
- `src/app/api/dashboard/route.ts`
- `src/app/signup/`
- `src/app/login/`
- `src/app/onboarding/`
- `src/app/dashboard/`
- `src/modules/auth/`
- `src/modules/wedding/`
- `src/server/auth/`
- `src/server/models/`

**Current boundary:** The dashboard summary is intentionally empty until Events, Tasks, Guests, Vendors, and Expenses are implemented. MongoDB persistence requires `MONGODB_URI`, and secure sessions require `SESSION_SECRET`; both are documented in `.env.example`.

**Verification:** Typecheck, lint, production build, focused onboarding tests, and local route smoke tests passed. Full persistence happy-path testing remains dependent on a configured MongoDB environment.

### 5. Stitch-aligned sign-in flow

**Status:** Complete for the current implementation baseline

The sign-in page now follows the connected Stitch Sign In screen: fixed authentication navigation, centered editorial card, email and password controls, password visibility toggle, forgot-password entry point, remember-device row, loading and error states, security reassurance, workspace label, and footer navigation. The existing server-side login endpoint and post-login routing remain unchanged.

**Key areas:**

- `src/app/login/page.tsx`
- `src/app/login/LoginPanel.tsx`
- `src/app/auth/AuthBrand.tsx`
- `src/app/globals.css`

**Current boundary:** Password recovery now includes the request and reset flows. The
state selector is retained as a visual interaction preview matching Stitch; actual
authentication still uses the documented login API.

**Verification:** Typecheck, lint, focused tests, and the production build passed after the sign-in update.

### 6. Authentication and wedding-flow hardening

**Status:** Complete for the current implementation baseline

The authentication and wedding-creation boundaries now include fixed-window
MongoDB rate limiting, same-origin mutation checks, remember-device session
semantics, duplicate-safe wedding membership creation, stable raw gallery tokens,
and the documented wedding response projections. The login recovery link now lands
on an explicit deferred-state page rather than a missing route.

**Key areas:**

- `src/server/security/rate-limit.ts`
- `src/server/http/request-security.ts`
- `src/server/auth/session.ts`
- `src/modules/wedding/use-cases.ts`
- `src/server/auth/context.ts`
- `src/app/forgot-password/page.tsx`

**Verification:** Typecheck, lint, production build, focused security/schema tests,
and local HTTP smoke tests passed. MongoDB-backed session, transaction-concurrency,
and tenant-isolation tests remain dependent on a configured integration database.

### 7. Wedding Details editing

**Status:** Complete for the current implementation baseline

Authenticated Admins and Managers can now update the wedding profile after onboarding.
The flow preserves the existing website slug, validates partial wedding updates, keeps
wedding location separate from future event venues, and exposes a settings surface that
reuses the existing Stitch-aligned onboarding visual language.

**Key areas:**

- `src/app/settings/wedding/page.tsx`
- `src/app/api/wedding/route.ts`
- `src/modules/wedding/use-cases.ts`
- `src/shared/wedding/schemas.ts`

**Verification:** Focused schema tests, typecheck, lint, production build, and local
route smoke tests passed. MongoDB-backed authorization and persistence coverage remains
dependent on a configured integration database.

### 8. Password recovery

**Status:** Complete for the current implementation baseline

Password recovery is now complete across the request and reset journeys. Users can
request a generic password-reset response, receive a short-lived Resend email, choose
a new password through the single-use token link, and return to sign in. Resetting a
password closes all previous sessions for that account. The UI now follows the current
Stitch-aligned authentication shell and handles missing tokens, delivery errors,
successful requests, expired links, and successful resets.

**Key areas:**

- `src/app/forgot-password/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/modules/auth/use-cases.ts`
- `src/server/models/password-reset-token.ts`
- `src/server/email/resend.ts`

**Current boundary:** Live delivery depends on the configured Resend API key, sender,
application URL, and MongoDB environment. The checked-in `.env.example` contains only
placeholders; local provider values remain in `.env.local`.

**Verification:** Focused auth schema/security tests, typecheck, lint, production build,
and local route smoke tests passed. MongoDB-backed delivery, token consumption, and
session invalidation require the configured integration database for full end-to-end
verification.

### 9. Wedding Members and invitations

**Status:** Complete for the current implementation baseline

The Wedding Members collaboration surface is now implemented from the approved
Stitch desktop designs with responsive behavior for smaller screens. Admins and
Managers can view tenant-scoped members. Admins can invite a person as either an
Admin or Manager, view active pending invitations, revoke invitations, change member
roles, and remove members while preserving the last-Admin rule. Invitation tokens are
stored as HMAC hashes, expire after seven days, and are only persisted when email
delivery is configured and succeeds. Invited people can review the public invitation,
create or sign into an account with the invited email, and accept it atomically.

**Key areas:**

- `src/app/settings/members/page.tsx`
- `src/app/member-invitations/[token]/page.tsx`
- `src/app/api/members/`
- `src/app/api/public/member-invitations/[token]/route.ts`
- `src/app/api/member-invitations/[token]/accept/route.ts`
- `src/modules/members/use-cases.ts`
- `src/server/models/wedding-member-invitation.ts`
- `src/shared/members/schemas.ts`

**Current boundary:** Live invitation email delivery remains dependent on a valid
Resend API key and sender configuration. When those values are missing or rejected,
the API returns a configuration or delivery error and does not leave an undeliverable
pending invitation behind. Events and Tasks remain outside this milestone.

**Verification:** Focused member schema tests, typecheck, lint, and the production
build are required for handoff. MongoDB-backed transaction, email delivery, tenant
isolation, and last-Admin concurrency tests remain dependent on configured integration
environments.

### 10. Stitch-aligned invitation acceptance

**Status:** Complete for the current implementation baseline

The member invitation acceptance page now follows the approved Stitch desktop
reference and keeps the acceptance flow complete across loading, unavailable,
signed-out, signed-in, email-mismatch, account-switch, and successful-acceptance
states. The page reuses the editorial authentication shell, presents the wedding
workspace context and invitation details, and preserves the existing secure
server-side email check before membership acceptance.

**Key areas:**

- `src/app/member-invitations/[token]/page.tsx`
- `src/app/globals.css`
- `src/app/api/member-invitations/[token]/accept/route.ts`
- `src/modules/members/use-cases.ts`

**Verification:** Stitch reference review, browser smoke check, typecheck, lint,
focused tests, production build, and `git diff --check` passed. The local
development server was cleanly restarted on port 3001 after the production build
to keep generated Next.js chunks consistent.

### 11. Stitch-aligned authenticated entry and collaboration states

**Status:** Complete for the current implementation baseline

The sign-up and wedding setup screens now follow the current Stitch visual language
with a centered account card, password-strength and consent guidance, a split wedding
setup form with live workspace preview, and planning-foundation cues limited to the
documented Events, Tasks, and Guests scope. Wedding Members now has a resilient
loading skeleton, timeout/retry state, accessible invite-drawer focus management,
and stacked mobile member cards instead of forcing a wide table. Stable QA fixtures
cover empty members, active and expired invitations, signed-out access, email
mismatch, and successful acceptance.

**Key areas:**

- `src/app/signup/page.tsx`
- `src/app/auth/AuthForm.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/settings/members/page.tsx`
- `src/app/globals.css`
- `tests/fixtures/member-ui-states.ts`

**Current boundary:** Guest-count, budget, and other Stitch-only presentation concepts
remain static and are not part of the onboarding API or PRD. Manager remains the
default invitation role as the least-privilege product decision. Live MongoDB and
email-provider integration behavior remains covered by the existing integration
boundary rather than these static UI fixtures.

**Verification:** Stitch design review, typecheck, lint, focused tests (17 passed),
production build, local page smoke checks for `/signup`, `/onboarding`, and
`/settings/members`, and `git diff --check` passed. The development server is
running cleanly on port 3001.

### 12. Wedding Events and Schedule

**Status:** Complete for the current implementation baseline

The Events & Schedule workspace is now implemented against the approved Stitch
desktop design and made responsive for smaller screens. Wedding Members can list
active events in timeline order, create preset or custom events, edit event
details, and archive events without breaking future relationships. Event times are
stored as UTC instants and rendered in the wedding timezone. The dashboard now
shows the active event count and the nearest upcoming events when available.

**Key areas:**

- `src/app/events/page.tsx`
- `src/app/api/events/`
- `src/modules/events/use-cases.ts`
- `src/server/models/wedding-event.ts`
- `src/shared/events/schemas.ts`
- `src/shared/events/time.ts`
- `src/app/workspace/WorkspaceSidebar.tsx`
- `src/app/api/dashboard/route.ts`

**Current boundary:** Event cover-image uploads remain deferred as documented in
the API design. Archived events are hidden from the active schedule but retained
for future task, guest, vendor, expense, and photo relationships. MongoDB-backed
event persistence and authorization require the configured integration database
for full end-to-end verification.

**Verification:** Stitch screen review, focused event schema tests, typecheck,
lint, production build, local smoke checks for `/events` and protected event API
routes, and `git diff --check` passed.

## Status vocabulary

- **Planned:** Identified, but implementation has not started.
- **In progress:** Implementation or verification is underway.
- **Complete:** The feature is implemented, verified, and ready for the current project scope.
- **Deferred:** Implementation exists or has been scoped, but completion is intentionally postponed.
- **Blocked:** Progress requires a documented external dependency or decision.

## Update protocol

When a major feature is completed:

1. Add a dated milestone under `Completed milestones` with a concise scope summary.
2. List the primary files or modules changed.
3. Record the relevant verification performed.
4. Note any intentionally static, deferred, or PRD-limited behavior.
5. Update `Last updated` and move an existing milestone if its status changes.

Minor styling changes, refactors, dependency refreshes, and routine bug fixes do not need individual entries unless they materially change the product milestone status.
