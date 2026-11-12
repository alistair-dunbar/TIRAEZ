---
id: call-15
agency_id: costa-test-homes
title: Norwegian caller starts in an unsupported language and switches to English, then Swedish
language: sv
start_language: "no"
caller_number: "+4741234567"
call_time_local: "2026-12-17T21:45"
office_open: false
matrix:
  - "language switch mid-call"
  - "unsupported voice language (Norwegian)"
listings: [CTH-1214]
blocks: [B01, B02, B05, B07, B08, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {area: Cancelada, type: villa}
  - save_answers: {name: "Ingrid Solberg", language: "no", intent: buyer, budget_max: 1300000, financing: cash, timing: 6_months, travel_dates: "Feb 1 to 7", add_listing_refs: [CTH-1214]}
  - get_duty_agent: {}
  - request_viewing: {listing_ref: CTH-1214, preferred_days: ["2027-02-02", "2027-02-03"], time_of_day: afternoon, preferred_agent_id: lena, preferred_language: sv}
  - send_confirmation: {channel: sms, template: viewing_request_received, language: "no"}
  - log_call: {}
  - notify_agent: {}
expected_outcome: viewing_requested
end_action: "Viewing request for CTH-1214 on Feb 2 or 3 (afternoons), with a note that she prefers Swedish (Lena). The SMS confirmation is in Norwegian, which is supported for text."
pass_criteria:
  - "Says kindly that it can't speak Norwegian on the phone, and offers English or Swedish (B02)"
  - "Switches to English at once when she chooses it"
  - "Follows her into Swedish mid-call without commenting on it"
  - "Doesn't claim the pool is heated (not in the feed)"
  - "Asks how she'd like the confirmation, and sends the SMS in Norwegian, since text supports it"
  - "The viewing request carries preferred_agent_id lena and preferred_language sv"
must_not:
  - "Try to speak Norwegian"
  - "Make her feel her language is a problem"
---

# Call 15: Norwegian caller switches languages, villa in Cancelada

## The caller

Ingrid Solberg, 66, a retired teacher from Bergen. She wants to spend the winters (November to March) in the sun. She's selling her flat in Oslo and will buy with cash. She starts in Norwegian, accepts English, then drifts into Swedish when describing what she wants, because it comes easier to her than English. Gentle and thoughtful.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Hei! Jeg ringer angående villaen i Cancelada. Jeg så den på nettet.
> *(Norwegian) Hi! I'm calling about the villa in Cancelada. I saw it online.*

**AI** (B02): *(in English, then in Swedish)* Hello! I'm sorry, I can't speak Norwegian on the phone yet. I can carry on in English or in Swedish, whichever you prefer.

**Caller:** English is fine.

**AI** (B05): Lovely. Let me find it… Yes, there's a four-bedroom villa in Cancelada at one point two five million euros, with a pool, a mature garden and distant sea views. Is that the one?

**Caller:** Yes, that's it. Is the pool… hmm… *(switches)* är poolen uppvärmd? Vi vill bo där på vintern.
> *(now in Swedish) …is the pool heated? We want to live there in the winter.*

**AI** (B02, B05): *(now in Swedish)* A good question for winter living. The listing doesn't say whether the pool is heated, so I'll have the agent confirm it. Would you be there for the whole winter?

**Caller:** Från november till mars, ungefär. Jag säljer min lägenhet i Oslo och betalar kontant, upp till en komma tre miljoner.
> *From November to March, roughly. I'm selling my flat in Oslo and will pay cash, up to one point three million.*

**AI** (B07): That sounds wonderful. When are you hoping to buy?

**Caller:** Inom ett halvår. Jag kommer till Spanien den första till den sjunde februari.
> *Within six months. I'm coming to Spain from the first to the seventh of February.*

**AI** (B08): Would you like to see the villa during that trip? Which days, and mornings or afternoons?

**Caller:** Andra eller tredje, på eftermiddagen.
> *The second or third, in the afternoon.*

**AI** (B08): The second or third of February, afternoon. One of our agents, Lena, speaks Swedish, and I'll ask for her. May I take your name?

**Caller:** Ingrid Solberg.

**AI** (B15): Thank you, Ingrid. Is this number best? Plus four seven, four one two, three four, five six seven?

**Caller:** Ja.
> *Yes.*

**AI** (B18): So, I've passed on your request to view the Cancelada villa on the second or third of February, in the afternoon. The agent will call you to confirm, and will check whether the pool is heated. I can text you the details. Would you like them in Norwegian?

**Caller:** Å, ja takk! På norsk.
> *(Norwegian) Oh, yes please! In Norwegian.*

**AI** (B18): Sending it now. Anything else I can help with?

**Caller:** Nei, tusen takk.
> *(Norwegian) No, thank you very much.*

**AI** (B18): Thank you, Ingrid. Have a lovely evening.

## Branches to try

- **She chooses Swedish straight away:** the whole call runs in Swedish, and the SMS is still offered in Norwegian.
- **She keeps speaking Norwegian:** the AI answers in Swedish, which most Norwegians follow easily. If she clearly isn't following, it offers a Swedish-speaking agent's callback (B09).
- **She asks about winter rentals while she waits to buy:** the FAQ doesn't cover rentals, so it goes in the note for the agent (B11).

## Agent summary

1. Ingrid Solberg, Norwegian (prefers Swedish), called at 21:45 about villa CTH-1214 (Cancelada).
2. Wants to winter in Spain (Nov to Mar). Cash, up to 1.3 million, selling a flat in Oslo, within 6 months.
3. In Spain Feb 1 to 7. Requested a viewing on Feb 2 or 3, afternoon.
4. Asked whether the pool is heated: not in the listing. Please send Lena (Swedish).
5. Next step: call to confirm the viewing. Number +4741234567.
