# Tasks — Critical and High QA follow-up

Date: 2026-10-15

The Admin retest addendum reported blocked coverage, rather than confirmed
functional failures. This change supplies repeatable evidence for BLK-006 and
BLK-001 and fixes the error-recovery gaps found during that review.

## BLK-006 — Cross-wedding tenant isolation

Result: Passed in automated integration tests (18 tests).

`tests/tasks-isolation.test.ts` starts a temporary MongoDB server, seeds two
weddings with distinct Admins, Managers, sessions, members, events, and tasks,
and exercises the application route handlers. Session creation, token hashing,
authentication, membership resolution, and database queries use their real
implementations; only Next's incoming cookie-store adapter is simulated.

Verified:

- Both roles in both weddings list only their own tasks and related data.
- Counts and upcoming-task summaries remain scoped to the current wedding.
- Foreign task reads, edits, completion, and deletion return 404 without mutation.
- Foreign and missing task IDs return the same error response.
- Foreign assignee and ceremony references are rejected on create and update.
- Forged wedding ownership is rejected in mutation bodies; query parameters
  cannot override the authenticated wedding.
- Foreign filters return no matches, and My tasks uses the current membership.
- Combining My tasks with Unassigned returns an empty list. The retest exposed
  and fixed a 500 caused by passing the `none` sentinel into an ObjectId query.
- Own-wedding writes remain possible; foreign records remain unchanged.
- All five task operations require a valid session.
- Internal database errors return sanitized 500 responses; malformed JSON
  returns 400 without writing data.

Safety boundary: tests set their own MongoDB URI, database name, and synthetic
session secret in the test worker. Cleanup checks the temporary database name
and port before removing fixtures. The configured application database and
existing QA accounts are not used or modified.

## BLK-001 — API failures and retry behavior

Result: Passed in automated request and rendered-UI tests (30 tests).

`tests/tasks-api-client.test.ts` covers 400, 401, 403, 404, 409, 429, 500, and 503
responses, HTML proxy failures, malformed successful responses, offline errors,
and timeouts. The request helper never automatically replays a write.

`tests/tasks-ui.test.tsx` renders the real Tasks page with fault-injectable fetch
responses. Verified:

- Failures from tasks, events, members, authentication, and dashboard endpoints
  show an error and support a successful explicit reload.
- Generic 403/404 responses do not incorrectly redirect to onboarding.
- Failed create requests retain the draft and allow manual resubmission after
  400/401/403/404/409/500 responses.
- Expired-session writes offer sign-in in another tab while retaining the draft.
- An offline edit retains its unsaved instructions.
- A successful create followed by a failed refresh retains the success outcome;
  clicking Try again reloads data without creating another task.
- Failed completion/deletion retains the existing task and permits retry.

## Reproduction

Latest verification: 75 tests passed, including 48 targeted follow-up tests.
The 20 optional HTTP smoke tests were skipped without `SMOKE_BASE_URL`.
Typecheck, lint, and production build passed.
After restarting port 3001, a read-only browser smoke check also confirmed
`ADMIN WORKSPACE` loads and My tasks + Unassigned finishes with zero tasks and
no error alert. No existing browser task data was changed during this check.

```bash
npm ci
npm test -- tests/tasks-isolation.test.ts tests/tasks-api-client.test.ts tests/tasks-ui.test.tsx
npm test
npm run typecheck
npm run lint
npm run build
```

The database suite uses `mongodb-memory-server-core` with MongoDB 8.2.6 and an
isolated temporary database. Its first run downloads the platform-specific
MongoDB binary and may take several minutes; subsequent runs reuse the cache.
The first-start hook allows up to ten minutes. No application environment file
or real database credentials are required.

## Remaining coverage boundaries

- These checks are route integration and rendered DOM tests, not a replacement
  for deployed HTTP/browser testing with multiple real browser accounts.
- Network failures are injected in tests; no fault-injection/debug API was added
  to the running application.
- The original report's responsive, native print, destructive browser-dialog,
  and duplicate-title product-policy items are not marked passed by this change.
- Existing optional HTTP smoke tests still require `SMOKE_BASE_URL`.
