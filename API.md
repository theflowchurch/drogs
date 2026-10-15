# Kuriake Castle data API

Office users create keys in `/admin` → **API keys**. Keys are issued by DROGS and used by CLI agents and other servers to read or manage the data their permissions allow. They are not Cloudflare credentials and never grant database or storage administration access.

Choose a separate key for each connected app, a descriptive name, permissions, and a lifetime of 1–365 days or **never** (the UI offers 7, 30, 90, 365 or Never expires; a never-expiring key can still be revoked). The full key is shown only at creation. MySQL stores a keyed hash, public prefix and metadata. Office users can revoke keys. Removing the issuing email from `ADMIN_EMAILS` also disables its keys. Changing `SESSION_SECRET` invalidates all keys and login sessions.

This document is also published at https://kuriakecastle.org/docs/.

Send requests to the same domain as the registration app:

```sh
curl 'https://kuriakecastle.org/api/v1/registrations?year=2027&limit=50' \
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

Keys have a limit of 120 authorized requests per minute. Responses use `Cache-Control: no-store`. Errors are JSON with an `error` message: 401 missing/invalid/expired/revoked key; 403 missing scope; 404 unknown endpoint or inaccessible photo; 405 an unsupported method; 429 request limit; 503 provider/database failure. The original read endpoints accept GET only. The management endpoints below accept explicit write permissions. Read-only keys retain their existing restrictions. Keys cannot sign into the office, create other keys or call internal cookie-authenticated endpoints.

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

This access excludes authentication internals (passwords, OTPs, sessions and rate-limit hashes), environment variables and database/SMTP/Cloudflare secrets. The backend read permission provides no write, upload or deletion permissions. No key provides a SQL console or infrastructure administration. Existing restricted keys retain their scopes; issue a new key with `backend:read` to grant full application-data access.

The preserved older Supabase API documentation is in [LEGACY_API.md](LEGACY_API.md).

## Accounts and successful logins

`GET /api/v1/backend/accounts?search=EMAIL_OR_NAME&page=1` returns account signup/last-login dates, recorded login count, role, office access and current-cycle registration status (50 per page, with total). `GET /api/v1/backend/logins?user=USER_ID&before=CURSOR` returns successful email-verified login events, newest first, 50 per page. Omit `user` for all accounts. Both require `backend:read`. No OTPs or session credentials are exposed.

Office admins can also use **Accounts** in `/admin` to search accounts and view their login histories. Apply migration `003_account_activity.sql` before deploying this version. Existing accounts have unknown signup dates; historical login activity cannot be reconstructed. Tracking starts with this release.


## Management API for CLI agents

In **Admin → API keys**, click **Select full data management access**, enter an application name and choose an expiry, then create the key. The preset selects `backend:read` and `backend:write`. Copy the `drogs_live_…` token when it is shown. Existing keys are never upgraded automatically. Each key can be revoked independently.

| Permission | Access |
| --- | --- |
| `backend:write` | All management routes and documented office actions. Pair with `backend:read` for complete backend reads. |
| `people:write` | Find people, add and edit directory records, correct names and details, assign pastors, and remove or restore records. |
| `photos:write` | Find people, upload/replace portraits, and read Photo tasks and totals. It cannot change names or assignments. |
| `rosters:write` | Find people and preview/apply pastor spreadsheet imports. |

These routes write to the **same MySQL state as admin**. Changes appear in the original Castle directory and the First Love, UD and FLOW sites according to each person's organization. Clients refresh within 30 seconds or when the page regains focus. Names and other office corrections survive later submissions and roster deployments. Every write is audited with the issuing account and API-key ID/name; tokens are never put in audit entries.

### CLI

The repository includes `scripts/drogs-cli.mjs`. Set the key in the agent's environment:

```sh
export DROGS_API_KEY='YOUR_ADMIN_ISSUED_KEY'
node scripts/drogs-cli.mjs people --search='E.A.T Sackey'
node scripts/drogs-cli.mjs people --bishop=B39 --photo-task=missing
node scripts/drogs-cli.mjs progress
node scripts/drogs-cli.mjs photo PERSON_ID /path/to/portrait.jpg
node scripts/drogs-cli.mjs edit PERSON_ID --json=/path/to/corrections.json
node scripts/drogs-cli.mjs edit PERSON_ID --json=/path/to/corrections.json --bishop=B39
node scripts/drogs-cli.mjs add --json=/path/to/new-pastor.json --bishop=B39
node scripts/drogs-cli.mjs import /path/to/pastors.xlsx --bishop=B39 --allow-new
node scripts/drogs-cli.mjs import /path/to/pastors.xlsx --bishop=B39 --allow-new --apply
```

A corrections file contains only fields to change, for example `{"name":"Correct Full Name","city":"Accra","country":"Ghana"}`. A new-pastor file also needs `"role":"pastor"`. The CLI resizes images larger than 5 MB before uploading. To connect to a local test server, set `DROGS_API_URL`; the default is `https://kuriakecastle.org`.

A server operator can also issue a live key with `npm run api:key -- --name="Photo CLI agent" --days=90` using the deployed application environment. The token is written only to a private file with owner-only permissions. This is different from the preserved `api:key:legacy` Supabase preparation command, whose tokens are not live MySQL keys.

### Directory and photos

| Method and route | Input / result |
| --- | --- |
| `GET /api/v1/schema` | Machine-readable routes, fields, actions and limits. Requires a read or management permission. |
| `GET /api/v1/people` | Current corrected directory records. Filters: `search`, `role`, `bishopId`, `organization`, `group`, `country`, `photoTask=missing/replace/ready`; `limit=1–500` and `after` paginate. Returns `data`, `total`, `nextCursor`. |
| `GET /api/v1/people/ID` | Current person plus `revision`; also returns an ETag. |
| `POST /api/v1/people` | JSON `{"fields":{"name":"Full Name","role":"pastor"},"bishopId":"B39"}` adds a current directory record. Returns the new stable person ID and photo totals. |
| `PATCH /api/v1/people/ID` | JSON `{"fields":{"name":"Correct Name","city":"Accra"},"bishopId":"TARGET_BISHOP_ID"}`. Omit `bishopId` to retain the supervisor. Only supplied fields change. |
| `PUT /api/v1/people/ID/photo` | Raw JPG, PNG or WebP bytes with the corresponding Content-Type, at most 5 MB; POST is also accepted. Upload and assignment happen in one request. |
| `GET /api/v1/people/ID/photo` | The current portrait URL, or null when missing. |
| `GET /api/v1/photo-progress` | The same missing/replacement/added/replaced totals as admin, plus `outstanding`, IDs and current task reasons. Requires backend read or photo write access. |
| `DELETE /api/v1/people/ID` | Soft-delete the directory record. A bishop with pastors must have those pastors moved first. |
| `POST /api/v1/people/ID/restore` | Restore a soft-deleted record. |
| `POST /api/v1/uploads?kind=portrait` | Upload raw portrait bytes and return `path` for an existing registration's `officeEdit` action. `kind=logo` is also supported. |

Person fields: `name`, `role`, `title`, `gender`, `dob`, `organization`, `denomination`, `group`, `city`, `country`, `bishop`, `branch`, `yearAppointed`, `yearOrdained`, `yearConsecrated`, `photo`, `phone`, `email`. Use `bishopId` to move a pastor. Organization/group/denomination follow the selected bishop; linked registrations and pastor lists move together. Changing a bishop's organization/group/denomination updates their pastors too. Bishops cannot be assigned as pastors under other bishops.

Send birthdays as ISO `YYYY-MM-DD` or day/month/year. Birthdays and contacts are never exposed by the public directory. A possible duplicate name (including shortened names) with a compatible birthday returns **409** with the candidate IDs. Update the existing person by ID. For a confirmed distinct namesake, supply a different birthday or explicitly set `allowDuplicate:true` when adding/editing that individual.

For concurrent editing, send the person response's ETag as `If-Match`. A stale revision returns **409**. A portrait upload also refuses to replace a newer portrait uploaded while the request was running. Re-sending the same stored image is a no-op and does not falsely clear its replacement flag.

```sh
curl -X PUT 'https://kuriakecastle.org/api/v1/people/PERSON_ID/photo' \
  -H "Authorization: Bearer $DROGS_API_KEY" \
  -H 'Content-Type: image/jpeg' --data-binary '@/path/to/portrait.jpg'
```

Successful person/photo changes include `photoProgress`. Adding a previously missing portrait decreases `missing`; changing the portrait associated with an old replacement review clears that old review and decreases `replace`. A new pastor added with a photo is ready immediately; they do not inflate the count of previously missing photos completed. Photo tasks may still be explicitly reviewed using the `reviewPhoto` action.

### Import pastor spreadsheets

`POST /api/v1/people/import` accepts JSON, XLSX or CSV. Imports preview by default. Apply with JSON `dryRun:false` or query `dryRun=false`. One batch is committed atomically; an invalid/ambiguous row writes **nothing**.

```json
{
  "bishopId": "B39",
  "dryRun": true,
  "allowNew": true,
  "moveExisting": false,
  "rows": [
    {"referenceId":"CURRENT_PERSON_ID","name":"Correct Full Name","city":"Accra"},
    {"name":"New Pastor Name","gender":"female","dob":"1990-05-17"}
  ]
}
```

For XLSX/CSV send the file body to `/api/v1/people/import?bishopId=B39&allowNew=true&dryRun=false` with `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `text/csv`. Recognized headers include Name/Full Name, First Name/Last Name, Reference ID, Rank/Title, Gender, DOB/Date of Birth, Email, Phone, Branch, City, Country and appointment/ordination years. Excel date cells retain their actual date. Bishop rows, repeated table banners, non-pastoral ranks and removed-pastors tabs are excluded.

Imports update exact current matches. New people require `allowNew:true`; a match under a different bishop requires `moveExisting:true`. Ambiguous names require `referenceId`. Imports never delete other pastors or use older office datasets. Limits: 500 pastor rows per batch; 5 MB for files, 256 KB for JSON. The response lists created, updated and skipped rows and projected/current photo totals. Upload photos by the returned person IDs after applying the sheet.

### Other office data

`POST /api/v1/actions` accepts `{"name":"ACTION","payload":{…}}` with `backend:write`. `GET /api/v1/schema` lists supported actions. Examples include `officeEdit` for a registration, `reviewPhoto`, `setCatalog`, `setFees`, `setSignup`, annual pastor-list operations, approval and status changes. Person creation/edits use `/people`; payment-provider confirmation and message broadcasts are not exposed as generic actions.

`GET /api/v1/settings` and `PATCH /api/v1/settings` read/change the website visibility settings `PUBLIC_DIRECTORY_SOURCE` and `PUBLIC_PHOTOS`, using `{"values":{…}}`. Catalog, fees and signup controls use actions. Keys do not expose or change office access credentials, authentication sessions, provider secrets or infrastructure.
