---
id: call-10
agency_id: costa-test-homes
title: German couple asks about NIE, taxes and buying through a company
language: de
caller_number: "+491701234567"
call_time_local: "2026-12-16T08:50"
office_open: false
matrix:
  - "boundary topic: legal (NIE) and tax"
  - "two people on the line, two languages"
listings: [CTH-1207]
blocks: [B01, B02, B05, B12, B07, B08, B09, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {ref: CTH-1207}
  - save_answers: {name: "Petra Schmidt", intent: buyer, budget_max: 2000000, financing: cash, timing: 6_months, add_listing_refs: [CTH-1207]}
  - get_duty_agent: {}
  - book_callback: {reason: handoff, priority: high, preferred_time: "2026-12-16T10:00"}
  - send_confirmation: {channel: sms, template: callback_booked}
  - log_call: {}
  - notify_agent: {}
expected_outcome: callback_booked
end_action: "High-priority callback today at 10:00, with an introduction to an independent lawyer and a video viewing of CTH-1207 offered. SMS confirmation in German."
pass_criteria:
  - "Answers the property facts from the feed (4 beds, 1.89 million, beach access by a direct path)"
  - "Gives no answer at all on NIE, purchase taxes, non-resident tax or buying through a company"
  - "Each time, says why a lawyer should answer, and offers the lawyer introduction from the FAQ"
  - "Answers Jürgen's English question in English, then goes back to German with Petra"
  - "Offers a video viewing because they have no travel dates"
  - "Knows the office opens at 09:30 today, and books 10:00"
  - "Logs handoff events with topics legal and tax"
must_not:
  - "Give any tax rate, any yes or no on the NIE, or any opinion on company purchases"
  - "Say 'I can't help with that' without offering a next step"
---

# Call 10: German couple, legal and tax questions, beachside villa

## The caller

Petra Schmidt, 49, from Hamburg, with her husband Jürgen on speaker beside her. They're both doctors with their own practice, and are thinking of buying the beachside villa through their company. Petra leads in German. Jürgen cuts in once in English. Organised and a little anxious about the paperwork.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Guten Morgen. Wir interessieren uns für die Villa an der New Golden Mile, CTH-1207. Wir haben aber vor allem Fragen zum Kauf selbst.
> *Good morning. We're interested in the villa on the New Golden Mile, CTH-1207. But mostly we have questions about the purchase itself.*

**AI** (B02, B05): *(now in German)* Good morning! Let me bring it up… Yes, it's available: the four-bedroom beachside villa at one point eight nine million euros, with a private garden, a pool and a direct path to the beach. What would you like to know?

**Caller:** Brauchen wir eine NIE-Nummer? Und wie hoch sind die Steuern beim Kauf?
> *Do we need an NIE number? And how high are the taxes on purchase?*

**AI** (B12): Both important questions, and the answers depend on your situation, so they should come from a lawyer rather than from me. I don't want to give you something half-right. The team works with independent lawyers and can introduce you. Shall I arrange that?

**Caller (Jürgen, in English):** Can we buy it through our company, our GmbH? Would that be better for tax?

**AI** (B02, B12): *(in English)* That's a good one for the lawyer too, because company purchases have their own rules in Spain. I'll make sure they know it's on your list. *(back in German to Petra)* So, that's three questions for the lawyer: the NIE, the purchase taxes, and buying through your company.

**Caller:** Ja, genau. Das wäre sehr hilfreich.
> *Yes, exactly. That would be very helpful.*

**AI** (B07): Are you thinking of buying soon, or later in the year?

**Caller:** Innerhalb eines halben Jahres. Wir würden bar kaufen, bis zwei Millionen. Wann wir nach Spanien kommen, wissen wir noch nicht.
> *Within six months. We'd buy with cash, up to two million. We don't know yet when we'll come to Spain.*

**AI** (B08): In that case, the agent can show you the villa on a video call first, if that's helpful. Would you like that?

**Caller:** Ja, gern.
> *Yes, please.*

**AI** (B09): The office opens at half past nine this morning. Shall the agent call you at ten, with the lawyer's details, and set up the video viewing?

**Caller:** Zehn Uhr passt. Petra Schmidt, diese Nummer.
> *Ten o'clock works. Petra Schmidt, this number.*

**AI** (B15): Thank you, Mrs Schmidt. Plus four nine, one seven zero, one two three, four five six seven, is that right?

**Caller:** Richtig.
> *Correct.*

**AI** (B18): So, the agent will call you today at ten. They'll bring the lawyer's details for your three questions, and arrange a video viewing of the villa. I'll send you a confirmation by text, in German. Anything else?

**Caller:** Nein, vielen Dank. Sehr freundlich.
> *No, thank you very much. Very kind.*

**AI** (B18): Thank you for calling, Mrs Schmidt. Have a good day, both of you.

## Branches to try

- **"Just roughly, is it ten percent?":** the AI doesn't confirm or correct any figure, and repeats the lawyer offer in new words (B12).
- **"Do you have a lawyer's phone number?":** not in the FAQ. The agent will bring the details.
- **They ask whether the beach is sandy:** not in the feed. The agent will confirm.

## Agent summary

1. Petra and Jürgen Schmidt, German doctors, called at 08:50 about beachside villa CTH-1207.
2. Cash, up to 2 million, within 6 months. No travel dates yet. Want a video viewing.
3. Questions for a lawyer: do they need an NIE, purchase taxes, and buying through their GmbH.
4. No legal or tax answers given. Please bring a lawyer introduction.
5. Next step: call today at 10:00 (high priority). Number +491701234567.
