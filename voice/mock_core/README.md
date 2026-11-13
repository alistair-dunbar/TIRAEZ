# Mock core (Part B, phase B1)

This is a stand-in for Part A's core API, built from the contract (v2). Point the voice agent at it until join 1 (Dec 7). Then change one URL to Part A's staging server.

It serves the three test agencies from `fixtures/agencies/` and keeps leads, events, viewing requests, callbacks and messages in memory. It checks every request against the contract schemas, so if the voice agent sends a wrong field, it fails here, weeks before join 1.

## Run it

```bash
pip install -r contract/tests/requirements.txt
```

```bash
python3 voice/mock_core/server.py
```

The mock is then running at `http://localhost:8787/v2`, with API key `test`. The voice platform calls your functions over the internet, so expose the mock with a tunnel:

```bash
cloudflared tunnel --url http://localhost:8787
```

| Setting | Default | Use |
| --- | --- | --- |
| `MOCK_PORT` | 8787 | Port |
| `MOCK_API_KEYS` | `test` | Accepted `X-Api-Key` values, comma-separated. Use a long random key once a tunnel is open |
| `MOCK_DELAY_MS` | 0 | Adds delay to every request. Try 800 to hear what the contract's worst case sounds like on a call |
| `MOCK_FEED_AGE_H` | 0.5 | Set it to 30 to test the "stale feed" behaviour (no availability claims) |

## Test helpers (mock only, not in the contract)

| Helper | What it does |
| --- | --- |
| Header `X-Mock-Now: 2026-12-11T13:20` | Pretends it's that local time, for duty checks and callbacks. Use each script's `call_time_local` |
| Header `X-Mock-Fail: 500`, `503` or `429` | Makes that one request fail, to test the voice agent's fallback ("let me take your details") |
| `GET /_mock/log` | Every request received, in order, with bodies. Compare it with a script's `expected_functions` after a test call |
| `GET /_mock/outbox` | Every summary and confirmation that would have been sent |
| `POST /_mock/reset` | Back to the starting state |

## What it decides, like the real core would

- **Search:** matches on reference (any status), or on town, area, type, price and bedrooms (available only, unless `include_unavailable`). It returns at most 3, available first.
- **Leads:** matched on phone or email within the agency, so a returning caller gets their last 3 events as `history`.
- **Agent choice for callbacks and viewings:** the preferred agent if they exist, then an agent who speaks the preferred language (on-duty first), then the on-duty agent.
- **Callback time:** the requested time, otherwise now if the office is open, otherwise the next opening in that agency's time zone and hours.
- **Notifications:** refuses opted-out leads (409), WhatsApp for an agency without it (503), and email to a lead with no email (400).

Seeded data: Karin Ekström (`+46701234567`, Costa Test Homes) is a returning buyer who emailed about CTH-1234. Lead `lead_01JF2B4C6D8E0G2H4J6K8M0N2P` has opted out. Everyone else starts as a new caller.

## Tests

```bash
python3 contract/tests/validate.py --base-url http://localhost:8787/v2 --include-stateful
```

This sends all 25 contract examples to the running mock. It checks status codes and response shapes.

```bash
python3 voice/mock_core/test_scripts_against_mock.py
```

This replays the expected functions of all 23 call scripts against an in-process mock. It checks that:

- returning callers are recognised;
- searches return the script's listings, and wrong references return nothing;
- office open or closed matches each script's time;
- callbacks land inside office hours;
- preferred agents and languages are honoured;
- every 5-line agent summary fits the contract.

Both run in CI.
