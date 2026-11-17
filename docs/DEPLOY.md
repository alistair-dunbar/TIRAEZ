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

## What opens what in production

Run `npm run launch-check` (on Railway: `node app/launch-check.ts`) to see exactly what each part waits for:

- **Policies published:** fill in the operator details in `config/business.json`, confirm `config/retention.json`, fill in the remaining `config/legal.json` values, and set `"status": "published"`.
- **New accounts:** the policies are published, safeguards are recorded for Railway and Resend in `config/compliance.json` (see `docs/compliance/transfers.md`), and email is configured (below).
- **Video generation:** safeguards are recorded for Railway and fal, and `ENGINE=fal` is set.
- **Payments:** the billing decisions (`paymentsOnly` in `config/legal.json`) are recorded, and Moyasar is configured.

Existing accounts can always log in, watch, download, export and delete their data.

`LEGAL_PREVIEW=1` shows the drafts with a "not in force" banner and lifts these gates. Use it only on a deployment that isn't public, never on www.tiraez.com. An hourly job applies the retention periods inside the web process.

**Refunds (once payments are on):**
1. `npm run refunds` lists the open requests.
2. Return the money in the Moyasar dashboard.
3. Then run `npm run refunds -- --approve <id> --note "…" --provider-ref <moyasar refund id>`. This removes the unused credits so they can't be spent.

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
   - `MAIL_FROM=Tiraez <support@tiraez.com>` (an address on the domain verified in Resend; tiraez.com's Resend DKIM, SPF and MX records are already published, region ap-northeast-1)
   - `APP_URL=https://www.tiraez.com` (links in emails are built from this, never from the request)
   - `MAIL_REPLY_TO=support@tiraez.com` (replies reach the Zoho mailbox, if it exists)
5. Redeploy. The start-up log line should end with `email: resend`.
6. Before opening sign-ups, send yourself a real confirmation and reset email on a non-public preview
   deployment (`LEGAL_PREVIEW=1`), and check that the links open www.tiraez.com and work once.

Without these, `/api/site` reports `mailOn: false`. The forgot-password page then says reset by email
isn't switched on, and existing accounts can't confirm their email (so they can't upload or generate).

## Retention

`app/retention.ts` runs hourly. Video and source-photo expiry stays in report-only mode until `RETENTION_MEDIA=enforce` is set. Follow `docs/RETENTION.md` (inventory, dry-run, then enforce) before setting it.
