---
id: call-02
title: Swedish buyer who emailed yesterday calls back and wants sea views
language: sv
caller_number: "+46701234567"
call_time_local: "2026-12-09T20:40"
office_open: false
matrix:
  - "launch language: sv, reference that exists"
  - "returning caller matched across channels"
listings: [CTH-1234, CTH-1214, CTH-1217]
blocks: [B01, B02, B03, B05, B06, B09, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {ref: CTH-1234}
  - find_listing: {price_min: 1000000, price_max: 1300000}
  - save_answers: {name: "Karin Ekström", intent: buyer, budget_eur_max: 1300000, add_listing_refs: [CTH-1214, CTH-1217]}
  - get_duty_agent: {}
  - book_callback: {reason: buyer_question, priority: normal, preferred_time: "2026-12-10T17:00", preferred_agent_id: lena, preferred_language: sv}
  - send_confirmation: {channel: whatsapp, template: listing_link, listing_ref: CTH-1214}
  - send_confirmation: {channel: whatsapp, template: listing_link, listing_ref: CTH-1217}
  - send_confirmation: {channel: whatsapp, template: callback_booked}
  - log_call: {}
  - notify_agent: {}
expected_outcome: callback_booked
end_action: "Two sea-view listings (CTH-1214, CTH-1217) sent by WhatsApp. A Swedish-speaking agent (Lena) calls back on Thu Dec 10 at 17:00."
pass_criteria:
  - "Recognises the caller from yesterday's email enquiry, mentioning the property but no personal details"
  - "Asks about budget before searching, and only offers listings that fit it"
  - "Only describes sea views where the listing's features say so"
  - "Says honestly that the distance to the beach isn't in the listing"
  - "Offers a 17:00 callback (inside office hours), not 14:00 to 16:30, when the office is closed"
  - "Asks text or WhatsApp before sending. The caller choosing WhatsApp counts as opt-in"
must_not:
  - "Read back her email address or budget before she brings them up"
  - "Claim either property is walking distance to the beach"
  - "Offer CTH-1207 without asking, because it is well over her budget"
---

# Call 02: Swedish returning buyer, wants sea views

## The caller

Karin Ekström, around 40, from Gothenburg. Last night she sent an enquiry about CTH-1234 through Idealista and got an AI reply by email. Friendly and chatty. She and her partner want sea views and to be close to a beach. She speaks Swedish throughout.

**Test setup:** the mock's `upsert` for +46701234567 returns `is_new: false`, with the history from contract example 10.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Hej! Jag skickade en förfrågan igår kväll om en villa.
> *Hi! I sent an enquiry last night about a villa.*

**AI** (B02, B03): *(now in Swedish)* Hello again! I can see you asked us about the villa in Nueva Andalucía on Idealista last night. Is that the one you're calling about?

**Caller:** Ja, precis. Vi har tittat på bilderna och den är fin, men vi skulle verkligen vilja ha havsutsikt. Har ni något liknande med havsutsikt?
> *Yes, exactly. We've looked at the photos and it's nice, but we'd really like sea views. Do you have anything similar with sea views?*

**AI** (B06): Of course, sea views make a big difference. Is your budget still around the same, about one point two million?

**Caller:** Upp till en komma tre ungefär. Och gärna nära en strand.
> *Up to about one point three. And close to a beach, ideally.*

**AI** (B06): Let me have a look… Two fit well. There's a four-bedroom villa in Cancelada at one point two five million, with a pool, a garden and distant sea views. And there's a three-bedroom apartment on the Golden Mile at one point one five million, in a gated complex with a spa and sea views. Does either sound like you?

**Caller:** Villan låter intressant. Hur långt är det till stranden?
> *The villa sounds interesting. How far is it to the beach?*

**AI** (B05): The listing doesn't give the distance to the beach, and I'd rather not guess. One of our agents, Lena, speaks Swedish and knows Cancelada well. Would you like her to call you?

**Caller:** Ja, det vore toppen! Hon pratar svenska?
> *Yes, that would be great! She speaks Swedish?*

**AI** (B09): She does. The office opens at half past nine tomorrow, Thursday. When would suit you?

**Caller:** Hellre på eftermiddagen, efter fem.
> *Preferably in the afternoon, after five.*

**AI** (B09): Five o'clock tomorrow, then. May I take your name?

**Caller:** Karin Ekström.

**AI** (B15): Thank you, Karin. Is this number the best one? Plus four six, seven zero, one two three, four five, six seven?

**Caller:** Ja.
> *Yes.*

**AI** (B18): So, Lena will call you tomorrow at five, in Swedish. In the meantime, shall I send you the links to both places so you can look at the photos? By text or by WhatsApp?

**Caller:** WhatsApp, tack.
> *WhatsApp, thanks.*

**AI** (B18): Sending them now, along with a note of the call. Is there anything else I can help with?

**Caller:** Nej, det var allt. Tack så mycket!
> *No, that's all. Thank you very much!*

**AI** (B18): Thank you, Karin. Have a lovely evening.

## Branches to try

- **She asks for "something cheaper, around 700,000":** B06 runs a new search. CTH-1201 (650,000, Golden Mile, sea views, walking distance to the beach) fits, and the AI says that one is walking distance, because the feed says so.
- **She says "Don't send anything, I'll just wait for the call":** the AI books the callback and sends nothing else.
- **She wants the callback at two o'clock:** the office is closed from 14:00 to 16:30. The AI offers 13:30 or 16:30 instead.

## Note

The callback uses `preferred_agent_id: lena` and `preferred_language: sv` (contract v1.1), so the request is a real field rather than a note.

## Agent summary

1. Karin Ekström, Swedish, emailed about CTH-1234 last night and called at 20:40.
2. Likes it, but wants sea views and to be near a beach. Budget up to 1.3 million.
3. Sent her CTH-1214 (Cancelada villa) and CTH-1217 (Golden Mile apartment) by WhatsApp.
4. Asked how far Cancelada is from the beach: not in the listing.
5. Next step: Lena to call her in Swedish on Thu Dec 10 at 17:00. Number +46701234567.
