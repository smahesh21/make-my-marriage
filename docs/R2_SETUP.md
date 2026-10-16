# Cloudflare R2 configuration

## Current setup status — 2026-10-16

Both `make-my-marriage-develop` and `make-my-marriage-prod` were verified in the
signed-in dashboard and Cloudflare API. The local `.env.local` selects
`make-my-marriage-develop`, with the account ID taken from the owner's dashboard
link. The owner created the development-only Object Read & Write key, and its
S3 Access Key ID and Secret Access Key are now saved in the ignored `.env.local`
without displaying them. Both buckets have their public
development URLs disabled and no public custom domains. Their CORS policies were
applied and read back successfully on 2026-10-16. No existing CORS rules were
replaced because neither bucket had a policy. A signed development ListObjectsV2
request returned HTTP 200; the same credentials were denied access to production
(HTTP 403). PUT preflights returned 204 for both approved local origins and 403
for an unrelated origin. These were read-only checks: no objects were uploaded,
changed or deleted during those initial checks. Actual photo upload/download was
not yet verified at that stage; the organiser integration test below now covers it.
The Development/Preview follow-up verified all eight Vercel entries and added
the current Preview deployment URL and its verified alias to the development
bucket's existing CORS allowlist, preserving both local origins. All four approved
PUT preflights returned 204; an unrelated origin returned 403. Signed read-only
checks again returned 200 for development and 403 for production using the
development key. An unsigned object request was rejected (400). The bucket
remains private: its public development URL is disabled and no custom domain is
attached. No object was created, changed or deleted.
The local app was started on port 3001 with the updated environment; `/login`
returned HTTP 200. Pending tracked/untracked project files were checked against
the new R2 credential values, with no matches; `.env.local` remains Git-ignored.

The connected Cloudflare tool can manage bucket settings but cannot manage IAM
token permissions (the token-permission API returned Unauthorized). The browser
was used to verify the owner-created key's Object Read & Write scope, restricted
to `make-my-marriage-develop`. Only the S3 credentials were saved; the raw
Cloudflare bearer token was not stored. No credential values were displayed or
added to tracked files. With the owner's explicit approval, a separate
`make-my-marriage-prod-app` account token was created with Object Read & Write
access restricted to `make-my-marriage-prod`, active until revoked. Its credentials
have not been saved in local project files. Saving them in Vercel Production is
pending. The latest request covers Development and Preview only; Production was
left unchanged. No Production R2 environment variables have been saved yet. If
the one-time production secret is no longer available, a replacement must be
created explicitly before that separate setup can be completed.

The four R2 variables were also saved to the existing Vercel project
`make-my-marriage` in **Development and Preview**, using private stdin rather than
command arguments. Remote metadata confirms all four Development entries have
type `encrypted`; Preview uses `sensitive` (write-only secrets) for both keys and
`encrypted` for the account ID and bucket name. Preview applies to all branches
and uses the development bucket and development-only credentials. No values were
displayed. Existing unrelated variables and Production were not changed. No
deployment was triggered, and the
local environment file was not overwritten by an environment pull. Development
variables are not the non-readable Sensitive type and remain retrievable by
authorised project members. They do not configure existing hosted deployments.

The organiser photo/gallery increment is now implemented at `/photos`: direct
signed uploads, verification and publication, private viewing, event filtering,
downloads and confirmed deletion. Its adapter is `src/server/storage/r2.ts` and
its opt-in live test is `tests/r2-gallery-smoke.test.ts`. The development test
passed on 2026-10-16, including upload, signature validation, ETag-pinned copy,
download, wrong-MIME rejection and replay isolation. Only its two unique synthetic
test-fixtures objects were removed. No user photos or configured MongoDB records
were modified. Public guest uploads, gallery-link/QR sharing, thumbnail generation
and orphan reconciliation remain later increments. The old example bucket
`make-my-marriage-dev` is not the development bucket chosen for this project.

## Separate environments

| Environment | Bucket | Credentials and browser origins |
| --- | --- | --- |
| Local development | `make-my-marriage-develop` | Development-only token; localhost origins below |
| Vercel Preview | `make-my-marriage-develop` | Development-only token saved; current verified Preview URL and alias allowlisted |
| Production | `make-my-marriage-prod` | Separate production-only token created; Vercel save pending separately; confirmed HTTPS app origins only |

Do not use production credentials in local development or preview deployments.
The owner confirmed `https://www.makemymarriage.co.in/` as the production app URL.
Its CORS origin is `https://www.makemymarriage.co.in` (no trailing slash).
The non-www origin is not included unless it is also confirmed as an app origin.

## 1. Create development credentials in Cloudflare

1. Open R2 Object Storage → Overview → Account Details → API Tokens → Manage.
2. Create an R2 account token, if permitted by the account, or a user token.
3. Name it `make-my-marriage-develop` and choose **Object Read & Write**.
4. Apply it to **specific buckets only**, selecting only
   `make-my-marriage-develop`. Do not grant Admin Read & Write to the running app.
5. Record its **Access Key ID** and **Secret Access Key** in the ignored local
   `.env.local` file. The secret is only shown when the token is created.
6. Copy the Cloudflare account ID from the R2 account details.

An R2 S3 Secret Access Key is not the raw Cloudflare bearer API token. Do not
substitute a Global API Key or expose any credential through `NEXT_PUBLIC_*`.

The local file contains these entries ready to fill:

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=make-my-marriage-develop
```

Keep `.env.local` out of Git. Do not put real values into `.env.example`, this
document, screenshots, logs or chat. Restart the app after changing credentials.
Do not replace unrelated MongoDB, session or email settings.

## 2. Keep gallery objects private

In each bucket's Settings, verify that the Public Development URL is disabled
and no public-access custom domain is attached. Do not enable public bucket
access to fix an upload error. CORS is not an authentication mechanism.

The documented application architecture is private R2 objects with short-lived
signed URLs, server-authorised wedding access, and direct browser-to-R2 uploads.
Actual photo bytes should not travel through normal Next.js API handlers.

## 3. Set development browser-upload permissions

Open `make-my-marriage-develop` → Settings → CORS Policy. Paste the complete
JSON array from [r2-cors.develop.json](./r2-cors.develop.json) into the dashboard's
JSON editor and save when reproducing this setup. This policy is already applied
and verified in Cloudflare. Review any existing policy before replacing it.

The policy permits `http://localhost:3001`, `http://127.0.0.1:3001`, and the two
exact Preview origins verified through Vercel's deployment inspection:

- `https://make-my-marriage-ph6sql10y-srisailammahesh77gmailcoms-projects.vercel.app`
- `https://make-my-marriage-git-fdee9f-srisailammahesh77gmailcoms-projects.vercel.app`

It allows GET/PUT/HEAD, the Content-Type request header, and the ETag response header.
Other Preview deployment URLs are not automatically trusted: inspect their
project/environment and add exact origins when needed. Do not allow all Vercel
projects with a wildcard. These CORS rules only enable signed requests from
approved browser origins; they do not grant public access to photos.
Content-Length is set by the browser; client JavaScript must not set it manually.
Server-side photo deletion does not require browser DELETE permission.

This file is in Cloudflare dashboard format, not Wrangler's `rules` format.
Saving it locally does not apply it to Cloudflare. If the eventual upload client
adds checksum/metadata headers, explicitly review and update the allowed headers.
Use `http://localhost:3001` for the app's existing API Origin/Host validation;
allowing the 127.0.0.1 origin on R2 does not change that separate API guard.

## 4. Prepare production separately

Create another Object Read & Write token restricted only to
`make-my-marriage-prod`, when ready to deploy. Save its three credential values
and `R2_BUCKET_NAME=make-my-marriage-prod` only in the hosting provider's
Production environment-variable settings, not the local file or Preview scope.

For `make-my-marriage-prod`, the separate dashboard policy is prepared in
[r2-cors.prod.json](./r2-cors.prod.json), allowing only the confirmed
`https://www.makemymarriage.co.in` origin. Review the current cloud policy before
applying it. Do not add localhost, wildcards or unconfirmed deployment URLs to
the production bucket. This policy was applied and read back on 2026-10-16.

The production-only token has been created with the owner's approval, but its
Vercel Production settings are not saved yet. Production is outside the latest
Development/Preview request and was left unchanged. No deployment has been
triggered. Environment changes apply to new deployments, not already running
deployments. Current Preview origins are allowlisted as described above; new
Preview origins require an explicit allowlist update.

## 5. Verification before declaring storage ready

- Confirm the token is scoped to the correct bucket and environment.
- Confirm public bucket access is disabled.
- Verify a signed PUT, GET and HEAD with a small synthetic development object.
- Verify a browser preflight from the configured local app origin.
- Verify unsigned access fails and an unrelated origin is not permitted by CORS.
- Remove only the synthetic object created for that test; never delete user photos.
- Never log signed URLs, provider credentials or raw sensitive provider errors.
- Do not test uploads or deletion against the production bucket.

The default S3 endpoint is `https://<account-id>.r2.cloudflarestorage.com`, with
AWS SDK region `auto`. Jurisdiction-restricted buckets use a different endpoint;
check the endpoint displayed by Cloudflare before implementing the storage client.

## Official references

- [R2 authentication and bucket-scoped credentials](https://developers.cloudflare.com/r2/api/tokens/)
- [R2 browser CORS configuration](https://developers.cloudflare.com/r2/buckets/cors/)
- [AWS SDK v3 configuration for R2](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)
