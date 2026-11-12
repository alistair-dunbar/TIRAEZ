---
id: call-06
title: British buyer gives a reference that doesn't exist, then describes the property
language: en
caller_number: "+447700900123"
call_time_local: "2026-12-14T23:20"
office_open: false
matrix:
  - "launch language: en, reference that exists (found by description)"
  - "reference that does not exist"
  - "video viewing first"
listings: [CTH-1203]
unknown_refs: [CTH-1290]
blocks: [B01, B05, B15, B07, B12, B08, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {ref: CTH-1290}
  - find_listing: {area: "Puerto Banús", type: penthouse}
  - save_answers: {name: "Claire Henderson", intent: buyer, budget_eur_min: 1300000, budget_eur_max: 1500000, financing: mortgage, timing: 6_months, travel_dates: "late February", add_listing_refs: [CTH-1203]}
  - get_duty_agent: {}
  - request_viewing: {listing_ref: CTH-1203, preferred_days: ["2026-12-16", "2026-12-17"], time_of_day: afternoon}
  - send_confirmation: {channel: whatsapp, template: viewing_request_received}
  - log_call: {}
  - notify_agent: {}
expected_outcome: viewing_requested
end_action: "Video viewing of CTH-1203 requested for Dec 16 or 17 in the afternoon, with an in-person visit planned for late February. WhatsApp confirmation in English."
pass_criteria:
  - "Reads the unknown reference back before saying it isn't found, in case it was misheard"
  - "Doesn't make the caller feel at fault for the wrong reference"
  - "Finds the property from her description, and confirms it with one distinguishing fact (the price)"
  - "Offers a video viewing because she isn't travelling until February (FAQ)"
  - "Mentions an independent broker when a mortgage comes up, without advising"
must_not:
  - "Say 'that reference is invalid' or blame the caller"
  - "Guess which listing she means without confirming it"
---

# Call 06: British buyer, wrong reference, penthouse in Puerto Banús

## The caller

Claire Henderson, 45, from Surrey. She's calling late after putting the kids to bed, with the listing half-remembered from a portal she browsed on her phone. Cheerful, slightly scattered, and keen. English throughout.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Oh hi, sorry it's so late! I'm ringing about a penthouse, the reference is CTH-1290, I think.

**AI** (B15, B05): Not late at all, I'm here around the clock. Let me check C-T-H, one-two-nine-zero… I can't find that reference, but it may just be a digit off. Can you tell me a little about the place?

**Caller:** Yes! It's in Puerto Banús, a penthouse, and it's got this amazing roof terrace with a hot tub.

**AI** (B05): That sounds like the three-bedroom penthouse beside Puerto Banús, with a private rooftop terrace and hot tub. Was it about one point four five million euros?

**Caller:** That's the one! Must have written it down wrong.

**AI** (B05): Easily done. Its reference is CTH-1203. It also has a concierge and underground parking. What would you like to know about it?

**Caller:** Is it close to the beach?

**AI** (B05): The listing says it's beside Puerto Banús, but it doesn't give the walking distance to the beach, so I'll have the agent confirm that. Is this a holiday place, or a move?

**Caller:** Holiday home for now. My husband and I are thinking within the next six months, budget somewhere between one point three and one point five.

**AI** (B07): That fits nicely. Would you be buying with cash or with a mortgage?

**Caller:** Partly a mortgage. Do Spanish banks lend to Brits?

**AI** (B12): That's one for a mortgage specialist, because it depends on your circumstances. The team works with independent brokers and can introduce you. I'll note that you'd like that. Are you planning a trip over?

**Caller:** Not until late February, sadly.

**AI** (B08): In that case, would a video viewing help? The agent can walk you round it on a video call before you come over.

**Caller:** Oh, that'd be brilliant. Wednesday or Thursday this week, in the afternoon?

**AI** (B08): Perfect: Wednesday the sixteenth or Thursday the seventeenth, afternoon. May I take your name?

**Caller:** Claire Henderson.

**AI** (B15): Thank you, Claire. Is this number the best one? Plus four four, seven seven zero zero, nine zero zero, one two three?

**Caller:** Yes, that's me.

**AI** (B18): So, I've passed on a request for a video viewing of the Puerto Banús penthouse on Wednesday or Thursday afternoon. The agent will call you tomorrow to confirm the time, and will mention the broker and the beach distance. Would you like the details by text or WhatsApp?

**Caller:** WhatsApp, please.

**AI** (B18): Done. Anything else I can help with?

**Caller:** No, that's great, thank you so much!

**AI** (B18): Thank you, Claire. Good night!

## Branches to try

- **Her description matches two places** ("an apartment on the Golden Mile with sea views"): the AI gives both in one line each, CTH-1201 (650,000) and CTH-1217 (1.15 million), and asks which one (B06).
- **Her description matches nothing:** the AI books a B09 callback with her description in the note, and offers to send what's closest.
- **She reads the reference again as "1-2-0-3":** it's found straight away, and B05 runs as normal.

## Agent summary

1. Claire Henderson, British, called at 23:20 about the Puerto Banús penthouse CTH-1203 (she had the wrong reference).
2. Holiday home, within 6 months. Budget 1.3 to 1.5 million, partly with a mortgage. Wants a broker introduction.
3. Requested a video viewing on Wed Dec 16 or Thu Dec 17, afternoon. In person in late February.
4. Asked about the walking distance to the beach: not in the listing.
5. Next step: call to confirm the video viewing. Number +447700900123.
