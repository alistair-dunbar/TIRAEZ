---
id: call-02
agency_id: riyadh-test-estates
title: Saudi owner wants to sell a villa in Hittin, asks its value, and asks for a woman agent
language: ar
caller_number: "+966505551234"
call_time_local: "2026-12-13T10:15"
office_open: true
matrix:
  - "seller asking for a valuation (Riyadh)"
  - "caller asks for a specific kind of agent"
listings: []
blocks: [B01, B02, B04, B13, B12, B09, B15, B18]
expected_functions:
  - identify_caller: {}
  - save_answers: {name: "Noura Al Shammari", intent: seller, timing: 3_months}
  - get_duty_agent: {}
  - book_callback: {reason: seller_valuation, priority: high, preferred_time: "2026-12-13T19:00", preferred_agent_id: sara, preferred_language: ar}
  - send_confirmation: {channel: sms, template: callback_booked, language: ar}
  - log_call: {}
  - notify_agent: {agent_id: sara}
expected_outcome: callback_booked
end_action: "High-priority seller callback from Sara today at 19:00, as the caller asked. SMS confirmation in Arabic."
pass_criteria:
  - "Moves to seller intake straight away (B13)"
  - "Won't give a value, and explains that a valuation needs a visit"
  - "When she asks for a woman agent, offers Sara simply, without comment or questions"
  - "Books the callback at the evening time she asked for, inside the office's evening hours"
  - "Takes property details a few at a time, conversationally"
must_not:
  - "Give a price, a range, or a price per square metre for her villa"
  - "Ask why she wants a woman agent"
---

# Call 02: Saudi seller, villa in Hittin, wants a valuation

## The caller

Noura Al Shammari, 55, a retired school principal. She owns a large villa in Hittin and wants to sell now her children have moved out. She'd prefer a woman agent to call her. Warm and articulate. She speaks Arabic throughout.

**Test setup:** Sunday at 10:15, so the office is open. She asks for a callback this evening, not a transfer.

## The call

**AI** (B01): مرحباً، you've reached Riyadh Test Estates. I'm the agency's AI assistant, and this call is recorded. How can I help you?

**Caller:** صباح الخير. عندي فيلا في حطين وأفكر أبيعها. كم تتوقعون سعرها؟
> *Good morning. I have a villa in Hittin and I'm thinking of selling it. How much do you expect it would sell for?*

**AI** (B02, B13): *(in Arabic)* Good morning, and thank you for thinking of us. I won't put a number on it, because a proper valuation needs someone to see the villa. What I can do is take a few details, so the agent can call you well prepared. How many bedrooms does it have?

**Caller:** ست غرف نوم، ومجلس، ومسبح، وملحق.
> *Six bedrooms, a majlis, a pool and an annex.*

**AI** (B13): Lovely. Do you know roughly the built area, and has any work been done recently?

**Caller:** حوالي ستمية متر. جددنا المطبخ والتكييف قبل سنتين.
> *About six hundred square metres. We renovated the kitchen and the air conditioning two years ago.*

**AI** (B13): That helps. Is it lived in at the moment, and when would you like to sell?

**Caller:** ساكنين فيها الحين. نبي نبيع خلال ثلاث شهور تقريباً.
> *We're living in it now. We want to sell within about three months.*

**AI** (B09): Thank you. When would be a good time for the agent to call you?

**Caller:** الليلة الساعة سبعة إذا ممكن. وأفضّل لو موظفة هي اللي تتواصل معي.
> *Tonight at seven if possible. And I'd prefer it if a woman from your team contacts me.*

**AI** (B09): Of course. Sara, one of our agents, will call you this evening at seven. May I have your name?

**Caller:** نورة الشمري.
> *Noura Al Shammari.*

**AI** (B15): Thank you, Ms Noura. Is this number best? Plus nine six six, five zero, five five five, one two three four?

**Caller:** صحيح.
> *Correct.*

**AI** (B18): So, Sara will call you this evening at seven about selling the Hittin villa and arranging a valuation visit. I'll send you a confirmation by text. Anything else?

**Caller:** لا، مشكور.
> *No, thank you.*

**AI** (B18): Thank you for calling, Ms Noura. Have a lovely day.

## Branches to try

- **"Just roughly, what are villas in Hittin selling for?":** B12 (valuation price). The agent will share real recent sales at the visit.
- **She asks about the agency's fees:** only the FAQ: the agent explains the brokerage terms in writing.
- **She wants to buy something smaller afterwards:** the AI notes the buyer interest. B06 can run if she likes, but the seller callback stays the priority.

## Agent summary (to Sara)

1. Noura Al Shammari, Saudi, wants to SELL her villa in Hittin. Called Sunday 10:15.
2. 6 bedrooms, majlis, pool and annex, about 600 m². Kitchen and A/C renovated 2 years ago.
3. Lived in now. Wants to sell within about 3 months. Asked for a value (not given).
4. Asked for a woman agent to contact her.
5. Next step: call tonight at 19:00 to arrange a valuation visit (high priority). Number +966505551234.
