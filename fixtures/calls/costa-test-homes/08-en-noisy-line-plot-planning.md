---
id: call-08
agency_id: costa-test-homes
title: Scottish caller on speaker phone in a car asks about a building plot
language: en
caller_number: "+447700900789"
call_time_local: "2026-12-11T19:30"
office_open: false
matrix:
  - "strong accent, background noise, speaker phone"
  - "boundary topic: legal (planning and licences)"
listings: [CTH-1211]
blocks: [B01, B15, B05, B12, B09, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {area: "Los Arqueros", type: plot}
  - save_answers: {name: "Callum MacLeod", intent: buyer, timing: later, add_listing_refs: [CTH-1211]}
  - get_duty_agent: {}
  - book_callback: {reason: handoff, priority: high, preferred_time: "2026-12-14T10:30"}
  - send_confirmation: {channel: sms, template: listing_link, listing_ref: CTH-1211}
  - send_confirmation: {channel: sms, template: callback_booked}
  - log_call: {}
  - notify_agent: {}
expected_outcome: callback_booked
end_action: "High-priority callback on Mon Dec 14 at 10:30 about planning and licences for CTH-1211. The listing link is sent by SMS so he can look once he's stopped driving."
pass_criteria:
  - "Repairs a misheard place name by asking about the specific part ('was it Los Arqueros?'), not with 'please repeat'"
  - "Keeps turns very short, because he is driving"
  - "Doesn't ask him to take the phone off speaker more than once"
  - "Gives the plot facts from the feed, including 'a project ready for licence', without explaining what that means legally"
  - "Hands the planning and licence questions to a person (B12)"
  - "Reads the number back in small groups, and repeats only the group he corrects"
  - "Offers the Saturday 10:00 opening first, then Monday when he asks"
must_not:
  - "Say how big a house he can build, or when building can start"
  - "Ask him to write anything down while driving"
---

# Call 08: Noisy line, building plot, planning questions

## The caller

Callum MacLeod, 52, from Inverness. He builds houses back home, and is calling from his car on speaker phone, with road noise and an indicator ticking. He has a strong Highland accent, talks fast, and says "aye". He wants to build his own villa. English throughout.

**Test setup:** play this from a moving car, or over a road-noise recording, with the phone on speaker.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Aye, hiya, I'm after the plot ye've got up at Los Arqueros, the one wi' the golf views.

**AI** (B15): Sorry, it's a little noisy on the line. I caught "the plot" and "golf views". Was it Los Arqueros?

**Caller:** Aye, that's the one, Los Arqueros.

**AI** (B05): Thank you. Let me check… Yes, it's available: a building plot on Los Arqueros golf, about two thousand six hundred square metres, at eight hundred and ninety thousand euros, with sea views. The listing says there's a project ready for licence.

**Caller:** Right. How big a house could I put on it? And "ready for licence", does that mean I could start next year?

**AI** (B12): Both good questions, and both depend on the local planning rules and the paperwork, so they need a proper answer from the agent and a lawyer rather than from me. I'll have the agent call you with that. When suits you?

**Caller:** What's that? Sorry, lorry going past.

**AI** (B15): No problem. I'll have the agent call you. The office is open tomorrow, Saturday, from ten. Or would Monday be better?

**Caller:** Monday. Mid-morning, half ten.

**AI** (B09): Monday at half past ten. May I have your name?

**Caller:** Callum MacLeod.

**AI** (B15): Thank you, Callum. Is this number best? Plus four four… seven seven zero zero… nine zero zero… seven eight nine?

**Caller:** Seven eight nine, aye.

**AI** (B18): So, the agent will call you on Monday at half past ten about the plot, the house size and the licence. I'll text you the link so you can look once you've stopped. Is that all right?

**Caller:** Aye, brilliant. Cheers.

**AI** (B18): Thanks, Callum. Drive safely.

## Branches to try

- **The place name fails twice** (the tester mumbles "Los Arqueros" both times): the AI stops trying. It offers "Shall I text you a link where you can type the area, or have the agent call you?", then B09 (B15, the two-tries rule).
- **The line drops after he gives his name:** see B16. The agent is notified, and a callback is booked because he had asked about the plot.
- **"Is there an architect you'd recommend?":** not in the FAQ. The agent will answer.

## Agent summary

1. Callum MacLeod, Scottish builder, called Fri 19:30 from his car about plot CTH-1211 (Los Arqueros).
2. Wants to build his own villa. Asked how big a house he can build, and whether "ready for licence" means he can start next year.
3. Planning and licence questions passed to you (high priority). He may want a lawyer.
4. Listing link sent by SMS.
5. Next step: call him Mon Dec 14 at 10:30. Number +447700900789.
