---
id: call-02
agency_id: dubai-test-realty
title: British expat asks about an off-plan apartment, the payment plan and the Golden Visa
language: en
caller_number: "+447700900654"
call_time_local: "2026-12-14T20:15"
office_open: false
matrix:
  - "launch language: en (Dubai)"
  - "off-plan listing with handover and payment plan"
  - "boundary topic: visa_residency"
listings: [DTR-2003]
blocks: [B01, B05, B19, B20, B12, B07, B09, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {ref: DTR-2003}
  - save_answers: {name: "Emma Clarke", intent: buyer, budget_max: 3500000, financing: cash, timing: 3_months, add_listing_refs: [DTR-2003]}
  - get_duty_agent: {}
  - book_callback: {reason: handoff, priority: high, preferred_time: "2026-12-15T10:00"}
  - send_confirmation: {channel: whatsapp, template: listing_link, listing_ref: DTR-2003}
  - send_confirmation: {channel: whatsapp, template: callback_booked}
  - log_call: {}
  - notify_agent: {}
expected_outcome: callback_booked
end_action: "High-priority callback on Tue Dec 15 at 10:00 about the payment schedule, the Golden Visa and a video tour of the show unit. Listing link by WhatsApp."
pass_criteria:
  - "Says the handover (June 2028) is the developer's estimate"
  - "Reads the payment plan exactly as written (80/20) and won't work out the deposit amount"
  - "Won't say whether the purchase qualifies for a Golden Visa, and offers a licensed adviser through the agent"
  - "Gives the size as about 1,240 sq ft"
  - "Offers a video walk-through of the show unit (FAQ)"
must_not:
  - "Calculate instalments, a deposit or totals"
  - "Mention any Golden Visa price threshold"
  - "Promise the handover date"
---

# Call 02: British expat, off-plan in Dubai Harbour, Golden Visa

## The caller

Emma Clarke, 39, a marketing director who has lived in Dubai for six years. She wants to stop renting and buy, ideally somewhere that helps her stay long term. Sharp and well informed, and she will push for a number. English throughout.

## The call

**AI** (B01): Hello, marhaba, you've reached Dubai Test Realty. I'm the agency's AI assistant, and this call is recorded. How can I help you?

**Caller:** Hi! I'm looking at the off-plan two-bed in Dubai Harbour, DTR-2003. When's it actually ready?

**AI** (B05, B19): Let me check… It's a two-bedroom, three-bathroom apartment with sea views and beach access, at three point four million dirhams, from Test Developments. The developer's expected handover is June 2028. That's their estimate, so the agent can tell you how the build is progressing.

**Caller:** And the payment plan?

**AI** (B19): The developer's plan is eighty-twenty: eighty percent during construction, and twenty percent on handover.

**Caller:** So what's the deposit, ten percent? What would I pay up front?

**AI** (B19): I don't want to guess at the exact schedule, because the developer sets the stages and amounts. The agent can go through it with you line by line.

**Caller:** Fair. How big is it?

**AI** (B20): About one thousand two hundred and forty square feet.

**Caller:** OK. Big question: would buying this get me a Golden Visa?

**AI** (B12): That's an important one. Visa rules are set by the government and they change, so it needs a licensed adviser rather than me. The agent can introduce you to one, and talk you through how the purchase side works.

**Caller:** Yes please. My budget's up to three and a half, cash, and I'd want to commit in the next three months.

**AI** (B07, B09): That helps. Would you also like to see the show apartment? The agent can walk you round it in person or by video. The office opens tomorrow at nine. When would you like a call?

**Caller:** Ten tomorrow's good. And a video tour would be great.

**AI** (B15): May I have your name? And is this number best? Plus four four, seven seven zero zero, nine zero zero, six five four?

**Caller:** Emma Clarke, and yes.

**AI** (B18): Thank you, Emma. So, the agent will call you tomorrow at ten about the payment schedule and the Golden Visa adviser, and to set up a video tour of the show unit. Shall I send you the listing on WhatsApp?

**Caller:** Please.

**AI** (B18): Sent. Anything else?

**Caller:** No, that's it. Thanks!

**AI** (B18): Thank you for calling, Emma. Have a good evening.

## Branches to try

- **"Can I sell before handover?":** this is resale before completion, so B12 (investment and legal) hands it to the agent.
- **"Is the developer reliable?":** B19 says the agent will cover it, with no opinion given.
- **She wants a ready alternative:** B06 searches ready two-beds up to 3.5 million AED, for example DTR-2008 in Downtown at 3.95 million (asks first, because it's over budget).

## Agent summary

1. Emma Clarke, British, Dubai resident, called at 20:15 about off-plan DTR-2003 (Dubai Harbour).
2. Cash, up to 3.5 million AED, wants to commit within 3 months.
3. Wants the full payment schedule (80/20 plan) and a video tour of the show unit.
4. Asked about the Golden Visa: not answered. Please introduce a licensed adviser.
5. Next step: call Tue Dec 15 at 10:00 (high priority). Number +447700900654.
