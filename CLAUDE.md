# CLAUDE.md

Context for Claude Code sessions on this repo. Two co-founders work on it. Keep this file current.

## The business

A 100% self-serve, credit-based web app: a merchant picks a template, uploads 1 product photo,
gets a text-free, silent vertical video ad in ~60 seconds. First market: Saudi
Salla/Zid merchants. Full plan: `docs/PLAN.md`.

## Pivot (15 Nov 2026): social media templates

The founder decided to pivot away from video generation and focus on social media templates.
First deliverable: `docs/SOCIAL-TEMPLATES.md`, 50 copy-and-paste post templates (10 niches x 5 types).
First paid pack in progress: `docs/packs/coffee-shops-ar.md`, 30 Arabic (Saudi dialect) templates for specialty
coffee shops plus a 30-day calendar. It is an AI draft and must be reviewed by a native Saudi speaker before sale.
Plan: sell as a one-off pack on a ready-made checkout; nothing else decided yet. The video code (`render/`, `scenes/`, `ads/`)
and `docs/PLAN.md` describe the earlier video product and are paused, not deleted. The sections below
that describe the video product are kept for reference until the new plan is written.

## The service (built 15 Nov 2026, `app/`)

The founder's priority is finishing the full self-serve service; video quality experiments are paused.
`app/` is the web service: accounts, prepaid credits, template catalogue, optional photo upload, video
orders with automatic refund on failure, download. Zero dependencies (node:http, node:sqlite, node:crypto).

- `npm start` (set `PAYMENTS=test ENGINE=mock` locally), `npm test` (9 end-to-end tests, free).
- `ENGINE=mock` (default) delivers a sample video and costs nothing. `ENGINE=fal` spends real money per
  order through the cap in `render/budget.ts`. Never switch to `fal` without the user asking.
- `PAYMENTS=test` grants credits without charging and refuses to run in production. No real gateway yet:
  it plugs into `PaymentProvider` in `app/credits.ts`.
- Packs: `config/packs.json`. Templates: `catalog/templates.json` (each points at a prompt spec in `ads/`).
- UI text: `STRINGS` in `app/public/app.js`, Arabic first with an English toggle. The Arabic is an AI draft.
- Not built yet: real payments, email verification and password reset, login rate limiting, hosting,
  a durable job queue, an admin view. The merchant-photo path of the fal engine is untested.

## Hard rules

- No agency work: no client servicing, calls or custom edits. Everything must be self-serve.
- The merchant's product never goes through the video model: it is cut out and composited,
  unchanged, onto an AI-generated background scene. Labels, logos and Arabic text must never be altered.
- Background scenes are product-independent and reused from a library; don't re-render per order.
- Direction under test (15 Nov 2026): the founder found the cut-out composites unconvincing and prefers
  fully AI-generated video. The two rules above apply to the composite method only; whether a merchant's
  own product survives full generation with its label intact has not been tested yet.
- Videos have no text and no music by default. Captions are a separate optional feature; music is added by the merchant in TikTok/Instagram.
- Prepaid credits only, no unlimited plans.

## Current stage

Week 1 render test (Nov 16-22 2026): a command-line script, photo + template -> mp4.
No web app, accounts or database yet. First results: `docs/RENDER-TEST.md`.

## Stack and commands

- Node 22.21+, TypeScript run with `tsx` (no build step), system `ffmpeg` for all image/video work.
- fal.ai called with plain `fetch` (no SDK). Dev-only deps: `tsx`, `typescript`, `@types/node`.
- `npm run samples`, `npm run scenes -- --template <id>`, `npm run render -- --photo <f> --template <id>`,
  `npm run typecheck`. Usage details in README.md.
- `npm run ai-video -- --spec ads/<id>.json` (paid, fully AI-generated) and
  `npm run finish -- --video <f> --spec ads/<id>.json` (free finishing pass: auto-edit + natural look).
  Looks live in `looks/*.json`, shot lists in the spec's `edit.shots`; nothing per video is hard-coded.
- Cloud sessions: prefix with `NODE_USE_ENV_PROXY=1`. The fal.ai key is a network secret injected by the proxy.
- Spending: hard cap `BUDGET_USD` (default $5), ledger `data/spend.csv`. Never raise the cap without asking.
- Scenes cost money: they are committed in `scenes/`; never delete or re-render them without asking.
- Test photos are openly licensed stock, listed with credits in `samples/sources.json`; the images aren't committed.

## Conventions

- Ask the user before adding any dependency.
- API keys only in environment variables, never committed or printed. Never commit `.env`.
- Sample businesses and products in the repo are fictional; example domains only.
- Small commits with clear messages.

## Skills

- `.claude/skills/llm-council/`, `claude-council/`: "council this: <decision>" for real trade-offs. Starts many sub-agents.
- `.claude/skills/business-model/` (phuryn/pm-skills): Business Model Canvas.
- `.claude/skills/grill-me/` (mattpocock/skills): needs the `grilling` skill, not installed yet.
- `.claude/skills/verify/`: empty, purpose not decided yet.
