# Photos & Gallery QA follow-up — 2026-10-16

Scope: the first authenticated Admin/Manager organiser increment, before push.
The supplied Chrome report lists GAL-001–018 as passed: **18 passed, 0 failed,
5 blocked**, rather than the 15 passes stated in its summary. Its two uploaded
photos and the configured application database were not modified by this work.

## Actions on blocked coverage

| Report case | Added verification | Boundary |
| --- | --- | --- |
| GAL-019: over 10 MiB | Generated 10 MiB + 1-byte fixture rejected by the browser queue and upload route before reservation/storage calls; exact 10 MiB schema boundary retained | Synthetic fixture; no oversized cloud upload |
| GAL-020: API/network faults | Browser-injected API 503, connection reset, storage PUT failure, confirmation retry, expired session recovery and delete failure/retry; client tests cover 4xx/5xx, timeout/abort and measured byte progress | Runner-only interception, no deployed fault-injection endpoint |
| GAL-021: deletion | Browser Cancel sends no DELETE; Confirm removes a synthetic photo, failure preserves it, retry succeeds and reload retains deletion. Real MongoDB tests verify READY/DELETED and storage-failure preservation | Mocked storage; no user/cloud photos deleted |
| GAL-022: Admin parity | Admin and Manager browser journeys; both real session/membership roles reserve, publish, list, download and delete with disposable MongoDB; foreign-wedding denial remains covered | Browser role fixtures are not proof of backend authorization; DB tests supply that proof with mocked storage |
| GAL-023: public/guest gallery | Still explicitly deferred by the current API implementation clarification and milestone 19 | Not implemented or passed; public links, guest uploads and QR need the next increment |

## Recovery fixes discovered while closing test gaps

- `UPLOAD_NOT_FOUND`: retry resends the selected binary using the same staging
  reservation before confirming. Previously it retried confirmation alone.
- `INVALID_PHOTO`: rejected bytes cannot be retried unchanged; remove the failed
  item and choose a supported file. Ambiguous/transient confirmation failures
  continue reusing the existing upload without another PUT or reservation.

## Fixture and product boundaries

Fixtures cover valid PNG, over-limit, empty, corrupt signature, MIME/extension
mismatch, unsupported SVG, and repeated content. Separate selections can create
separate photos even with identical bytes. This is existing behavior, not a
new content-deduplication guarantee. Confirmation of one reservation is
idempotent. Full image decoding and malware scanning remain deferred.

Verification: 278 regression tests passed (37 opt-in checks skipped), 11 isolated
Chromium tests passed, and 36 local HTTP smoke checks passed. Typecheck, lint and
production build passed. HTTP checks use the configured `localhost` origin:
mutations sent through the `127.0.0.1` alias are rejected by the existing origin
guard. This protection was not relaxed. A sandbox-only Vite temporary-module
cache failure did not recur in the unrestricted regression run.

See `tests/README.md` for repeatable commands. Browser tests use the real DOM,
styles, event handlers and XHR but synthetic API/storage responses; database
tests use real disposable persistence and mocked storage. Neither is a new
live Admin/R2 end-to-end certification. The earlier development-bucket R2 smoke
and the supplied Manager manual walkthrough are separate evidence.

Production R2 wiring remains pending. Existing Next/PostCSS dependency audit
advisories also remain; a major framework upgrade was not included in this QA
follow-up. No deployment or remote push is performed by the tests.

The final credential check found no configured private-value matches across 163
non-ignored project files (five configured private values checked). `.env.local`
and browser test recordings/results remain Git-ignored. `git diff --check` passed.
