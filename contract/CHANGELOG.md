# Contract changelog

Every change to the shared contract, newest first. Each entry needs approval from both Part A and Part B.

## 2.1.0 (Nov 13, 2026)

- Agency settings gain two optional fields for the text channels:
  - `booking_link`: the agency's own viewing-booking page (https). When set, every text reply ends with it, as reply rule 7 requires. When missing, the reply asks when the buyer could view and the agent confirms by phone, as for calls.
  - `legal_footer`: small print under every text reply, per language: that an AI wrote it and how the buyer's data is handled. When set, it needs a line for every language in `languages` (checked by `validate.py`). Final wording waits for the lawyer.
- `costa-test-homes` sets both. `dubai-test-realty` and `riyadh-test-estates` set neither, so both cases are covered.
- Not a breaking change: both fields are optional, and nothing else changed. Agreed by both partners (Part B verbally, Nov 13).

## 2.0.1 (Nov 12, 2026)

- Examples only: example 19 (opted-out lead) now uses its own lead, so it no longer contradicts examples 10, 16, 20 and 21, which use Karin's lead as a normal returning buyer. No schema changes.

## 2.0.0 (Nov 12, 2026)

Breaking: the contract now serves every market, ready for the Gulf launch after the build. Nothing had been built against v1, so this was the cheapest moment to break it. Approved by both partners (Europe: Part A partner, Gulf: Part B partner).

- Paths move from `/v1/` to `/v2/`.
- Money: `price_eur` becomes `price` plus `currency` (EUR, AED, SAR). `budget_eur_min` and `budget_eur_max` become `budget_min` and `budget_max`, in the agency's currency. The AI never converts.
- Agency settings gain `country`, `currency`, `area_unit` (m2 or sqft), `data_region` (eu, uae, ksa), any listed `timezone`, `phone.voice_languages`, `phone.opening_languages`, and `speaks` on each agent. A disclosure line is now required for every language the agency offers, with English always.
- Languages add Arabic, Russian, Hindi, Urdu and Chinese, for text and voice.
- Listings gain `completion` (ready or off_plan). Off-plan listings require `handover`, `payment_plan` and `developer`. There is an optional `permit_number`.
- Handoff topics add `visa_residency` and `investment_returns`.
- Viewing requests add `evening` to `time_of_day`.
- Feed types add `property_finder_xml`, `bayut_xml` and `generic_xml`.
- Fixtures move to `fixtures/agencies/<id>/`, with two new test agencies: `dubai-test-realty` and `riyadh-test-estates`.
- Added examples 22 to 25 (Dubai search in AED, an off-plan listing, an Arabic caller, Friday duty in Riyadh).

## 1.1.0 (Nov 12, 2026)

- Added optional `preferred_agent_id` and `preferred_language` to `POST /callbacks` and `POST /viewings/request`, so a caller can ask for a specific agent or language. Fallback rule: Part A uses the named agent if they exist, otherwise an agent who speaks the language, otherwise the on-duty agent.
- Added examples 20 and 21.
- Not a breaking change: both fields are optional. Approved by both partners, who left the design of this one change to the author.

## 1.0.0 (signed off Nov 12, 2026)

- First version: 11 endpoints, 6 schema files, 19 examples, and the Costa Test Homes fixtures.
- Sign-off: [x] Part A  [x] Part B (both partners read it and agreed to continue)
