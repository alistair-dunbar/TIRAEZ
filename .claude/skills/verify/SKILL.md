---
name: verify
description: Verify the video service works without asking the founder to check by hand. Runs typecheck and the end-to-end tests, drives the full journey in a real browser against a local test server, and checks the live site (www.tiraez.com) read-only. Use after any change to app/, catalog/ or config/, before saying something works, and whenever the user asks "does it work", "is the site up" or "check it".
---

# Verify

Run the layers in order and report each result plainly. Never claim something works that a layer
didn't check; say which layer would catch it. All three layers are free.

## 1. Code (always)

```bash
npm run typecheck
npm test            # 43 end-to-end tests (service + accounts/legal/security), test-only mock provider
```

## 2. Local journey in a real browser (after UI or flow changes)

Uses a throwaway database and the test-only mock provider (NODE_ENV=test). Its clips are ffmpeg
test patterns: never show them to anyone as product output.

```bash
mkdir -p .cache/e2e && ffmpeg -v error -y -f lavfi -i "testsrc2=size=1200x1600" -frames:v 1 .cache/e2e/photo.jpg && printf 'not a photo' > .cache/e2e/fake.jpg
rm -f .cache/e2e/app.db*
NODE_ENV=test ENGINE=mock PAYMENTS=test JOB_POLL_MS=1500 DB_PATH=.cache/e2e/app.db DATA_DIR=.cache/e2e PORT=3202 node --disable-warning=ExperimentalWarning app/server.ts &
curl -s -X POST localhost:3202/api/signup -H 'X-Requested-With: app' -H 'Content-Type: application/json' -d '{"name":"Owner","email":"owner@example.com","password":"password123","age":"30","agreeTerms":true,"confirmAdult":true,"termsVersion":"'"$(node -p 'require("./config/legal.json").documents.terms.version')"'"}'
DB_PATH=.cache/e2e/app.db npx tsx app/grant-credits.ts owner@example.com 4 e2e
for size in "1440 900" "768 1024" "390 844"; do node scripts/verify-journey.mjs http://localhost:3202 .cache/e2e $size; done
```

The journey signs in, filters and searches the catalogue, checks the empty state and that filters
survive Back, uploads a fake and a real photo, frames it with the keyboard, refreshes mid-draft,
generates, refreshes mid-job, waits for the result, checks the video doesn't autoplay and the
download is an attachment, then "Create another version", "Change template" and My videos, then
the account page, a policy page and the report form. Each
line it prints is a check; the last line lists any page errors or horizontal overflow. Look at the
screenshots in `.cache/e2e/` before reporting on anything visual. Stop the server afterwards
(`pkill -f "app/server.ts"`).

## 3. Live site (after a deploy, or when asked if the site is up)

```bash
NODE_USE_ENV_PROXY=1 node scripts/verify-live.mjs https://www.tiraez.com .cache/verify-live
```

Read-only: no sign-ups, uploads or generations on production. It checks health, https redirect,
HSTS, CSP and the other security headers, that unpublished policies are withheld (and sign-ups
closed) until `config/legal.json` is published, the icons and manifest, the catalogue (and that no prompt text or unapproved media is exposed), 404s,
and four pages at 1440, 768 and 390 for status, heading, overflow and console errors. Railway
deploys a push in about two minutes; wait before checking a change.

## What only the founders can check

- A paid generation (costs money; needs an explicit go-ahead and a budget).
- Anything behind their own accounts: Railway settings, GoDaddy DNS, fal.ai and Moyasar dashboards.
- Whether copy reads naturally to customers, and native review of any Arabic.
