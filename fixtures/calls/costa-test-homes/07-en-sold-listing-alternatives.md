---
id: call-07
agency_id: costa-test-homes
title: Buyer asks about a sold villa from an old advert and gets alternatives
language: en
caller_number: "+447700900456"
call_time_local: "2026-12-12T15:40"
office_open: false
matrix:
  - "sold listing"
  - "similar listings sent"
listings: [CTH-1215, CTH-1202, CTH-1209]
blocks: [B01, B05, B06, B07, B12, B09, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {ref: CTH-1215, include_unavailable: true}
  - find_listing: {type: villa, price_min: 2800000, price_max: 4500000}
  - save_answers: {name: "Robert Hughes", intent: buyer, budget_min: 3000000, budget_max: 4500000, timing: 6_months, add_listing_refs: [CTH-1202, CTH-1209]}
  - get_duty_agent: {}
  - book_callback: {reason: buyer_question, priority: normal, preferred_time: "2026-12-14T10:00"}
  - send_confirmation: {channel: whatsapp, template: listing_link, listing_ref: CTH-1202}
  - send_confirmation: {channel: whatsapp, template: listing_link, listing_ref: CTH-1209}
  - send_confirmation: {channel: whatsapp, template: callback_booked}
  - log_call: {}
  - notify_agent: {}
expected_outcome: callback_booked
end_action: "Two alternative villas (CTH-1202 La Zagaleta, CTH-1209 El Madroñal) sent by WhatsApp. Agent callback on Mon Dec 14 at 10:00."
pass_criteria:
  - "Says clearly and kindly that CTH-1215 has sold, then asks what he liked about it"
  - "Builds the search from what he liked (gated, sea views, space, near Marbella), not just from the price"
  - "Is honest that CTH-1209 is not listed as gated, while CTH-1202 is"
  - "Doesn't share what CTH-1215 sold for"
  - "Offers Monday, because the office is closed Saturday afternoon and Sunday"
must_not:
  - "Reveal or estimate the sale price of CTH-1215"
  - "Say any property is in a gated community unless its features say so"
---

# Call 07: Sold villa, alternatives sent

## The caller

Robert Hughes, 58, from Cardiff. He's semi-retired and sold a business last year. He saw the Sierra Blanca villa on an old advert and is disappointed to hear it's gone, but easily won over by good alternatives. Relaxed and conversational. English throughout.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Afternoon. I saw a villa of yours in Sierra Blanca, CTH-1215. Is it still on the market?

**AI** (B05): Good afternoon. Let me check… I'm sorry, that one has sold. Can I ask what you liked about it? I may be able to find you something similar.

**Caller:** Shame. Well, it was gated, which matters to us, big sea views, plenty of space, and close to Marbella. We were looking at three to four and a half million.

**AI** (B06): Gated, sea views, space and close to Marbella, got it. Let me see what we have in that range… Two stand out. The first is a six-bedroom villa in La Zagaleta at four point five million euros, on a 24-hour-security estate, with panoramic sea views, an infinity pool and a cinema. The second is a five-bedroom villa in El Madroñal at two point nine five million, with a guest house, mountain and sea views, on a very private hillside plot. That one isn't listed as gated, though.

**Caller:** The Zagaleta one's at the top of what we'd do. The El Madroñal one sounds nice too. What did the Sierra Blanca one go for, out of interest?

**AI** (B12): I'm afraid I can't share that, but the agent can talk you through what's selling in the area and at what level. Are you hoping to buy fairly soon?

**Caller:** In the next six months, I'd say.

**AI** (B06, B09): Would you like me to send you both listings so you can look at the photos? And I can have the agent call you to talk them through. The office opens again on Monday at half past nine.

**Caller:** Yes to both. Monday about ten is fine. WhatsApp is easiest.

**AI** (B15): Lovely. May I take your name, and is this the best number? Plus four four, seven seven zero zero, nine zero zero, four five six?

**Caller:** Robert Hughes. And yes, that's right.

**AI** (B18): Thank you, Robert. So, I'm sending you the La Zagaleta and El Madroñal villas on WhatsApp now, and the agent will call you on Monday at ten to talk them through and arrange viewings if you'd like. Anything else I can do?

**Caller:** No, that's grand. Thanks.

**AI** (B18): Thank you for calling, Robert. Enjoy your weekend.

## Branches to try

- **"Was there anything else in Sierra Blanca?":** searching by area returns no available listings. The AI says so, and puts "watch for Sierra Blanca" in the callback note (B06, nothing fits).
- **He wants to see them next weekend:** B08, with viewing requests for one or both villas. When there are two, use one viewing request per listing.
- **He asks whether El Madroñal could be made gated:** not in the feed. The agent will answer.

## Agent summary

1. Robert Hughes, British, called Sat 15:40 about sold villa CTH-1215 (Sierra Blanca).
2. Wants gated, sea views, space, near Marbella. Budget 3 to 4.5 million, within 6 months.
3. Sent CTH-1202 (La Zagaleta) and CTH-1209 (El Madroñal, not gated) by WhatsApp.
4. Asked what CTH-1215 sold for: not shared.
5. Next step: call him Mon Dec 14 at 10:00. Number +447700900456.
