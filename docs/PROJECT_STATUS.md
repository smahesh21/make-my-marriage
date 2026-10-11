# Make My Marriage - Project Status

This document is the durable progress log for major project milestones. It summarizes what has been completed and points to the relevant source-of-truth documents and implementation areas.

The status log is not a replacement for the PRD, system design, database design, or API design documents. Those documents remain authoritative for product and architecture decisions.

## Current status

**Overall status:** Active development

**Last updated:** 2026-10-11

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

**Status:** Deferred / incomplete

The password recovery screens, routes, token handling, rate limits, and Resend adapter
are present, but this feature is intentionally paused and is not release-ready. Live
email delivery still requires a valid Resend API key and a verified sender domain.
Provider setup, end-to-end email delivery, and MongoDB-backed reset verification will be
completed as part of a later authentication milestone.

**Key areas:**

- `src/app/forgot-password/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/modules/auth/use-cases.ts`
- `src/server/models/password-reset-token.ts`
- `src/server/email/resend.ts`

**Verification:** Focused auth schema tests, typecheck, lint, production build, and
local route smoke tests passed. Live Resend delivery and MongoDB token/session
invalidation remain unverified because the required provider and integration
environments are not configured.

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
