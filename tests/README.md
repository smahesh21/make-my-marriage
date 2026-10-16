# Tests

Add tests alongside the feature they verify instead of creating speculative test trees.

- Unit tests may live beside module code.
- Integration tests belong in this directory when database or provider boundaries are exercised.
- End-to-end tests should be added here for critical user journeys.

## Photo gallery

`photos.test.ts` uses real sessions, memberships and a disposable local MongoDB
server with mocked storage; it never connects to the configured application DB.
`photos-storage.test.ts` checks signing/conditional-copy boundaries, and the
photo API-client/UI suites cover retry and focus behavior.

The opt-in `r2-gallery-smoke.test.ts` loads `.env.local` explicitly and refuses
any bucket other than `make-my-marriage-develop`. Set `RUN_R2_SMOKE=1`, then run
`node node_modules/vitest/vitest.mjs run tests/r2-gallery-smoke.test.ts`.
It creates two tiny synthetic objects under a unique `test-fixtures/gallery-*`
prefix and deletes only those exact objects afterward. It does not use MongoDB
or touch user photos. Never run provider tests against production.

### Gallery browser regression

Install development dependencies and the isolated browser once:

```sh
npm install
npx playwright install chromium
```

Then run these sequentially (do not rebuild while either server uses `.next`):

```sh
npm run build
npm run test:browser
```

The runner starts a separate production-mode app at `127.0.0.1:3002`, refuses
to reuse an existing server, and closes its server afterward. Each test uses a
fresh browser context. `tests/browser/gallery-harness.ts` intercepts all APIs
and synthetic storage requests, blocks other origins and fails unexpected API
calls. It never signs in to a real account, sends email, accesses R2 or modifies
application data. Traces and results are Git-ignored; do not commit recordings.
Fault injection is confined to the test runner, not a shipped API/UI switch.

Coverage includes both role labels, upload/finalization, byte-progress client
events, confirmation-only retry, missing-staging re-upload, PUT/API/network
failures, session recovery, cancellation/discard, download, deletion
Cancel/Confirm/failure-retry, desktop column separation and 390px layout.
Role claims in this mock harness are **not** authorization evidence: the
parameterized `photos.test.ts` cases separately use real sessions and both
memberships against disposable MongoDB with storage mocked.

`tests/fixtures/photos.ts` generates a tiny PNG, a separate duplicate-content
selection, empty/over-10-MiB files, corrupt bytes, MIME/extension mismatch and SVG
on demand. No large or third-party image binaries are committed. Image signature
validation is not full decoding or malware scanning. Separate reservations may
publish repeated content; confirming one reservation remains idempotent.
