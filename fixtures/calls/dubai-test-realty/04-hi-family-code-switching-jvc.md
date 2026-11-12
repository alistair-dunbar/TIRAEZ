---
id: call-04
agency_id: dubai-test-realty
title: Indian family mixes Hindi and English while looking for a two-bed in JVC
language: hi
caller_number: "+971551234567"
call_time_local: "2026-12-16T20:30"
office_open: false
matrix:
  - "launch language: hi"
  - "code-switching mid-call (Hindi and English)"
  - "sizes in square feet"
listings: [DTR-2004]
blocks: [B01, B02, B04, B06, B20, B05, B07, B08, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {area: "Jumeirah Village Circle", type: apartment, beds: 2, price_max: 1300000}
  - save_answers: {name: "Rohan Mehta", intent: buyer, budget_max: 1300000, financing: mortgage, timing: 3_months, add_listing_refs: [DTR-2004]}
  - get_duty_agent: {}
  - request_viewing: {listing_ref: DTR-2004, preferred_days: ["2026-12-19"], time_of_day: morning, preferred_agent_id: priya, preferred_language: hi}
  - send_confirmation: {channel: sms, template: viewing_request_received, language: en}
  - log_call: {}
  - notify_agent: {}
expected_outcome: viewing_requested
end_action: "Viewing request for DTR-2004 on Sat Dec 19 in the morning, with Priya (who speaks Hindi). SMS confirmation in English, as he asked."
pass_criteria:
  - "Follows his Hindi and English mix naturally, and never asks him to choose one language"
  - "Keeps the English property words he uses ('two bedroom', 'covered parking', 'pre-approval')"
  - "Gives the size as about 1,130 sq ft"
  - "Says honestly that school distance isn't in the listing"
  - "Doesn't comment on his mortgage pre-approval, and just records financing as a mortgage"
  - "Sends the confirmation in English, because he asks for that"
must_not:
  - "Correct his language mixing, or switch fully to English unprompted"
  - "Give mortgage advice"
---

# Call 04: Indian family, Hindi and English mixed, two-bed in JVC

## The caller

Rohan Mehta, 34, an IT manager from Pune who has lived in Dubai for five years. He's married with a young daughter, and they're moving from renting to buying. He speaks Hinglish: Hindi sentences full of English words. Friendly and organised, and he already has mortgage pre-approval.

## The call

**AI** (B01): Hello, marhaba, you've reached Dubai Test Realty. I'm the agency's AI assistant, and this call is recorded. How can I help you?

**Caller:** Hello, haan. Main JVC mein ek two bedroom apartment dhoond raha hoon, family ke liye. Budget around one point three million dirham hai.
> *Hello, yes. I'm looking for a two-bedroom apartment in JVC, for the family. The budget is around one point three million dirhams.*

**AI** (B02, B06): *(now in Hindi, keeping his English words)* Of course. Let me check JVC two-bedrooms up to one point three million… There's a good one: a two-bedroom apartment at one point two five million dirhams, with park views, covered parking, a pool and a gym.

**Caller:** Accha. Kitne square feet ka hai?
> *OK. How many square feet is it?*

**AI** (B20): About one thousand one hundred and thirty square feet.

**Caller:** Theek hai. Aur school paas mein hai? Meri beti ke liye.
> *Fine. And is there a school nearby? For my daughter.*

**AI** (B05): That's not in the listing, and I don't want to guess. The agent knows JVC well and can tell you which schools are close.

**Caller:** OK, no problem. Humne bank se pre-approval le liya hai, mortgage lenge.
> *OK, no problem. We've got pre-approval from the bank, we'll take a mortgage.*

**AI** (B07): Good to know. Are you hoping to buy fairly soon?

**Caller:** Haan, teen mahine ke andar. Kya hum Saturday subah dekh sakte hain?
> *Yes, within three months. Can we see it on Saturday morning?*

**AI** (B08): Saturday the nineteenth, in the morning. I'll pass that on. Priya, one of our agents, speaks Hindi and will call you to confirm the time. May I have your name?

**Caller:** Rohan Mehta.

**AI** (B15): Thank you, Rohan ji. Is this number best? Plus nine seven one, five five, one two three, four five six seven?

**Caller:** Haan, sahi hai.
> *Yes, that's right.*

**AI** (B18): So, Priya will call you tomorrow to confirm a Saturday morning viewing of the JVC two-bedroom. Would you like a text with the details, in Hindi or in English?

**Caller:** English mein bhej dijiye.
> *Send it in English, please.*

**AI** (B18): Done. Anything else?

**Caller:** Nahi, bas. Thank you!
> *No, that's all. Thank you!*

**AI** (B18): Thank you, Rohan ji. Have a good evening.

## Branches to try

- **He asks in Urdu-flavoured Hindi:** the AI carries on the same way. Priya also speaks Urdu.
- **"Two crore rupees tak ka budget hai"** (a budget of up to two crore rupees): B20. The AI asks for a dirham figure and doesn't convert.
- **He wants three bedrooms:** B06 finds nothing in JVC within 1.3 million AED, says so plainly, and offers a B09 callback with the criteria in the note.

## Agent summary

1. Rohan Mehta, Indian, Dubai resident, called at 20:30. Wife and young daughter.
2. Wants a 2-bed in JVC, up to 1.3 million AED. Mortgage with bank pre-approval, within 3 months.
3. Liked DTR-2004 (about 1,130 sq ft, covered parking). Asked about nearby schools: not in the listing.
4. Requested a viewing on Sat Dec 19, morning. Speaks Hindi and English.
5. Next step: Priya to call and confirm. Number +971551234567.
