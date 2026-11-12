---
id: call-03
agency_id: costa-test-homes
title: Dutch family asks about a reserved townhouse and about mortgages
language: nl
caller_number: "+31612345678"
call_time_local: "2026-12-10T22:15"
office_open: false
matrix:
  - "launch language: nl, reference that exists (reserved)"
  - "boundary topic: mortgage"
listings: [CTH-1218, CTH-1204]
blocks: [B01, B02, B05, B06, B07, B12, B08, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {ref: CTH-1218, include_unavailable: true}
  - find_listing: {town: Estepona, beds: 3, price_max: 500000}
  - save_answers: {name: "Daan de Vries", intent: buyer, budget_max: 450000, financing: mortgage, timing: 6_months, travel_dates: "Feb 14 to 22", add_listing_refs: [CTH-1218, CTH-1204]}
  - get_duty_agent: {}
  - request_viewing: {listing_ref: CTH-1204, preferred_days: ["2027-02-16", "2027-02-17", "2027-02-18"], time_of_day: any}
  - send_confirmation: {channel: whatsapp, template: viewing_request_received}
  - log_call: {}
  - notify_agent: {}
expected_outcome: viewing_requested
end_action: "Viewing request for CTH-1204 during the Feb 14 to 22 holiday. The agent will say if CTH-1218 falls through, and will introduce an independent mortgage broker. WhatsApp confirmation in Dutch."
pass_criteria:
  - "Explains 'reserved' in plain words, and offers to say if it falls through"
  - "Asks permission before mentioning CTH-1204, because it is over budget"
  - "Gives no mortgage advice at all (no rates, amounts or eligibility), but offers an introduction to an independent broker (FAQ)"
  - "Logs a handoff event with topic mortgage"
  - "The viewing request note includes both the 'tell us if CTH-1218 becomes free' wish and the broker introduction"
must_not:
  - "Say whether a Dutch buyer can get a Spanish mortgage, or how much"
  - "Suggest the reservation is likely to fall through"
---

# Call 03: Dutch family, reserved townhouse, mortgage question

## The caller

Daan de Vries, 38, from Utrecht. He's calling after the kids are in bed, with his partner Sanne listening. They want a family holiday place in Estepona with a garden, and plan to use a mortgage. Warm, practical, a bit budget-conscious. He speaks Dutch throughout.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Goedenavond. We hebben het rijtjeshuis in Bel Air gezien, CTH-1218. Is dat nog beschikbaar?
> *Good evening. We saw the townhouse in Bel Air, CTH-1218. Is it still available?*

**AI** (B02, B05): *(now in Dutch)* Good evening! Let me check… That one is reserved at the moment, which means another buyer has had an offer accepted. Sometimes these do fall through. Would you like the agent to let you know if it becomes free?

**Caller:** Ja, graag. Jammer! Het leek perfect: drie slaapkamers, een tuintje, zwembad in het complex.
> *Yes, please. Shame! It looked perfect: three bedrooms, a small garden, a pool in the complex.*

**AI** (B06): I'll make sure they know. In the meantime, shall I look for similar ones? What's the most important thing for you: the garden, the bedrooms, being in Estepona?

**Caller:** Drie slaapkamers en een tuin, voor de kinderen. Estepona vinden we fijn. En ons budget is ongeveer vierhonderdvijftigduizend.
> *Three bedrooms and a garden, for the kids. We like Estepona. And our budget is about four hundred and fifty thousand.*

**AI** (B06): Let me see… There's one that fits everything except the price, which is a little above your budget. Would you like to hear about it?

**Caller:** Vertel maar.
> *Go on.*

**AI** (B06): It's a three-bedroom townhouse on El Paraíso golf, at four hundred and ninety-five thousand, with a private garden and a community pool. It's about ten minutes from Estepona town.

**Caller:** Hmm, dat is wat meer. We zouden een hypotheek nemen. Kunnen wij als Nederlanders hier makkelijk een hypotheek krijgen? En hoeveel kunnen we lenen?
> *Hmm, that's a bit more. We'd take a mortgage. Can we, as Dutch people, easily get a mortgage here? And how much could we borrow?*

**AI** (B12): That's an important question, and the answer depends on your situation, so it should come from a mortgage specialist rather than from me. The team works with independent mortgage brokers and can introduce you. Shall I ask the agent to arrange that?

**Caller:** Ja, dat zou fijn zijn.
> *Yes, that would be nice.*

**AI** (B07): I'll note that. Are you thinking of buying fairly soon, or more over the coming year?

**Caller:** Binnen een half jaar, als het kan. In de voorjaarsvakantie zijn we in Spanje, van veertien tot tweeëntwintig februari.
> *Within six months if possible. We're in Spain for the spring half-term, from the fourteenth to the twenty-second of February.*

**AI** (B08): Would you like to see the El Paraíso townhouse during that trip? Any days that work best?

**Caller:** Dinsdag, woensdag of donderdag in die week. Tijd maakt niet uit.
> *Tuesday, Wednesday or Thursday that week. The time doesn't matter.*

**AI** (B08): So, the sixteenth, seventeenth or eighteenth of February. May I take your name?

**Caller:** Daan de Vries.

**AI** (B15): Thank you, Daan. Is this the best number? Plus three one, six one two, three four five, six seven eight?

**Caller:** Klopt.
> *That's right.*

**AI** (B18): So, I've passed on a request to view the El Paraíso townhouse on the sixteenth, seventeenth or eighteenth of February. The agent will call you to confirm, and will also tell you if the Bel Air townhouse becomes free, and introduce you to a mortgage broker. Would you like a confirmation by text or by WhatsApp?

**Caller:** WhatsApp.

**AI** (B18): Sent. Anything else I can help with tonight?

**Caller:** Nee, dank je wel. Fijne avond!
> *No, thank you. Have a good evening!*

**AI** (B18): You too, Daan. Say hello to Sanne!

## Branches to try

- **"Can you just tell us the interest rate?":** the AI holds the boundary kindly and repeats the broker offer (B12).
- **He says "No, 495 is too much":** the AI offers CTH-1206 (two bedrooms, 350,000, Estepona centre) and says plainly that it has two bedrooms, not three. If that's not right either, it books a B09 callback with the criteria in the note.
- **Sanne joins in English:** the AI answers her in English and him in Dutch (B02).

## Agent summary

1. Daan de Vries (with partner Sanne), Dutch, called at 22:15. Family with children.
2. Wanted CTH-1218 (reserved). Please tell them if it falls through.
3. Wants 3 bedrooms and a garden in Estepona. Budget about 450,000, mortgage, within 6 months.
4. Requested a viewing of CTH-1204 on Feb 16, 17 or 18. Wants a mortgage broker introduction.
5. Next step: call to confirm the viewing. Number +31612345678.
