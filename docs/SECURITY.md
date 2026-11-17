# Security and incident response

Written 17 November 2026. This describes what the code does today and what the founders still have to do.
It is not a certification, and Tiraez does not claim one.

## In the code

| Area | What happens | Where |
|---|---|---|
| Passwords | scrypt with a random salt per password. The password itself is never stored or logged. | `app/auth.ts` |
| Sessions | 32 random bytes in an `HttpOnly`, `SameSite=Lax` cookie, `Secure` in production, 30 days. Only a SHA-256 hash is stored. Sign out ends the session. Users can sign out other devices; changing the password signs out every other session. | `app/auth.ts`, `app/server.ts` |
| Request forgery | Every state-changing API call must carry `X-Requested-With: app`, which a cross-site form can't send. Cookies are `SameSite=Lax`. | `app/server.ts` |
| Authorisation | Every photo, video and job lookup filters by the signed-in user's id, so other people's ids return "not found". Uploads, generation and purchases also need an eligible account (18+ confirmed, current terms accepted, not suspended). | `app/server.ts`, `app/jobs.ts`, `app/photos.ts` |
| Uploads | Size limit before reading. The file type is checked by content, not by name. Each photo is decoded and re-encoded by ffmpeg, which removes metadata such as location. Files get random names outside the web root. | `app/photos.ts`, `app/media.ts` |
| Private storage | Photos and videos are only served through authenticated API routes with `Cache-Control: private`/`no-store`. Static serving is confined to `app/public`. | `app/server.ts` |
| Secrets | API keys come only from environment variables and are never sent to the browser. Logs pass through `redact()`, which removes keys, tokens, email addresses and signed URL queries. | `app/guard.ts` |
| Rate limits | Per address: sign-up, sign-in, reports. Per account: photos, purchases, onboarding, password, email and deletion attempts, and exports. Each email also locks for 15 minutes after 8 wrong passwords. | `app/guard.ts`, `app/auth.ts` |
| Duplicate protection | A video request carries a client key, and the same key returns the first job instead of charging again. A provider submit whose outcome is unknown is never resent automatically. | `app/jobs.ts` |
| Payments | The payment webhook's content isn't trusted: it only names an invoice, which the server then checks with Moyasar directly. Credits are granted exactly once. Payments are currently off. | `app/server.ts`, `app/credits.ts` |
| Rendering | The front end builds the DOM with text nodes only (`app/public/js/dom.js`). Policy pages are rendered from Markdown with everything escaped first. | `app/legal.ts` |
| Headers | CSP (`default-src 'self'`, no inline script or style, `object-src 'none'`, `frame-ancestors 'none'`), HSTS and an http→https redirect in production, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, COOP and CORP `same-origin`, a restrictive `Permissions-Policy`. All are tested. | `app/server.ts` |
| Retention | Hourly: unused photos are removed after the configured number of days (`config/retention.json`), expired sessions are deleted and half-written uploads are cleaned up. | `app/account.ts` |
| Deletion | Deleting a video or an account deletes rows and files. Purchase rows are kept with the account reduced to an anonymous id. | `app/account.ts` |
| Provider data | fal is asked not to keep requests in its history (`X-Fal-Store-IO: 0`), and to expire uploaded and generated files after 24 hours. | `app/providers/fal.ts` |
| Dependencies | No runtime npm dependencies. Dev only: `tsx`, `typescript`, `@types/node`. `npm audit` found 0 vulnerabilities on 17 Nov 2026. | `package.json` |

## Known limits

- Rate limits and the login lock live in memory. They reset on restart and assume a single server.
- Behind Railway, the last `X-Forwarded-For` entry is treated as the visitor's address. Recheck this if the proxy setup changes.
- There is **no email verification and no password reset**, because no email provider is set up. Until there is, a person who forgets their password has to contact support, and an account's email address isn't proven to belong to its holder.
- The SQLite database and files sit on one Railway volume. Whether Railway takes backups, and for how long, hasn't been checked (see `docs/LEGAL-REVIEW.md`).
- There is no admin interface. Reports and suspensions are handled from the command line.

## Founders' tasks (not code)

1. Turn on two-factor sign-in for GitHub, Railway, fal, GoDaddy and Moyasar. Keep the list of who has access.
2. In the fal dashboard, set the account's default media expiry and access, as a backstop to the per-request headers. fal's default for CDN files is to keep them, readable by anyone with the link.
3. Check Railway's volume backups and log retention, then record them in `config/legal.json`.
4. Decide on an email provider, so email verification and password reset can be added.
5. Rotate the fal key if it has ever been pasted anywhere other than Railway's variables.
6. Review the open reports regularly with `npm run reports`.

## Handling reports and misuse

- `npm run reports` lists open reports, with child-safety reports first.
- `npm run reports -- --close <id> --outcome "<what was done>"` closes one.
- `npm run suspend -- --email <address> --reason "<why>"` suspends an account and signs it out everywhere. `--lift` reverses it.
- On the server, run the same files with `node app/reports.ts …` from Railway's shell.
- Content involving the sexual abuse of children: don't download or forward it. Suspend the account, keep the report record and get legal advice on reporting to the authorities straight away.

## Incident response outline

1. **Notice.** Signs include: a report through the form, an alert from a provider, unexpected spend on fal, unusual logs, or a leaked key.
2. **Contain.** Do whichever of these applies:
   - Rotate the leaked secret (fal key in the fal dashboard and Railway variables; Moyasar keys likewise).
   - Suspend the affected accounts.
   - Sign everyone out (`DELETE FROM sessions;` in the database).
   - Take the service offline by scaling the Railway service to zero.
   - Turn off generation by removing `ENGINE`.
3. **Assess.**
   - Find out what data, whose and how many people.
   - Work out the timeline, and whether the data left our systems or a provider's.
   - Keep notes with timestamps from the start.
4. **Notify.** Get legal advice the same day, because deadlines are short.
   - Under the Saudi PDPL Implementing Regulation (Art 24), SDAIA must be told within **72 hours** of becoming aware of a breach that could cause harm. Affected people must be told without undue delay.
   - Other places' laws may also apply, depending on where users are.
   - If a provider is the source, ask it for its incident report.
5. **Recover.** Fix the cause, restore from a known-good state, and watch for recurrence.
6. **Review.** Within two weeks, write down what happened, what was done and what changes as a result.
