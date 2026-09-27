# DROGS on Hostinger

The source now includes a Node.js backend for MySQL and private Cloudflare R2 images. The public registration page is `/`; the office page is `/admin` (Next.js redirects to `/admin/`). Both use the same server and database. No separate backend domain is needed.

## Deployment

Use the **source** repository `theflowchurch/drogs`, branch `codex/annual-registration`. The site is connected through the Hostinger GitHub App with auto-deployment enabled on that branch, so every push builds and restarts the app; **Redeploy** in hPanel or `POST …/nodejs/builds` with `source_type: git` runs the same pipeline on demand. Keep the auto-deployment branch set to `codex/annual-registration` (it was previously pointed at `codex/registration-api-keys`, which is why pushes did not go live). `jkgbafa/drogs-registration` only redirects to the domain.

1. Create a Hostinger **Node.js application** using Node 22 or newer. Use this source folder as the application root.
2. Add the variables in `HOSTINGER.env.example` to the application's environment settings at **build and runtime**. The local `.env` is private, ignored by Git, and must not be uploaded to a public web directory.
3. Set `NEXT_PUBLIC_REGISTRATION_BACKEND=mysql`, `NEXT_PUBLIC_BASE_PATH=` (empty), and `APP_URL=https://drogs.dagministry.org`.
4. Fill `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` with the exact Hostinger database values. Use `localhost` only when Hostinger specifies it for this application. An external server requires its reachable hostname, allowed remote access and TLS settings if applicable.
5. Set `SITE_ACCESS_CODE=1234`. Set `ADMIN_ACCESS_CODE` to a different private code for `/admin`, and keep `ADMIN_EMAILS` as the office account identity used by the server.
6. Add SMTP settings for email sign-in. Use `SMTP_PORT=587` with `SMTP_SECURE=false` for STARTTLS, or port 465 with `SMTP_SECURE=true` for implicit TLS. `SMTP_FROM` must be a sender allowed by the email provider. Keep the generated `SESSION_SECRET` private and stable.
7. Use a **private R2 bucket** with an Object Read & Write token scoped only to that bucket. Set `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. These provider credentials stay on the server; connected apps use DROGS's separate read-only API keys. Optional scoped temporary R2 credentials are also supported through `R2_SESSION_TOKEN`, but expire and require renewal. Keep public access off. Uploads travel through the app server, so browser upload CORS settings are unnecessary.
8. Install dependencies with `npm ci`. Run `npm run db:migrate` from the Hostinger application terminal before first start. Alternatively import `mysql/001_registration.sql` followed by `mysql/002_api_keys.sql` in phpMyAdmin. It only creates tables prefixed `dr_` and is safe to rerun. **Do not import the Supabase PostgreSQL migrations into MySQL.**
9. In Hostinger choose the **Other** framework preset, build command `npm run build`, output directory `.`, and entry file `scripts/start-hostinger.mjs`. For terminal deployments, build with `npm run build`; start with `npm start`. The start command runs `scripts/start-hostinger.mjs`, which serves both Next.js and `/api/registration/*`. Do not substitute `next start` or serve `out/`; neither runs this custom API server. Hostinger supplies `PORT`.
10. Attach `drogs.dagministry.org` to this Node.js application and enable HTTPS. Redirect `www` to the canonical domain. Restart after changing environment variables; rebuild after changing any `NEXT_PUBLIC_*` variable.

When testing on a temporary Hostinger domain, set `APP_URL` to that exact HTTPS origin. Change it to the final domain and restart when DNS is ready. API calls are relative to the current origin, cookies are scoped to that host, and stored image references contain no website hostname. Existing images remain usable; users sign in again after switching domains.

## What is stored

- MySQL: verified users, annual registrations and typed form details, bishop roster entries, status/payment decisions, audit events, session/code hashes, and media ownership records.
- Registration records keep complete versioned JSON and indexed user/year identifiers. `photo_key` and `proof_key` explicitly hold permanent R2 object keys. Media records store the owner, type and byte size.
- R2: decoded and re-encoded WebP portraits/receipt images. The server checks type, size and image content, strips metadata, and limits dimensions. It does not determine whether clothing is correct; the required user photo acknowledgement remains.
- The backend issues temporary signed read URLs after permission checks. It never stores expiring URLs in registration records. Portraits are visible to their owner, the office and the approved supervising bishop after submission. Receipts are available only to their owner and the office.

The API derives identity and office status from a verified session, rejects foreign-origin writes, limits sign-in attempts, and validates file ownership. Database transactions serialize changes using a settings-row lock to prevent lost roster matches or duplicate claims. This first implementation reads the registration state inside each transaction; very large directories may require SQL-level filtering/pagination later.

Demo browser data and the previous Supabase data are not automatically migrated. Existing legacy tables/files are unchanged. Supabase/static demo builds remain available when `NEXT_PUBLIC_REGISTRATION_BACKEND` is unset. Keep backups of both MySQL and R2; avoid bucket lifecycle rules that delete submitted photos/receipts. Replaced but unused uploads are retained, not automatically deleted.

## Verification

- `npm test`: domain rules, permissions, upload validation and existing PostgreSQL regression checks.
- `TEST_MYSQL_PORT=3307 npm run test:mysql`: real local MySQL/MariaDB integration tests. Optional `TEST_MYSQL_USER`/`TEST_MYSQL_PASSWORD`; the test creates and drops only a uniquely named `drogs_test_*` database. SMTP and R2 transport are simulated; no real email is sent or cloud object written.
- Production smoke test after credentials and DNS are ready: open `/`, request/verify a code, upload a portrait, save/reload and submit. Sign in at `/admin` with an allowed office email and confirm the same record/photo appears. Check `dr_registrations` and the R2 object. Verify an unrelated account cannot open that record or image.

Provider references: [Hostinger MySQL setup](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/) and [Cloudflare R2 signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

The backend never calls R2 delete operations, including after a failed database save. Removing delete calls alone does not restrict a credential: the signed action scope must also be enforced by Cloudflare.

See [API.md](API.md) for the application API key system and read-only endpoints. The app-issued keys never permit deletion, regardless of the private server-side R2 credential.
