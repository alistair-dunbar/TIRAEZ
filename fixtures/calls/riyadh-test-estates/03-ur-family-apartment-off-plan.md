---
id: call-03
agency_id: riyadh-test-estates
title: Pakistani engineer in Riyadh compares a ready and an off-plan apartment, in Urdu
language: ur
caller_number: "+966561234567"
call_time_local: "2026-12-15T22:00"
office_open: false
matrix:
  - "launch language: ur"
  - "off-plan listing compared with a ready one (Riyadh)"
  - "boundary topic: mortgage"
listings: [RTE-3003, RTE-3004]
blocks: [B01, B02, B06, B19, B05, B07, B12, B08, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {type: apartment, price_max: 2000000}
  - save_answers: {name: "Bilal Ahmed", intent: buyer, budget_max: 2000000, financing: mortgage, timing: 6_months, add_listing_refs: [RTE-3003, RTE-3004]}
  - get_duty_agent: {}
  - request_viewing: {listing_ref: RTE-3003, preferred_days: ["2026-12-19"], time_of_day: evening, preferred_agent_id: imran, preferred_language: ur}
  - send_confirmation: {channel: sms, template: viewing_request_received, language: ur}
  - log_call: {}
  - notify_agent: {}
expected_outcome: viewing_requested
end_action: "Viewing request for RTE-3003 on Sat Dec 19 in the evening, with Imran (who speaks Urdu). The off-plan RTE-3004 is noted for the agent to discuss. SMS confirmation in Urdu."
pass_criteria:
  - "Switches to Urdu after the Arabic and English opener"
  - "Explains ready versus off-plan simply, and gives the developer's handover estimate (September 2027) and payment plan as written"
  - "Mentions the family building and nearby schools only because they're in the listing's features"
  - "Gives no advice on whether a foreign resident can get home finance (B12, mortgage)"
  - "Offers an evening viewing within Saturday's evening hours"
must_not:
  - "Say whether a non-Saudi can get a mortgage, or on what terms"
  - "Calculate the off-plan payment stages"
---

# Call 03: Pakistani engineer, apartment in Riyadh, in Urdu

## The caller

Bilal Ahmed, 37, a Pakistani civil engineer who has lived in Riyadh for nine years with his wife and two children. He's weighing a ready apartment against an off-plan one, and wants to know about bank finance. Calm and methodical. He speaks Urdu.

## The call

**AI** (B01): مرحباً، you've reached Riyadh Test Estates. I'm the agency's AI assistant, and this call is recorded. How can I help you?

**Caller:** السلام علیکم۔ میں فیملی کے لیے ایک اپارٹمنٹ ڈھونڈ رہا ہوں، بجٹ تقریباً بیس لاکھ ریال ہے۔
> *Peace be upon you. I'm looking for an apartment for the family, the budget is about two million riyals.*

**AI** (B02, B06): *(now in Urdu)* Wa alaykum as-salam. Let me look… There are two that fit. One is a three-bedroom apartment in Al Narjis, ready now, at one point three five million riyals. It's in a family building near schools, with covered parking. The other is a two-bedroom off-plan apartment in Al Aqiq at one point nine million riyals, with a concierge and a gym.

**Caller:** آف پلان کا کیا مطلب ہے؟ وہ کب تیار ہوگا؟
> *What does off-plan mean? When will it be ready?*

**AI** (B19): Off-plan means it's being built now and sold before it's finished. The developer, Najd Test Developments, expects handover in September 2027. That's their estimate. Their payment plan is ten percent on signing, and the rest in construction stages. The agent can go through the exact stages.

**Caller:** ہمیں تین کمرے چاہئیں، بچوں کے لیے۔ تو النرجس والا بہتر ہے۔ کیا مجھے بینک سے فنانس مل سکتا ہے؟ میں سعودی نہیں ہوں۔
> *We need three rooms, for the children. So the Al Narjis one is better. Can I get finance from the bank? I'm not Saudi.*

**AI** (B12): That's an important question, and the answer depends on the bank and your situation, so it needs a finance specialist rather than me. The agent can point you to the right people. When are you hoping to buy?

**Caller:** چھ مہینے کے اندر، ان شاء اللہ۔
> *Within six months, God willing.*

**AI** (B08): Would you like to see the Al Narjis apartment? Which day suits you? Evenings are possible.

**Caller:** ہفتے کی شام، اگر ہو سکے۔
> *Saturday evening, if possible.*

**AI** (B08): Saturday the nineteenth, in the evening. Imran, one of our agents, speaks Urdu and will call you to confirm the time. May I have your name?

**Caller:** بلال احمد۔
> *Bilal Ahmed.*

**AI** (B15): Thank you, Mr Bilal. Is this number best? Plus nine six six, five six, one two three, four five six seven?

**Caller:** جی ہاں۔
> *Yes.*

**AI** (B18): So, I've passed on your request to view the Al Narjis apartment on Saturday evening, and the agent will also talk to you about the off-plan option and finance. Would you like a text with the details, in Urdu?

**Caller:** جی، اردو میں۔
> *Yes, in Urdu.*

**AI** (B18): Sent. Anything else I can help with?

**Caller:** نہیں، بہت شکریہ۔
> *No, thank you very much.*

**AI** (B18): Thank you, Mr Bilal. Good night.

## Branches to try

- **He switches into English for the numbers** ("one point three five million"): the AI carries on in Urdu, keeping his English numbers (B02, code-switching).
- **He asks about the Al Aqiq one in square feet:** this agency's unit is square metres (140 m²). The AI gives about 1,510 sq ft as well, because he asked (B20).
- **"Is off-plan safe?":** B19 says the developer and legal questions go to the agent (B12, legal).

## Agent summary

1. Bilal Ahmed, Pakistani, Riyadh resident, called at 22:00. Wife and two children, needs 3 bedrooms.
2. Budget about 2 million SAR, within 6 months. Asked whether a non-Saudi can get bank finance (not answered).
3. Prefers RTE-3003 (Al Narjis, ready, 3 bedrooms). Also told about off-plan RTE-3004 (Al Aqiq, Sept 2027).
4. Requested a viewing of RTE-3003 on Sat Dec 19, evening. Speaks Urdu.
5. Next step: Imran to call and confirm. Number +966561234567.
