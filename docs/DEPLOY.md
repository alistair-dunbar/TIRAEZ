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
4. Under **Variables**, set:

   | Variable | Value |
   |---|---|
   | `APP_URL` | the https address from step 3, no trailing slash |
   | `PAYMENTS` | `moyasar` |
   | `MOYASAR_SECRET_KEY` | your Moyasar secret key |
   | `ENGINE` | `mock` to start (sample videos, free), `fal` for real videos |
   | `FAL_KEY` | your fal.ai key, only when `ENGINE=fal` |
   | `BUDGET_USD` | total fal.ai spending cap, only when `ENGINE=fal` |

5. Deploy. `https://<your address>/healthz` should return `{"ok":true}`.

The server refuses to start in production if `APP_URL`, `PAYMENTS` or `ENGINE` is missing, if
payments are in test mode, or (when buying) if the Moyasar key is not a live key.

## Before real customers

- **Don't sell with `ENGINE=mock`.** Every order would deliver the same sample video.
- **`ENGINE=fal` spending:** each order costs about $0.79. The cap in `BUDGET_USD` counts spending
  recorded in `data/spend.csv` inside the container, which is reset on each deploy. Treat it as a
  safety net, and also set a spending limit in the fal.ai dashboard.
- **Not built yet:** email verification, password reset, an admin view, a privacy policy and terms
  page, refunds of money (as opposed to credits), a durable job queue.
- **One server only.** The job queue and login limits live in memory; keep `numReplicas` at 1.
- **Data location:** Railway has no Saudi region, so customer emails and photos are stored abroad.
  Check this against Saudi data-protection law (PDPL) before scaling.
- **Untested:** the Docker image has not been built (no Docker daemon in the development
  environment), and no real Moyasar payment has been made.
