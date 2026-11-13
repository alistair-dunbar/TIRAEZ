# Shared contract (v2.0.1)

This folder is the only link between the two halves of the build:

- **Part A** (`/core`) builds the core platform and the text responder, and **implements** this API.
- **Part B** (`/voice`) builds the AI phone receptionist, **calls** this API, and builds a mock of it from `/fixtures/agencies` until join 1 (Dec 7).

The contract works for every market. Everything that differs by market (country, currency, time zone, weekend, languages, area units, data region) lives in each agency's settings, so the same code serves Spain now and Dubai and Saudi Arabia later. Your partner takes Europe and you take the Gulf after the build, and both use this one contract.

If the code and the contract disagree, the contract wins until a pull request changes it.

## What is here

| File | What it is |
| --- | --- |
| `openapi.yaml` | Every endpoint: method, path, request body, responses. Open it in any OpenAPI viewer (for example the Swagger Editor) to browse it. |
| `schemas/common.schema.json` | Shared formats: times, languages, countries, currencies, time zones, data regions, phones, money, IDs, handoff topics, the error body. |
| `schemas/agency.schema.json` | Agency settings (`agency.json`, one per agency), including market settings and the phone receptionist's languages. |
| `schemas/listing.schema.json` | One property from the feed, including off-plan details (handover, payment plan, developer) and permit numbers. |
| `schemas/lead.schema.json` | One person per agency, shared by both channels, plus the shape of a lead update. |
| `schemas/event.schema.json` | One logged message, call or decision. Each event type has its own required fields. |
| `schemas/api.schema.json` | Every other request and response body. |
| `examples/` | 25 request and response pairs, at least one per endpoint, including error cases. They are the test cases. |
| `tests/validate.py` | The contract tests. Both halves run them. |
| `CONTRACT_BUNDLE.md` | The whole contract in one file, for pasting into a chat. Rebuild it with `python3 contract/bundle.py` after any change. |
| `CHANGELOG.md` | Every change since v1.0.0, including the move to v2. |

Three test agencies live in `/fixtures/agencies/`, each with `agency.json` and `listings.json`:

| Agency | Market | Currency | Time zone and weekend | Voice languages | Listings |
| --- | --- | --- | --- | --- | --- |
| `costa-test-homes` | Spain (ES) | EUR, m² | Europe/Madrid, closed Sunday and over lunch | EN ES DE SV NL FR | 20 (14 available, 3 reserved, 3 sold), plus a Kyero `feed.xml` built by `fixtures/build_feed.py` |
| `dubai-test-realty` | UAE (AE) | AED, spoken in sq ft | Asia/Dubai, closed Sunday, Friday prayer break | EN AR RU HI ZH | 12 (3 off-plan, 1 reserved, 1 sold) |
| `riyadh-test-estates` | Saudi Arabia (SA) | SAR, m² | Asia/Riyadh, closed Friday, Saturday evenings only | AR EN UR | 8 (1 off-plan, 1 reserved, 1 sold) |

## Endpoints at a glance

| Method and path | Used by | Purpose |
| --- | --- | --- |
| `GET /health` | monitoring | Liveness check, no key needed |
| `GET /agency/{agency_id}` | A, B | Agency settings |
| `GET /agency/{agency_id}/duty` | B | Is the office open now, and who takes live transfers |
| `POST /listings/search` | A, B | Up to 3 listings by reference or criteria |
| `POST /leads/upsert` | A, B | Find the person by email or phone, or create them |
| `PATCH /leads/{lead_id}` | A, B | Save qualifying answers or change status |
| `POST /leads/{lead_id}/events` | A, B | Log a message, call or decision |
| `POST /viewings/request` | A, B | Record a viewing request; the agent confirms by phone |
| `POST /callbacks` | A, B | Ask an agent to call back |
| `POST /notify/agent` | A, B | 5-line summary to the agent in their language |
| `POST /notify/lead` | A, B | Approved template to the person by SMS, WhatsApp or email |

Part B's voice functions map onto these: `find_listing` → search, `identify_caller` → upsert, `save_answers` → patch, `request_viewing` → viewings, `book_callback` → callbacks, `get_duty_agent` → duty, `take_message` → events + notify agent, `send_confirmation` → notify lead, `log_call` → events (`call_ended`) + notify agent.

## Rules every endpoint follows

- **Auth:** an `X-Api-Key` header. One key per caller (`text`, `voice`), rotated monthly. Keys never go in the repo.
- **Times:** UTC, ISO 8601, ending in `Z`. Fields ending in `_local` are the agency's local time (its own `timezone`) with no zone, for what the AI says out loud.
- **Languages:** ISO 639-1. Text can use `en es de sv nl fr ar ru hi ur zh no da pl`. Voice can use all of them except `no da pl`. Each agency switches on its own set in `languages` and `phone.voice_languages`, with a disclosure line for each.
- **Phones:** E.164 (`+34952000000`). **Money:** whole units of the agency's `currency` (EUR, AED, SAR). The AI never converts currencies. **Sizes:** always square metres in data; the AI says square feet where `area_unit` is `sqft`.
- **Speed:** 800 ms at the 95th percentile, because a caller hears every delay.
- **Errors:** status 4xx/5xx with `{"error": {"code": "...", "message": "..."}}`. The codes are listed in `common.schema.json`.
- **Nothing booked in calendars:** a viewing is a request; the agent confirms by calling the buyer.
- **Opted-out leads:** `upsert` says `opted_out: true`, and `notify/lead` refuses with 409. Both channels must respect it.

## Running the tests

```bash
pip install -r contract/tests/requirements.txt
```

```bash
python3 contract/tests/validate.py
```

That checks the contract against itself: schemas, fixtures and every example. It runs in CI on every push.

To check a running server against the contract (Part A's API, or Part B's mock):

```bash
python3 contract/tests/validate.py --base-url http://localhost:8787/v2 --api-key test
```

Add `--include-stateful` to also run the examples that need existing leads. Part B's mock should serve the example leads, so it passes all 25. Part A's staging server needs those leads seeded first.

## Changing the contract

1. Open a pull request that changes the schema, `openapi.yaml`, the examples and `CHANGELOG.md` together.
2. `validate.py` must pass.
3. **Both of you approve it.** Neither half changes the contract alone.
4. Version: adding an optional field or a new endpoint bumps the minor version (2.0.0 → 2.1.0) and can happen any time. Renaming or removing anything, or making a field required, is a breaking change: it waits for a join phase and is agreed on the call.

## Adding a new market

1. Add the country, currency and time zone to `common.schema.json` (minor version bump).
2. Add any new languages to `language`, and to `voice_language` only once a native speaker has approved the voice.
3. Add a test agency in `fixtures/agencies/<id>/`, and call scripts in `fixtures/calls/<id>/` with a test matrix for the market in `check_calls.py`.
4. Ask a local lawyer about recording notices, data storage (`data_region`) and advertising permits before the first pilot.

## Still to add in phase 0

- [ ] `fixtures/emails/`: 30 sample enquiry emails, 5 per launch language, from Idealista, Kyero, Rightmove Overseas and the web form (Part A)
- [x] `fixtures/calls/`: 23 call scripts (15 Spain, 5 Dubai, 3 Riyadh) built from 20 reusable blocks (Part B). See `fixtures/calls/README.md`
- [ ] Gulf feed samples: one real Property Finder or Bayut export, so Part A can build those parsers (when the Gulf launch starts)
- [x] Real domain (tiraez.com) in the `servers` list of `openapi.yaml`
