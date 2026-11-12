# Sample enquiry emails (Part A)

30 enquiry emails to the test agency `costa-test-homes`, 5 in each launch language
(en, es, de, sv, nl, fr), with an answer key. They are the A2 test set: every email must get a
correct draft reply in under 60 seconds (go or no-go check on Dec 1).

All people, addresses and phone numbers are fictional and use example domains. The portal
layouts (Idealista, Kyero, Rightmove Overseas) are written to look like typical lead emails;
they are **not** copies of the real portals' emails. Replace them with real, anonymised
samples once a pilot agency forwards some.

| Source | Emails | Template language |
| --- | --- | --- |
| `kyero` | 11 | English |
| `idealista` | 8 | Spanish, whatever the buyer's language, so language must come from the buyer's own words |
| `rightmove_overseas` | 5 | English |
| `web_form` | 6 | English labels (the agency's own site) |

`source` uses the values of `payload.source` in `contract/schemas/event.schema.json`.

## What the set covers

- Listings that are available (18), reserved (3), sold (3) and unknown (2), and no ref at all (4)
- Handoff topics from the agency settings: mortgage, tax, legal, negotiation, complaint, and a
  seller asking for a valuation
- An opt-out (`BAJA`), a prompt injection, two refs in one email, refs written without a hyphen or
  only in the message text, and dates such as "June 2027" that must not be read as refs

## answer-key.json

One entry per email:

| Field | Meaning |
| --- | --- |
| `name`, `email`, `phone` | As written in the email (`null` if not given) |
| `phone_e164` | The phone in E.164, as `POST /leads/upsert` needs it |
| `listing_ref` | The main ref, normalised to `CTH-1234` form, or `null` |
| `listing_status` | From `fixtures/agencies/costa-test-homes/listings.json`: `available`, `reserved`, `sold`, `unknown` (not in the feed), or `null` |
| `intent`, `timing`, `financing` | Lead values from `contract/schemas/lead.schema.json`. Timing is counted from Nov 2026: `now` within a month, `3_months`, `6_months`, `later` beyond that |
| `budget_max` | Whole euros, only when the buyer states one |
| `travel_dates` | Free text, when the buyer gives dates they could view |
| `handoff_topic` | A topic from the agency's `handoff_topics`, or `null` |
| `needs_human` | True for a handoff topic or an unknown ref |
| `opt_out` | True when the buyer asks for no more messages |
| `notes` | What a correct reply must and must not do |

`core/tests/emails.test.ts` checks that the parser reads the name, email, phone and ref of every
email exactly as the key says, and that the key matches the listings fixture.
