# Going live: Moyasar payments and Railway hosting

Status (15 Nov 2026): the code for both is written and tested with stand-ins. Neither has been
run against the real service yet, because that needs accounts only the founders can create.

## 1. Moyasar (payments)

**What you need first:** a Saudi commercial registration or freelance licence, and a Saudi bank
account linked to it.

1. Create an account at moyasar.com. Test keys are available straight away; live keys after approval.
2. Ask Moyasar sales for a written quote: mada rate, card rate, fixed fee per transaction, refund
   fees and settlement time. Their prices are not published.
3. Copy the **secret key** (`sk_test_…` first, `sk_live_…` once approved). Never paste it in chat or
   commit it. It goes in Railway's Variables (step 2.4).

**How it works in the service** (`app/moyasar.ts`):
- "Buy" creates a Moyasar invoice for the pack price and sends the buyer to Moyasar's payment page.
  mada, Apple Pay, STC Pay and cards are handled there; card details never reach our server.
- Moyasar sends the buyer back to `/api/purchases/<id>/return` and separately notifies
  `/api/webhooks/moyasar`.
- Neither is trusted. Each time, the server asks Moyasar for the invoice and grants credits only if
  it is `paid`, in SAR, for the exact pack price, and tagged with our purchase number. Credits are
  granted once, however many notices arrive.

**To check with a test key before going live:** buy the pack with a Moyasar test card, confirm the
balance becomes 15, then repeat and abandon the payment, and confirm the balance doesn't change.

**VAT:** `config/packs.json` holds the price charged. Decide whether SAR 250 includes the 15% VAT,
and what your invoices must show, before taking real payments.

## 2. Railway (hosting)

1. Create a Railway account and a new project → **Deploy from GitHub repo** → pick this repository
   and the branch to deploy. Railway reads `railway.json` and builds the `Dockerfile`.
2. Add a **Volume** to the service, mounted at **`/data`**. Without it, the database, uploads and
   videos are lost on every deploy.
3. Under **Networking**, generate a domain (or attach your own). That address is `APP_URL`.
4. Under **Variables**, set what you are switching on (all optional; see `.env.example`):

   | Variable | Value |
   |---|---|
   | `ENGINE` | `fal` to switch generation on. Leave unset to run the site with generation off |
   | `FAL_KEY` | your fal.ai key, when `ENGINE=fal` |
   | `GENERATION_BUDGET_USD` | optional cap on estimated fal.ai spend, across all customers |
   | `PAYMENTS` | `moyasar` when you take payments. Leave unset until then |
   | `MOYASAR_SECRET_KEY`, `APP_URL` | with `PAYMENTS=moyasar` |

5. Deploy. `https://<your address>/healthz` should return `{"ok":true}`.
6. Give testers credits without payments: open the Railway shell and run
   `node app/grant-credits.ts someone@example.com 5 "tester"` (the account must exist first).

The server refuses to start in production with the test stand-ins (`PAYMENTS=test`, `ENGINE=mock`),
or with `PAYMENTS=moyasar` but no `APP_URL`.

## Before real customers

- **First live generation:** no paid generation has been run through the service yet. Make one with your own account before inviting customers, and check the result page, My videos and the download.
- **`ENGINE=fal` spending:** a 5-second video costs about $0.79. `GENERATION_BUDGET_USD` counts estimated
  spend in the database (kept on the volume). Treat it as a safety net, and also set a limit in the fal.ai dashboard.
- **Not built yet:** email verification, password reset, an admin view, refunds of money (as opposed to
  credits). Terms and privacy pages were left out of this build on purpose; you will need them before
  taking payments.
- **One server only.** Jobs are stored in the database and resumed after a restart, but only one
  server should run them; keep `numReplicas` at 1.
- **Data location:** Railway has no Saudi region, so customer emails and photos are stored abroad.
  Check this against Saudi data-protection law (PDPL) before scaling.
- **Untested:** the Docker image has not been built (no Docker daemon in the development
  environment), and no real Moyasar payment has been made.

## Policies and sign-ups in production (17 Nov 2026)

- Until `config/legal.json` has `"status": "published"` and every fact in `config/business.json` and
  `config/legal.json` is filled in, production withholds the policy pages and keeps **sign-ups closed**.
  New accounts would otherwise have to agree to terms that don't exist yet. Existing accounts can still
  sign in, watch, download, export and delete. They can't upload or generate until they accept the
  published terms.
- `LEGAL_PREVIEW=1` shows the drafts with a "not in force" banner and opens sign-ups against the draft
  terms. Use it only on a deployment that isn't public, never on www.tiraez.com.
- Publishing:
  1. Fill in the facts.
  2. Set each document's `effective` date.
  3. Set `config/retention.json` → `"confirmed": true`.
  4. Set `"status": "published"`.
  5. Push. The live check (`scripts/verify-live.mjs`) then expects sign-ups to be open.
- An hourly job removes unused photos older than `unusedPhotosDays`, along with expired sessions. It runs inside the
  web process; nothing else to schedule.

## Account emails (needed before sign-ups can open)

Sign-up, email confirmation, password reset and email changes all work in code and are tested
against a sandbox outbox. On the live site they stay off until a real email provider is configured,
and sign-ups stay closed until then. The adapter is written for **Resend** (plain HTTPS, no new dependency).

1. Create a Resend account. Add a sending domain, preferably a subdomain such as `mail.tiraez.com`.
2. Resend shows the DNS records for that domain (DKIM and SPF: TXT plus MX or CNAME records). Add them
   exactly in **GoDaddy → DNS** for tiraez.com and wait for Resend to show the domain as verified
   (usually minutes, up to 72 hours). Adding a DMARC record afterwards is recommended.
3. In Resend, create an API key with **sending access** only.
4. In **Railway → the service → Variables**, add the following. Don't paste the key anywhere else: not into chat, code or a committed file.
   - `MAIL=resend`
   - `RESEND_API_KEY=` the key
   - `MAIL_FROM=Tiraez <account@mail.tiraez.com>` (an address on the verified domain)
   - `APP_URL=https://www.tiraez.com` (links in emails are built from this, never from the request)
   - optionally `MAIL_REPLY_TO=` your support address
5. Redeploy. The start-up log line should end with `email: resend`.
6. Before opening sign-ups, send yourself a real confirmation and reset email on a non-public preview
   deployment (`LEGAL_PREVIEW=1`), and check that the links open www.tiraez.com and work once.

Without these, `/api/site` reports `mailOn: false`. The forgot-password page then says reset by email
isn't switched on, and existing accounts can't confirm their email (so they can't upload or generate).
