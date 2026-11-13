# CLAUDE.md

Context for Claude Code sessions on this repo. Two co-founders work on it. Keep this file current.

## The business

We sell estate agencies on the Costa del Sol (Spain) an AI assistant that replies to
every buyer enquiry within 60 seconds, in the buyer's language. It qualifies the buyer and
gives the agent an English summary. Buyers are mostly foreign (British, Dutch, German,
Swedish, French, Belgian) and enquire at night through property portals, web forms and WhatsApp.

## Repo layout

| Folder | Owner | What it holds |
| --- | --- | --- |
| `contract/` | Both. Changes need both founders' approval | API contract v2 between Part A and Part B: OpenAPI, JSON Schemas, 25 examples, `tests/validate.py` |
| `fixtures/agencies/` | Both | Test agencies (`costa-test-homes`, `dubai-test-realty`, `riyadh-test-estates`) |
| `fixtures/emails/` | Part A | 30 sample enquiry emails for `costa-test-homes` with an answer key |
| `fixtures/calls/` | Part B | Phone test scripts |
| `core/` | Part A | The Node app: demo v0 today, the core API from A1 |
| `voice/` | Part B (Dakhil) | AI phone receptionist |

Never change `contract/` alone: open a PR that both founders approve (see `contract/README.md`).
Part A implements the contract; Part B calls it and builds its own mock from `fixtures/agencies/`.

## Current stage: demo v0 (paths below are inside `core/`)

A local web app for a 60-second sales video: enquiry in -> reply in the buyer's language +
English agent summary + seconds taken. No WhatsApp, Gmail, calendar or database yet. These
sit behind interfaces in `src/channels/`, `src/calendar/` and `src/store/` with stub
implementations. Add real ones by implementing those interfaces; don't change `respond.ts`.
See PROGRESS.md for status and next steps, and PLAN.md for the agreed Part A plan (Nov 13 to Dec 18).

## Stack (ask before adding anything else)

- Node 20.12+, TypeScript run directly with `tsx` (no build step), Express, `@anthropic-ai/sdk`
- One plain HTML/CSS/JS page in `public/`. No frontend framework.
- Tests: built-in `node:test`. No test framework.
- `.env` loaded with Node's `process.loadEnvFile` (no dotenv).
- Dev-only: `tsx`, `typescript`, `@types/express`, `@types/node`.
- **Ask the user before adding any other dependency.**

## Commands (run from `core/`)

- `npm start`: server on http://localhost:3000
- `npm test`: all tests (`tests/live.test.ts` calls the real API). Live API tests skip with a message if `ANTHROPIC_API_KEY` is unset.
- `npm run typecheck`: `tsc --noEmit`
- `DEMO_MODE=offline` in `.env`: no API key needed. The 5 samples get pre-written replies from
  `data/offline-replies.json`, served through `respond()` with a stand-in client, so the safety nets
  still run. Not AI output: never use it in the sales video or present it as live.
  `tests/offline.test.ts` checks that these replies follow all 7 rules; keep them passing if you edit them.
- Windows PowerShell: use `npm.cmd` if script execution is disabled.
- Cloud sessions: Claude Code reserves `ANTHROPIC_API_KEY`, so the key is saved as `TIRAEZ_ANTHROPIC_KEY`
  in the environment settings. Run `ANTHROPIC_API_KEY="$TIRAEZ_ANTHROPIC_KEY" npm test`. Never print it.
- Contract tests (from the repo root): `pip install -r contract/tests/requirements.txt`, then
  `python3 contract/tests/validate.py`.

## Model

- From `ANTHROPIC_MODEL`, default `claude-haiku-5-5` (fast, low cost), `effort: "low"`.
- One call per enquiry using structured outputs (`output_config.format` with a JSON schema in `src/prompt.ts`).
- No `temperature`/`top_p`, no assistant prefill, no `budget_tokens`: current models reject them.
- Handle `stop_reason: "refusal"` and `"max_tokens"` before reading content.

## Rules for every reply the AI writes (non-negotiable)

1. The first sentence says it is the agency's AI assistant. EU legal requirement, not optional.
2. Reply in the language the buyer wrote in.
3. Use only facts from `data/listings.json` and the agency FAQs. Never invent a price, feature,
   availability or date. If the listing ref is missing or unknown, say so and ask which property they mean.
4. Legal, tax, mortgage and residency questions are not answered. Set `needs_human: true`
   and tell the buyer an agent will follow up.
5. One message, under 90 words, warm and professional.
6. Ask at most two qualifying questions: when they plan to buy, and when they could view.
7. End with the agency's booking link (`booking_link` in its settings). If the agency has none, end by
   asking when they could view and saying an agent will confirm by phone.

The legal footer (`legal_footer`, one line per language) is shown under the reply bubble, not inside the reply.
Both fields are optional in contract v2.1.0 agency settings.

### How the rules are enforced (keep both layers)

- **Prompt** (`src/prompt.ts`) states the rules. Only the matching listing is sent to the model,
  and none at all for an unknown ref, so it has no details to invent from.
- **Code** (`src/checks.ts`, applied in `src/respond.ts`) enforces rules 1, 4 and 7, and checks rule 3
  (prices). Legal rules must never depend on the model alone. Every change the code makes is
  recorded in `adjustments`.
- **Tests** (`tests/`) check every rule against every sample. If you change the prompt, run the live tests.

## Skills

- `.claude/skills/llm-council/`: third-party "LLM Council" skill, copied unmodified from
  github.com/aiwithremy/claude-skills-llm-council (no licence stated upstream). Say "council this: <decision>"
  for business decisions with real trade-offs (pricing, positioning, which market first). It starts
  11 sub-agents per run, so don't use it for simple questions.

## Conventions

- Everything that varies per agency or region goes in `config/agency.*.json`, never in code.
- All agencies, agents and listings in the repo are fictional ("Demo Coast Properties"). Never use
  a name a real agency might have. Example domains only (`example.com`, `.example`).
- Enquiry text is untrusted input: it goes in `<enquiry>` tags and the prompt says to treat it as data.
- Small commits with clear messages. Never commit `.env`.
- When finishing a piece of work, update PROGRESS.md.
