# DROGS read-only API

Office users create keys in `/admin` → **API keys**. Keys are issued by DROGS and used by other servers to read DROGS data. They are not Cloudflare credentials and never grant database or storage administration access.

Choose a separate key for each connected app, a descriptive name, permissions, and a lifetime of 1–365 days (the UI offers 7, 30, 90 or 365). The full key is shown only at creation. MySQL stores a keyed hash, public prefix and metadata. Office users can revoke keys. Removing the issuing email from `ADMIN_EMAILS` also disables its keys. Changing `SESSION_SECRET` invalidates all keys and login sessions.

Send requests to the same domain as the registration app:

```sh
curl 'https://drogs.dagministry.org/api/v1/registrations?year=2027&limit=50' \
  -H 'Authorization: Bearer YOUR_DROGS_API_KEY'
```

Keep API keys in the calling server's environment, not frontend JavaScript, URLs or public repositories. These endpoints do not use browser cookies and do not provide cross-origin browser access.

| Permission | Endpoint | Data |
| --- | --- | --- |
| `backend:read` | `GET /api/v1/backend/*` | Complete application data as detailed below; also permits the limited endpoints. This is selected by default for new keys. |
| `registrations:read` | `GET /api/v1/registrations` | Submitted annual registrations, including pending/unclaimed records; names, role, email, phone, country, city, organization, denomination, bishop reference, status and portrait path. No drafts, birth dates, payment details or receipts. |
| `rosters:read` | `GET /api/v1/rosters` | Annual pastor list entries, including active/removed status, names, contact details, church and supervising bishop. No removal notes. |
| `photos:read` | `GET /api/v1/photos?path=ENCODED_PATH` | A signed URL for a portrait attached to a submitted registration. No draft portraits, unattached uploads or receipts. |

Registration/list endpoints accept `year` (defaults to current registration cycle), `limit` (1–100; default 50), and `after` (the preceding response's `nextCursor`). Responses are `{data: [...], year: 2027, nextCursor: "..."}`; `nextCursor` is null when complete. Keep the same year while paging. The portrait path returned by registrations must be URL-encoded when requesting a photo link. Photo responses are `{url: "...", expiresIn: 3600}`. Previously issued image URLs remain valid until their own expiry even if the API key is revoked.

Keys have a limit of 120 authorized requests per minute. Responses use `Cache-Control: no-store`. Errors are JSON with an `error` message: 401 missing/invalid/expired/revoked key; 403 missing scope; 404 unknown endpoint or inaccessible photo; 405 a write/delete method; 429 request limit; 503 provider/database failure. All POST, PUT, PATCH and DELETE operations on this API are rejected. Keys cannot be used to sign into the office, create keys, submit registrations or call internal action endpoints.

Apply `mysql/002_api_keys.sql` to an existing installation (or `npm run db:migrate`, which applies both migrations). The new table stores only API-key hashes and metadata. The underlying MySQL and R2 connections remain separate; photo links still require working Cloudflare credentials.

## Complete backend read access

With `backend:read`, use these endpoints. All remain read-only:

| Endpoint under `/api/v1/backend/` | Contents |
| --- | --- |
| `registrations` | Full stored registrations: drafts and submitted records, all form fields including birth dates, payment amounts/status, receipt paths, review information, and timestamps. |
| `rosters` | Full pastor list entries, including status and removal notes. |
| `profiles` | Full stored profiles. |
| `users` | Account IDs and email addresses. |
| `history` | All application audit entries. |
| `media` | All tracked uploads, including draft/unattached portraits and receipts: object path, owner, type, size and creation time. |
| `media-url?path=ENCODED_PATH` | A temporary signed link to any tracked upload, including receipts. |
| `settings` | Current registration year, years with registrations, and fee amounts. |
| `reference` | Organizations, denominations and reference bishops. |
| `keys` | API-key metadata, scopes, creator, expiry, revocation and last use; never full tokens or hashes. |

Collection endpoints accept `limit` and `after`. Registrations and rosters include **all years by default**, with optional `year` filtering. They return full stored JSON records rather than the limited projections of the original endpoints. Payments and review details are nested in registration records. Follow `nextCursor` until null, URL-encoding cursors and keeping the same filters. `settings`, `reference` and `media-url` are individual responses and do not paginate.

This access excludes authentication internals (passwords, OTPs, sessions and rate-limit hashes), environment variables and database/SMTP/Cloudflare secrets. It provides no SQL console, infrastructure administration, write, upload or deletion permissions. Existing restricted keys retain their scopes; issue a new key with `backend:read` to grant full application-data access.

The preserved older Supabase API documentation is in [LEGACY_API.md](LEGACY_API.md).

## Accounts and successful logins

`GET /api/v1/backend/accounts?search=EMAIL_OR_NAME&page=1` returns account signup/last-login dates, recorded login count, role, office access and current-cycle registration status (50 per page, with total). `GET /api/v1/backend/logins?user=USER_ID&before=CURSOR` returns successful email-verified login events, newest first, 50 per page. Omit `user` for all accounts. Both require `backend:read`. No OTPs or session credentials are exposed.

Office admins can also use **Accounts** in `/admin` to search accounts and view their login histories. Apply migration `003_account_activity.sql` before deploying this version. Existing accounts have unknown signup dates; historical login activity cannot be reconstructed. Tracking starts with this release.
