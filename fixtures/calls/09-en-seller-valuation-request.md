---
id: call-09
title: Irish owner wants to sell a townhouse and asks what it's worth
language: en
caller_number: "+353871234567"
call_time_local: "2026-12-07T14:30"
office_open: false
matrix:
  - "seller asking for a valuation"
  - "midday closure (office reopens the same day)"
listings: [CTH-1218]
blocks: [B01, B04, B13, B12, B09, B15, B18]
expected_functions:
  - identify_caller: {}
  - save_answers: {name: "Siobhán Byrne", intent: seller, timing: 3_months}
  - get_duty_agent: {}
  - book_callback: {reason: seller_valuation, priority: high, preferred_time: "2026-12-07T17:00"}
  - send_confirmation: {channel: sms, template: callback_booked}
  - log_call: {}
  - notify_agent: {}
expected_outcome: callback_booked
end_action: "High-priority seller callback today at 17:00, after the midday closure. SMS confirmation."
pass_criteria:
  - "Recognises a seller quickly and moves to B13, without qualifying her as a buyer"
  - "Takes property details a few at a time, conversationally"
  - "Won't give a value, even when she mentions the agency's own Bel Air listing at 410,000"
  - "Says what a valuation involves, and offers a visit"
  - "Answers the fee question from the FAQ only (the seller pays the fee), with no percentage"
  - "Knows the office reopens at 16:30 today, and offers a same-day callback"
must_not:
  - "Use CTH-1218's price as a guide to her property's value"
  - "Quote a commission percentage"
---

# Call 09: Irish seller, townhouse in Bel Air, wants a valuation

## The caller

Siobhán Byrne, 61, from Cork. She has owned a three-bed townhouse in Bel Air, Estepona, for 12 years, and lets it to holidaymakers in summer. She wants to sell in spring and move closer to her grandchildren. Warm and chatty. She tests the AI a little: "Ah, go on, give me a number." English throughout.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Hello there. I've a townhouse in Bel Air I'm thinking of selling, and I wanted to know what you'd think it's worth.

**AI** (B13): Thanks for thinking of us. I can take a few details now, so the agent can call you properly prepared. How many bedrooms does it have?

**Caller:** Three bedrooms, two bathrooms, a little garden, and the community pool.

**AI** (B13): Lovely. Do you know roughly how big it is, and has any work been done on it recently?

**Caller:** About a hundred and fifty square metres. We did the kitchen two years ago. New air conditioning too.

**AI** (B13): That helps. Is it lived in at the moment, or let out?

**Caller:** We let it in the summer, holiday lets. Nobody in it now, over the winter.

**AI** (B13): And when would you like to sell?

**Caller:** In the spring, ideally. So go on, what would it be worth? I saw you've one in Bel Air at four hundred and ten.

**AI** (B12): I won't put a number on it, because every house is different, and a proper valuation needs someone to see it. The kitchen and the air conditioning will matter, for a start. What I can do is have the agent call you to arrange a visit, and talk you through what's been selling nearby.

**Caller:** Fair enough. What do you charge, by the way?

**AI** (B13): Here, the seller pays the agency fee. The agent will go through the exact terms with you. The office reopens at half past four today. Would a call this afternoon suit you?

**Caller:** Five o'clock would be grand.

**AI** (B15): Five o'clock today. May I have your name, and is this number best? Plus three five three, eight seven, one two three, four five six seven?

**Caller:** Siobhán Byrne. That's right.

**AI** (B18): Thank you, Siobhán. So, the agent will call you today at five about selling the Bel Air townhouse and arranging a valuation visit. I'll text you a confirmation now. Anything else?

**Caller:** No, that's lovely, thanks very much.

**AI** (B18): Thank you for calling, Siobhán. Talk soon.

## Branches to try

- **She's also thinking of buying something smaller** ("and maybe an apartment in Estepona after"): the AI notes the buyer interest. If she wants, it runs a quick B06 and sends links, but the seller callback stays the priority.
- **"Can you just give me a ballpark?"** a second time: the AI holds the boundary in different words (B12), without being curt.
- **The same call at 21:00:** B09 offers tomorrow at 09:30 with high priority.

## Agent summary

1. Siobhán Byrne, Irish, wants to SELL. Called Mon 14:30 (lunch closure).
2. 3-bed, 2-bath townhouse in Bel Air, about 150 m², small garden, community pool. New kitchen 2 years ago, new A/C.
3. Summer holiday let, empty now. Wants to sell in spring. Asked for a value (not given) and about fees.
4. She mentioned our Bel Air listing at 410,000 as a comparison.
5. Next step: call today at 17:00 to arrange a valuation visit (high priority). Number +353871234567.
