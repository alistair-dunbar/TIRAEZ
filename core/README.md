# Part A: core platform and text responder

Owned by Part A. Implements the API in `/contract` (v2) from phase A1. Today this folder holds
demo v0, the text responder. Run every command below from this `core/` folder.

## Demo v0: enquiry assistant

A small local web app for a sales video. Paste or pick a buyer enquiry for a
Costa del Sol estate agency, click **Send**, and see:

- the reply in the buyer's language (opens with the AI disclosure, ends with the booking link)
- an English summary for the agent, with budget / area / timing / travel dates and a "needs human" flag
- how many seconds it took

The agency ("Demo Coast Properties, Marbella", agent "Laura") and all listings are fictional.

### Run it

Needs Node 20.12 or newer and an Anthropic API key.

```bash
cd core
```

```bash
npm install
```

```bash
cp .env.example .env
```

Open `.env`, set `ANTHROPIC_API_KEY=...`, then:

```bash
npm start
```

Open http://localhost:3000, keep the German sample selected and click **Send**.

```bash
npm test
```

Without a key, `npm test` runs the 55 offline tests and skips the live API tests with a message.

On Windows PowerShell, if `npm` says "running scripts is disabled", type `npm.cmd` instead of `npm`.

#### No API key yet? Offline mode

Add `DEMO_MODE=offline` to `.env` and run `npm start`. The 5 samples then get **pre-written replies**
from `data/offline-replies.json`, and anything else gets a placeholder. No key or internet is needed.
The page shows a yellow "Offline demo" banner. These replies are not AI output, and the timer only
measures how fast the page shows them, so **do not use offline mode for the sales video**.
Remove the line to go back to live replies.

### Configuration

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | Any current Claude model ID. Haiku is the fast, low-cost default |
| `PORT` | `3000` | Web server port |
| `AGENCY_CONFIG` | `config/agency.demo.json` | Per-agency settings file |
| `DEMO_MODE` | (unset) | `offline` = pre-written replies, no API key needed |

Real environment variables take priority over `.env`.

Everything that changes per agency or region (name, agent, languages, tone,
booking link, AI disclosure line per language, legal footer, FAQs) is in
`config/agency.demo.json`. Listings are in `data/listings.json`.

### How it works

```
enquiry text ─► parse.ts (regex, no AI) ─► find listing in listings.json
             ─► respond.ts: one Claude call, strict JSON schema
             ─► checks.ts safety nets ─► reply + summary + timing
```

The server-side safety nets make sure the legal rules hold even if the model slips:

- adds the AI disclosure if it is not the first sentence
- moves or adds the booking link to the end
- sets `needs_human` for legal, tax, mortgage or residency keywords in five languages, and for unknown listings
- flags any euro amount that is not a listing price or a figure the buyer wrote

Any fix it makes is listed in `adjustments` and shown in small print on the summary card.

### Project layout

```
config/agency.demo.json   per-agency settings
data/listings.json        6 fictional listings
data/sample-enquiries/    5 portal emails: en, de, sv, nl, fr
data/offline-replies.json pre-written replies for offline mode
src/parse.ts              raw text -> name, contact, ref, message
src/prompt.ts             system prompt + JSON schema
src/respond.ts            the Claude call + safety nets
src/checks.ts             rule checks used by the server and the tests
src/offline.ts            offline mode (DEMO_MODE=offline)
src/server.ts             Express: POST /enquiry, GET /api/config, GET /api/samples, static page
src/channels/             inbound/outbound channel interface (stub logs to console)
src/calendar/             calendar interface (stub returns the booking link)
src/store/                storage interface (stub keeps enquiries in memory)
public/                   the page (plain HTML/CSS/JS)
tests/                    node:test suites (live.test.ts calls the real API); tests/fixtures has the mortgage and unknown-ref cases
```

### Demo endpoint

```bash
curl -s localhost:3000/enquiry -H 'content-type: application/json' \
  -d '{"text":"Hi, is DCP-1005 still available? Erik"}'
```

The response is `{ language, reply, summary_en, qualification: { budget, area, timing, travel_dates }, needs_human, reason }`
plus `parsed`, `listing`, `legal_footer`, `model`, `elapsed_ms` and `adjustments`.
