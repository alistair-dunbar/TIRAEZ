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

## The service (`app/`, rebuilt 16 Nov 2026)

The founder's priority is finishing the full self-serve service; video quality experiments are paused.
Zero dependencies (node:http, node:sqlite, node:crypto, system ffmpeg). Plain JS front end in `app/public/js`.

- Journey: landing -> catalogue (`/templates`) -> template (`/templates/<slug>`) -> workspace
  (`/create/<slug>`: upload, framing, schema-built form, settings, review) -> job (`/videos/<id>`) -> My videos.
- `npm start`, `npm test` (20 end-to-end tests, test-only mock provider, free), `npm run credits`.
- Generation: `ENGINE=fal` + `FAL_KEY` (or `FAL_AUTH=proxy` in cloud sessions). Unset = switched off and
  the site says so. `ENGINE=mock` exists for tests only and is refused outside `NODE_ENV=test`: never
  show simulated or prerecorded output to customers. Never switch on `fal` without the user asking.
- fal adapter (`app/providers/fal.ts`) follows fal's docs as checked 16 Nov 2026: CDN upload, queue submit,
  status, result. A submit that may have been accepted is never resent automatically. Live-verified:
  the CDN upload only. Submitting a generation costs money and has not been run through this code.
- Jobs (`app/jobs.ts`) are persisted at every step and resumed on start-up; failures refund credits once.
- Templates: `catalog/templates/*.json`; prompts stay server-side (`app/prompt.ts` assembles them).
- Media: no sample or preview media is approved. Never add any without the founders' explicit approval
  (`docs/MEDIA.md`).
- Brief exclusions for the website (16 Nov 2026): no gradients, Lucide, em dashes, Inter/Geist/Space
  Grotesk, side stripes, fake proof, bento grids, terminal mock-ups, "not X but Y" slogans, checkmark
  bullets, three-tier pricing, pill or soft rounded shapes (0-4px radius), purple, skeleton loaders,
  radial orbs, dot grids, sparkles, animated arrows, neon, pastel palettes, Terms/Privacy pages. UK English.
- Payments: `PAYMENTS=moyasar` written, tested against a stand-in; off by the founder's choice for now.
- Hosting: `Dockerfile` + `railway.json`, steps in `docs/DEPLOY.md`. Production runs plain `node`, so keep
  the code to erasable TypeScript (`erasableSyntaxOnly`).
- Not built yet: email verification, password reset, an admin view, Arabic interface (the UI copy is
  English only in `app/public/js/copy.js` and the views).

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

## Earlier render test

The command-line render experiments (`render/`, results in `docs/RENDER-TEST.md`) are paused.

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
- `.claude/skills/motionsites-web-builder/` (Motionsites-AI/claude-skill): landing pages and hero sections with a
  screenshot-and-fix loop. Sponsored: it asks Claude to end each delivery with a MotionSites upgrade ad (in chat
  only, never in code); say "stop mentioning MotionSites" to turn that off. Its media shelf is hotlinked from
  third-party hosts (cloudfront, figma.site); copy any media we keep into the repo rather than hotlinking it.
- From nextlevelbuilder/ui-ux-pro-max-skill (7 skills): `ui-ux-pro-max` (searchable local design data: styles,
  palettes, font pairings, UX rules), `ui-styling`, `design`, `design-system`, `brand`, `banner-design`, `slides`.
  `design` can generate logos and images through Gemini, Atlas Cloud, MuAPI or UberLLM, each needing its own API
  key; none is configured, and adding one is the user's call.
- `design-taste-frontend` (Leonxlnx/taste-skill) was installed globally (~/.agents), not in the repo, so it is
  lost when a cloud session's container is recycled.
- `.claude/skills/verify/`: project skill. Typecheck + tests, the local browser journey (`scripts/verify-journey.mjs`),
  and read-only live checks of www.tiraez.com (`scripts/verify-live.mjs`). Run it before saying something works.
