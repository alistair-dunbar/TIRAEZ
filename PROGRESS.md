# Progress

Last updated: 2026-11-12

## Finished (demo v0)

- [x] Project scaffold: Node 20.12+, TypeScript via `tsx`, Express, Anthropic SDK. No other runtime dependencies.
- [x] `config/agency.demo.json`: fictional "Demo Coast Properties, Marbella", agent Laura, 5 languages, tone,
      booking link, AI disclosure and legal footer in each language, FAQs
- [x] `data/listings.json`: 6 fictional listings (Marbella, Estepona, Benahavís, Mijas, Fuengirola, Nerja)
- [x] `data/sample-enquiries/`: 5 portal emails (EN, DE, SV, NL, FR); `tests/fixtures/`: mortgage question, unknown ref
- [x] `src/parse.ts`: name, email, phone, listing ref, message. Works on labelled portal emails and pasted free text.
- [x] `src/respond.ts`: one Claude call with a strict JSON schema. Model from `ANTHROPIC_MODEL`
      (default `claude-haiku-5-5`, low effort).
- [x] Server-side safety nets for rules 1, 3, 4 and 7: disclosure, invented prices, handoff topics, booking link
- [x] `src/server.ts`: `POST /enquiry`, `GET /api/config`, `GET /api/samples`, `GET /api/enquiries`, static page
- [x] The page: sample dropdown plus paste box, chat bubble, legal footer under the bubble, agent summary card,
      live timer. Works at phone width.
- [x] Stub interfaces: `src/channels/` (outbound logs to the console), `src/calendar/` (static booking link),
      `src/store/` (in-memory)
- [x] Tests: 55 offline tests pass (parser, rule checks, and safety nets using a fake model client).
      Live API tests are written and skip cleanly without a key.
- [x] README, CLAUDE.md, .env.example, .gitignore
- [x] Offline mode (`DEMO_MODE=offline`): pre-written replies for the 5 samples, a yellow banner on the page,
      no API key needed. Tested: every pre-written reply passes the rule checks.
- [x] Plain-language error messages for API failures (401/403/404/429/timeouts)

## Not finished / not verified

- [ ] **The live API tests have never run.** There was no `ANTHROPIC_API_KEY` in the build environment.
      So the prompt has not yet been tried against the real model. Unverified so far: the language of
      each reply, the 90-word limit, the question count and the 15-second timing. The structured-output
      schema (nullable fields use `anyOf` with `null`) has also not been accepted by the API yet.
      This is the first thing to do.
- [ ] The page has only been checked with a fake reply, not a real one.
- [ ] The language check in the tests is a simple common-word heuristic. It is good enough for the 5
      samples but is not a general language detector.
- [ ] If the code-level handoff net sets `needs_human` after the model already answered a mortgage or
      tax question, the reply text is not rewritten. The flag tells the agent to review it.
      Consider blocking auto-send in that case once real sending exists.
- [ ] Spanish and other languages: the model replies in them, but the disclosure and footer config only
      cover EN, DE, SV, NL and FR. Others fall back to the English footer.
- [ ] No real channels (WhatsApp, Gmail, portal webhooks), calendar, database, auth or deployment. Out of scope for v0.

## Next steps

The full plan after the demo is in PLAN.md (Part A, revised Nov 12). The steps below cover A0.

0. Until the API key is added, use `DEMO_MODE=offline` to try the flow. Don't record the video with it.
   On a co-founder's Windows laptop, a live request returned `403 forbidden / Request not allowed` before
   a key with credit was set up. Retest once the key has credit, with any VPN off.
1. Add the API key (see README) and run `npm test`. Fix the prompt for any failing live test.
   Re-run 2–3 times, because model output varies between runs.
2. Run `npm start`, pick the German sample, click Send, and screen-record the 60-second video.
3. If replies are slow, look at `elapsed_ms` on the card. Haiku at low effort should take a few seconds.
4. After the demo: implement `OutboundChannel` for email (Gmail API) first. Portal enquiries arrive by email,
   so it covers the most leads. Then WhatsApp Business.
5. Swap `MemoryStore` for SQLite or Postgres, and add an agent inbox page listing `needs_human` enquiries.
6. Get a Spanish lawyer to review the AI disclosure wording and the legal footer before any real agency uses it.
