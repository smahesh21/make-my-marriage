# Make My Marriage - Project Status

This document is the durable progress log for major project milestones. It summarizes what has been completed and points to the relevant source-of-truth documents and implementation areas.

The status log is not a replacement for the PRD, system design, database design, or API design documents. Those documents remain authoritative for product and architecture decisions.

## Current status

**Overall status:** Active development

**Last updated:** 2026-10-16

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

### 13. Wedding Tasks and Checklist

**Status:** Complete for the current implementation baseline

The Tasks & Checklist workspace is now implemented against the approved Stitch
desktop design and made responsive for smaller screens. Wedding Members can
create, edit, complete, reopen, filter, search, and delete tenant-scoped tasks.
Tasks support descriptions, wedding members, active events, wedding-local due
dates, priorities, and TODO/IN_PROGRESS/COMPLETED status. The dashboard now
includes task totals, due-soon counts, current-member assignments, and upcoming
tasks. The UI includes All Tasks, My Tasks, and Completed Tasks views plus a
print-friendly checklist view.

**Key areas:**

- `src/app/tasks/page.tsx`
- `src/app/api/tasks/`
- `src/modules/tasks/use-cases.ts`
- `src/server/models/wedding-task.ts`
- `src/shared/tasks/schemas.ts`
- `src/app/tasks/api.ts`
- `tests/tasks-isolation.test.ts`
- `tests/tasks-ui.test.tsx`
- `tests/tasks-api-client.test.ts`
- `src/app/api/dashboard/route.ts`
- `src/app/dashboard/page.tsx`
- `src/app/workspace/WorkspaceSidebar.tsx`

**Current boundary:** Comments, attachments, subtasks, dependencies, and CSV
export remain outside the documented V1 scope. Existing archived-event and
removed-member associations remain visible for safe editing, while new task
associations require active wedding resources. Deployment/browser-level
multi-account testing remains separate from the isolated integration suite.

**Critical/High QA follow-up (2026-10-15):** Cross-wedding access is now covered
against a disposable MongoDB instance using real session creation, authentication,
membership resolution, route handlers, and task queries. Admins and Managers are
tested in both wedding contexts for listing, reading, editing, completion,
deletion, forged ownership, and foreign member/event references. Only Next's
incoming cookie store is simulated; no configured application database is used.

Task request failures now have status-aware handling, bounded request timeouts,
safe handling of non-JSON responses, explicit read retries, preserved form drafts,
and a sign-in recovery link for expired-session writes. Failed account or
dashboard requests no longer silently produce fallback workspace state/counters.
A successful write followed by a failed refresh is reported separately and its
retry only reloads data. Writes are not automatically replayed. Malformed JSON
on task create/update returns `400 VALIDATION_ERROR`.
The My tasks + Unassigned filter combination now returns an empty list instead
of an ObjectId cast error and 500 response.

Detailed coverage, reproducible commands, and remaining manual QA boundaries are recorded in
`docs/QA_TASKS_CRITICAL_HIGH_RETEST.md`.

**Verification (2026-10-15):** The full suite passed with 75 tests, including
48 targeted follow-up tests. The 20 optional HTTP smoke tests were skipped
without `SMOKE_BASE_URL`. Typecheck, lint, production build, and `git diff --check`
passed. A read-only browser check confirmed Admin Tasks loading and the corrected
My tasks + Unassigned filter without modifying existing task data.

### 14. Refined Stitch design system pass

**Status:** Complete for the current implementation baseline

The implemented product screens now share the latest Stitch visual treatment:
warm ivory surfaces, muted sage action states, quiet card borders, consistent
44px form controls and focus rings, editorial heading rhythm, sans-serif metric
numerals, persistent workspace navigation, and one-column compositions below
the mobile breakpoint. The Tasks page also now correctly unwraps its paginated
API response instead of attempting to render the response envelope as an array.

**Key areas:**

- `src/app/globals.css`
- `src/app/tasks/page.tsx`
- `DESIGN.md`
- `docs/PROJECT_STATUS.md`

**Original boundary:** At this milestone, the Stitch Guests & RSVP and Expenses
Ledger screens were design references for later product milestones. Guest
Management is now covered by milestone 16; Expenses remains unimplemented.

**Verification:** Refined Stitch design-system review, browser smoke checks for
landing, sign-in, sign-up, dashboard, Events, Tasks, Wedding Members, Wedding
details, and invitation states, focused tests (27 passed), typecheck, lint,
production build, and clean generated Next.js output regeneration passed.

### 15. Compact shared navigation and workspace chrome

**Status:** Complete for the current implementation baseline

Public, authentication, and workspace navigation now share a consistent 56px
header with 12px by 16px padding and compact 32px text/action buttons. Content
offsets match the fixed header height, and section eyebrow labels have no bottom
margin. Workspace navigation retains its 8px rhythm.
The redundant Current Workspace sidebar card and its loading placeholders were
removed so the primary navigation has more room for the wedding workflow.
Icon-only controls retain their larger interaction area where needed.

**UI follow-up (2026-10-15):** Removed the login simulation controls and preview
state logic. The sidebar logo uses 12px top padding, and the sidebar remains
sticky through the bottom of the page by keeping outer spacing inside the main
content. These changes apply to the shared layouts across the implemented screens.

**Key areas:**

- `src/app/globals.css`
- `src/app/workspace/WorkspaceSidebar.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/events/page.tsx`
- `src/app/tasks/page.tsx`
- `src/app/settings/members/page.tsx`
- `src/app/settings/wedding/page.tsx`

**Verification (2026-10-15):** Browser measurements confirmed 56px headers,
12px by 16px header padding, 32px action buttons, zero label bottom margin,
and correct content offsets on public/authentication and workspace screens.
Scrolling checks covered Dashboard, Events, Tasks, Wedding Members, and Wedding
details. Typecheck, lint, the full automated suite (75 passed; 20 optional HTTP
smoke tests skipped), production build, and `git diff --check` passed.

### 16. Guest Management registry — 2026-10-15

**Status:** Complete for Guest Management; sharing/public RSVP/individual email added in milestone 17

Admins and Managers can manage wedding-scoped invitation groups at `/guests`:
create, view details, edit, permanently delete after confirmation, assign active
ceremonies, search contact/name across paginated results, and combine event, RSVP,
and invitation-email filters. Each guest record represents a household/invitation,
not every family member. Optional email, phone, notes, and event selection follow
the PRD. Existing archived/unavailable event associations remain editable.

The revised Stitch registry and drawer layouts use the established workspace
shell, 56px headers, 32px actions, and 44px form fields. Rows wrap into labelled
groups at narrower widths rather than clipping columns. The drawer has one
scrolling body, persistent actions, keyboard focus containment, unsaved-change
confirmation, field errors, session recovery, and preserved failed drafts.
Successful writes and failed subsequent refreshes are reported separately, and
writes are never automatically replayed. An account/wedding change clears the
old draft before it can be submitted under another identity.

Guest tokens are generated once using 32 random bytes and stored using the
documented stable-sharing exception, with a unique index and default selection
disabled. CRUD uses explicit response projections and never exposes the token,
normalized email internals, or ownership fields. Capacity/version updates guard
concurrent edits. The dashboard now reports real invitation-group totals, party
capacity and saved attendance independently. Source documents' earlier inaccurate
implementation dates were clarified without changing the target contracts.

**Key areas:**

- `src/app/guests/`
- `src/app/api/guests/`
- `src/modules/guests/use-cases.ts`
- `src/server/models/guest.ts`
- `src/shared/guests/`
- `src/app/api/dashboard/route.ts`
- `src/app/dashboard/page.tsx`
- `src/app/workspace/WorkspaceSidebar.tsx`
- `DESIGN.md`
- `tests/guests.test.ts`
- `tests/guests-ui.test.tsx`
- `tests/guests-api-client.test.ts`

**Original boundary:** This increment did not expose sharing URLs, public
invitations, RSVP submissions or email delivery; milestone 17 adds those flows.
RSVP and delivery fields remain read-only to organisers. Deleting a guest
invalidates its stored token; cancellation of queued emails must ship before
guest EmailJobs are added.
No CSV, family-side taxonomy, individual rosters, dietary, accommodation,
automated WhatsApp/SMS, deadlines, or link-open tracking was introduced.

**Verification:** 61 focused tests passed (34 schema/MongoDB/session/route tests,
17 component tests, 10 API-client tests). Final full run: all 160 tests passed,
including the expanded 24 local HTTP smoke tests against `localhost:3001`.
The integration tests use disposable
MongoDB databases and real authentication sessions with two weddings and both
roles; they do not access the configured application database. Typecheck and
lint and production build passed. Local HTTP checks confirmed `/guests` and its
stylesheet return 200 and guest list/detail/summary APIs return 401 without a
session, with private/no-store responses. Use `http://localhost:3001` for the
existing local Origin/Host guard; the `127.0.0.1` alias rejects writes before
authentication. Authenticated visual/browser verification remains unverified:
the browser tool hit an approval timeout and then a browser-control timeout on
its permitted retry. No configured application data was modified for QA.

### 17. Guest invitations, private links, public RSVP and individual email — 2026-10-15

**Status:** Complete for the individual invitation/sharing/RSVP implementation baseline

Guest details now explicitly retrieve the stable private invitation URL, support
Copy/Open with a manual-copy fallback, and offer user-initiated WhatsApp draft
sharing. No copy/open action marks an email as sent. The standalone `/invite/:token`
page needs no account, exposes only the named group and its active invited
ceremonies, and follows the revised Stitch ivory/sage invitation layout. It
displays the couple, wedding date/location, welcome message, ceremony timing,
venue/address and optional dress code/description without private contacts or notes.

Pending RSVPs start without a preselected answer. Guests can confirm a party
count including the named guest, decline with zero attendance, revisit their
saved response, and change it using the same link. Failed drafts survive retries,
capacity/conflict refreshes and rate limiting. Late responses are ignored after
switching invitation tokens. Focus/cross-tab refresh signals contain only a
timestamp, never the token or guest details. Limits use HMAC-keyed MongoDB
counters (20 submissions per invitation/15 minutes, 300/minute globally), with
owner/capacity validation before quota and per-invitation admission before global
admission. Version/capacity guards keep organiser edits and RSVP writes consistent.

Admins and Managers can confirm an individual email invitation/resend or a
pending-RSVP reminder. Successful sends mean provider acceptance, not inbox
delivery. Missing email, provider failure, expired session, recipient changes,
and failed post-send refresh have distinct recovery. The existing Resend adapter
has a bounded timeout, checks acceptance IDs, and supports server-derived short-
window idempotency keys. Private delivery keys prevent repeat metadata increments.
Guest-address changes clear the old recipient's delivery state, not the stable
link or RSVP. Individual sends share limits of 3 per guest/15 minutes and 60 per
wedding/hour. No writes or sends are automatically replayed.

Token-bearing routes use private/no-store, no-referrer and noindex protections;
Next incoming-request logging ignores invitation paths. Invalid/deleted links
and deleted weddings return a generic unavailable response. Existing privacy,
tenant isolation and read-only organiser RSVP boundaries are preserved.

Follow-up fixes close guest row action menus after selection, outside clicks,
keyboard focus changes or Escape, with focus restored after dialog dismissal.
Invitation/reminder buttons send explicit empty JSON objects. Their command APIs
also accept absent or zero-byte bodies (including Next.js empty streams), fixing
the pre-delivery `Send a valid JSON request body` error. Malformed JSON,
unexpected fields, oversized bodies and cross-origin/unauthenticated requests
remain rejected; guest CRUD and RSVP still require JSON. This fixes request
handling, not a claim of verified live email delivery.

**Key areas:** `src/modules/guests/invitations.ts`, `src/shared/guests/invitations.ts`,
`src/app/api/guests/[guestId]/`, `src/app/api/public/invitations/`, `src/app/invite/`,
`src/app/guests/GuestInvitationActions.tsx`, `src/server/email/resend.ts`,
`src/server/security/rate-limit.ts`, `src/server/models/guest.ts`, `next.config.ts`,
`src/app/globals.css`, and the guest/invitation/provider/smoke tests.

**Current boundary:** Bulk email actions/jobs and scheduled workers remain
deferred, as do automated WhatsApp/SMS, delivery/open tracking, RSVP deadlines,
individual family rosters, dietary inputs, transport and room allocation. No
unconfigured venue photo or third-party stock image is loaded on the private
page. No real emails were sent and no configured application records were
modified during automated verification. Live recipient delivery and a final
authenticated visual walkthrough remain separate manual QA checks.

**Verification:** Latest follow-up: 139 focused guest/invitation/API/UI tests
passed. Full regression: 224 passed; live-local HTTP smoke suite: 30 passed
(254 checks in total). The regression suite also covers the shared email provider
adapter. Typecheck, lint, production build and `git diff --check` passed. The
server was restarted on port 3001. Smoke coverage includes the public page,
invalid-token responses, private/no-store/no-referrer/noindex headers and protected
organiser sharing/send/reminder routes. `.env.local`'s non-secret sharing URL was
corrected from `localhost:3000` to `localhost:3001`; Git still ignores that file,
and no credentials or production settings were changed. Live inbox delivery and
authenticated visual/pixel-comparison QA were not performed and remain manual
verification, not claimed passes.

### 19. Organiser Photos & Gallery — 2026-10-16

**Status:** Complete for the first authenticated Admin/Manager increment;
guest access and sharing/QR remain planned separately

The `/photos` workspace follows the reviewed Stitch member gallery
`8c73e51b8ca14010beea23192680c788` and upload drawer
`7596f6387a1b4712a6b580684403398c`. It includes responsive grid/compact views,
event and Wedding Memories filters, cursor pagination, original-aspect viewer,
single-photo downloads and explicit permanent-deletion confirmation. Shared
sidebar navigation now includes Photos & Gallery. The signed-out page has no
workspace navigation; sign-in can return to `/photos` without an open redirect.
Headers remain 56px, actions 32px, and the drawer has a single scrolling body.
The shared workspace sidebar no longer displays the decorative footer tagline;
Sign out remains at the bottom across all workspace screens. Its unused CSS was
removed. Typecheck, lint, production build and the focused desktop/mobile browser
check passed after this cleanup, including explicit checks for the absent tagline
and visible Sign out action.

JPEG, PNG and WebP uploads accept 1 byte through 10 MiB, at most 20 selected files
per sequential UI batch. Per-file progress, retained failure drafts, retries,
rate-limit guidance, cancellation/discard confirmation and session recovery are
implemented. Completed files are not replayed; ambiguous confirmations reuse the
same reservation. Identity changes discard the in-memory draft. Refresh/close
warns about unsaved files; no file data is persisted in browser storage.

Server-issued staging reservations bind the metadata to the authenticated wedding
and member. The 10-minute signed PUT binds Content-Type/Length. Confirmation
checks R2 metadata and a 16-byte image signature, pins inspection/copy to the same
ETag, copies to a separate final key, and atomically publishes READY metadata.
Concurrent confirmations publish one row and clean losing copies; late PUT
replays cannot overwrite the final object. Idempotent confirmations allow a
24-hour recovery window after PUT expiry. Deleted rows become hidden tombstones,
preventing resurrection. Storage deletion errors preserve metadata and return a
retryable error. Queries are wedding-scoped, credentials stay server-only, reads
are signed for 15 minutes, and photo/API responses are private/no-store/no-referrer.
Upload issuance uses member-first 120/15-minute and wedding 600/15-minute quotas.

**Key areas:** `src/app/photos/`, `src/app/api/photos/`, `src/modules/photos/`,
`src/shared/photos/schemas.ts`, `src/server/storage/r2.ts`, shared navigation,
configuration/error handling, `next.config.ts`, `DESIGN.md`, photo tests and the
architecture/API/database lifecycle clarifications.

**Verification:** Typecheck, lint and production build passed. QA-follow-up
regression: 278 passed; 37 opt-in checks skipped in that default run. Separately,
11 isolated Chromium browser checks and 36 fresh-session local HTTP route checks
passed. One live-development R2 round-trip passed during initial implementation;
it was not rerun for this test/client-recovery follow-up. Tests cover real
sessions/memberships and disposable MongoDB persistence, Admin/Manager tenant
isolation, validation, pending/READY/deleted lifecycle, concurrent confirmation,
pagination/filter binding, rate limiting, storage faults, and UI recovery/focus.
The live R2 test verified upload, conditional publication, attachment download,
wrong-type rejection and staging-replay isolation, then removed only its two
disposable objects. No configured application records or user photos were changed.
One concurrent build/test run exceeded existing UI-test timeouts; rerunning the
regression separately passed. The app was restarted on port 3001 and `/photos`
loads with signed-out recovery and no sidebar. The supplied manual Manager QA
report lists 18 passed cases (its summary incorrectly says 15), zero failures and
five blocked cases. Added generated large/corrupt/mismatched/duplicate fixtures,
real-session Admin/Manager upload-to-delete database tests, byte-progress/abort
checks and isolated browser fault/retry/cancel/delete-confirmation coverage.
Browser APIs/storage are synthetic, not a live Admin account/R2 certification.
Fixed missing-staging retries to resend bytes with the same reservation, while
ambiguous confirmations still avoid duplicate PUTs; definitively invalid files
require reselection. Failure injection is runner-only, with no shipped test
switch. See `docs/GALLERY_QA_FOLLOW_UP.md` and `tests/README.md` for evidence and
remaining boundaries. Production
dependency audit reports existing Next/PostCSS advisories (moderate/high); no
AWS SDK advisory was reported. A breaking framework upgrade was not performed.

**Deferred:** Public token gallery/uploads, sharing link, QR/settings screens,
cover uploads, videos/HEIC conversion, editing, tags/highlights, bulk operations,
thumbnail derivatives, full decoding/malware scanning and orphan reconciliation.
Original images load lazily but may still be up to 10 MiB each. Staging cleanup
is best effort; abandoned/replayed/ambiguous-write objects require later cleanup.
Production credentials/hosting were unchanged during that implementation. The
subsequent production configuration and existing-photo limitation are recorded
in milestone 18 below.

## Work in progress

### 18. Cloudflare R2 storage configuration — 2026-10-15

**Status:** Development, Preview and Production R2 configuration saved and
verified on 2026-10-16; production redeployed. Existing development-photo
records require a separate migration/environment-isolation decision.

Both `make-my-marriage-develop` and `make-my-marriage-prod` were verified through
the signed-in Cloudflare dashboard and connected API.
The ignored local `.env.local` now selects the development bucket and includes
the account ID from the owner's dashboard link. The owner-created development
key's S3 credentials are saved privately in that ignored file, with no
`NEXT_PUBLIC_*` exposure. `.env.example`, `docs/R2_SETUP.md`,
`docs/r2-cors.develop.json` and `docs/r2-cors.prod.json` document environment
separation, bucket-scoped Object Read & Write tokens, private storage and
explicit CORS origins. The owner confirmed `https://www.makemymarriage.co.in`
for production. Both policies were applied and read back from Cloudflare:
development initially allowed only localhost/127.0.0.1 on port 3001 (the current
Preview origins were added in the follow-up below), and production only the
confirmed HTTPS www origin. Both buckets have public development URLs disabled
and no public custom domains. No existing CORS policy was overwritten.

**Verification:** Signed ListObjectsV2 returned 200 for development and 403 for
production using the development key. PUT preflights returned 204 for both local
origins and 403 for an unrelated origin. The key's development-only Object Read
& Write scope was checked on the creation-success page. `.env.local` remains
Git-ignored; no secret values were displayed or placed in tracked files. These
checks were read-only and did not upload, change or delete objects.
The local server was started with the updated environment on port 3001, and
`/login` returned 200. A scan of pending project files found neither R2 key;
the ignored `.env.local` is not part of those files.

**Vercel Development sync:** The verified existing `make-my-marriage` project
now has `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and
`R2_BUCKET_NAME` scoped exclusively to Development. Remote metadata confirms
type `encrypted` for all four. Values were passed through private stdin and
never displayed or included in command arguments. No unrelated settings,
local environment contents or deployments were changed.
Development variables remain retrievable by authorised project members; no
non-readable Sensitive/Secret property is claimed for this scope.

**Vercel Preview / Production follow-up — 2026-10-16:** All four R2 entries
are also saved for all Preview branches, using the development bucket and its
restricted credentials. Remote metadata verifies both Preview keys are
`sensitive` (write-only secrets), while the account ID and bucket name are
`encrypted`. A separate `make-my-marriage-prod-app` Object Read & Write token
was created with the owner's explicit approval, restricted only to the production
bucket and active until revoked. Its credentials were not saved in local files
or displayed. At that stage Production transfer remained pending and no
Production deployment was triggered; see the production completion below.

**Development / Preview completion — 2026-10-16:** Reconfirmed the existing
Vercel project and all eight scoped R2 variable entries through the authorised
CLI connection. Added the exact current Preview deployment URL and its verified
alias to the development bucket's CORS policy while retaining local origins and
the existing methods/headers. Both Preview and both local PUT preflights returned
204; an unrelated origin returned 403. Signed development access returned 200,
the same key was denied production access (403), and an unsigned object request
was rejected (400). Public development URLs remain disabled and the bucket has
no public custom domains. All 138 non-ignored tracked/untracked project files
were checked against the development credentials with no matches; `.env.local`
remains ignored. The documented CORS JSON matches the applied policy. Production
was left unchanged per the latest request. No object writes or deployments were
performed. The browser sign-in handoff could not be confirmed because the
accessible tab reached a GitHub origin blocked by the browser access check;
the existing authorised CLI connection sufficed for this configuration check.

**Production configuration completion — 2026-10-16:** With explicit approval,
created `make-my-marriage-prod-vercel`, an account token with Object Read & Write
access only to `make-my-marriage-prod`, active until revoked. The earlier
`make-my-marriage-prod-app` token was left unchanged; its one-time secret was no
longer available. Saved both new S3 keys directly into Vercel Production as
non-readable Secrets (`sensitive`), and saved the account ID and production
bucket name as Config (`encrypted`). All twelve R2 environment entries were
verified through metadata; Development and Preview were unchanged. No production
key was saved in local files, displayed, or committed. Temporary in-memory key
references were cleared after saving.

Redeployed the existing reviewed production commit `6f98562` as deployment
`dpl_71TPfEsm1rYj8enYR6u61RDfh3f8`. It reached READY with production aliases
assigned, including the live www app. The production `/photos` page returned
200; after the owner signed in, the Admin gallery listed three photos without
the original SERVER_NOT_CONFIGURED error. A production-origin PUT preflight
returned 204; localhost was rejected with 403. The bucket still has no public
development URL or custom domain. A scoped recent error-log scan returned zero
entries. No photos were uploaded, copied, deleted, or modified for these checks.

**Remaining data limitation:** All three existing image previews failed to load.
A private signed production read returned `NoSuchKey`, confirming authentication
but not object presence. Read-only bucket checks found zero `weddings/` objects
in production and four in development. The gallery's existing records therefore
cannot be served by the new production bucket. Preview and Production also
share the configured MongoDB variable entries. A deliberate database separation
and/or scoped existing-photo migration needs owner approval; copying everything
or switching the production database was not performed. This setup completion
is not a successful production upload/download certification. Future Preview
origins still need exact allowlisting; public gallery/sharing/QR remain planned.

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
