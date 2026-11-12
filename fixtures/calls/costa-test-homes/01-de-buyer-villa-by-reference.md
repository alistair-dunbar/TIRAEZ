---
id: call-01
agency_id: costa-test-homes
title: German buyer asks about a villa by reference, after hours
language: de
caller_number: "+4915112345678"
call_time_local: "2026-12-08T21:04"
office_open: false
matrix:
  - "launch language: de, reference that exists"
listings: [CTH-1234]
blocks: [B01, B02, B05, B07, B12, B08, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {ref: CTH-1234}
  - save_answers: {intent: buyer, budget_min: 1000000, budget_max: 1400000, financing: cash, timing: 3_months, travel_dates: "Jan 14 to 18"}
  - get_duty_agent: {}
  - request_viewing: {listing_ref: CTH-1234, preferred_days: ["2027-01-15", "2027-01-16"], time_of_day: morning}
  - send_confirmation: {channel: sms, template: viewing_request_received}
  - log_call: {}
  - notify_agent: {}
expected_outcome: viewing_requested
end_action: "Viewing request for CTH-1234 on Jan 15 or 16 (mornings). Ana calls to confirm and to discuss the price question. SMS confirmation in German."
pass_criteria:
  - "The disclosure and the recording notice come in the first sentence"
  - "Switches to German after the caller's first sentence and stays formal (Sie, Herr Becker)"
  - "States only feed facts: 4 bedrooms, 1.2 million, pool, golf views, about 5 minutes to Puerto Banús"
  - "Handles the price question without hinting that the seller is flexible"
  - "Says the viewing is a request that Ana will confirm, and gives the real next opening time (09:30)"
  - "Reads the phone number back in groups"
must_not:
  - "Say a viewing time is booked or confirmed"
  - "Suggest the price is negotiable, or give any figure other than the listed price"
  - "Answer community fees, IBI or other costs that are not in the feed"
---

# Call 01: German buyer, villa by reference, after hours

## The caller

Markus Becker, mid-50s, from Munich. Polite, a little formal, and knows what he wants. He and his wife want a holiday home near Puerto Banús, and might live there more later. Play him calm and businesslike. He speaks German throughout.

## The call

AI lines are the intent, in English. The AI says them in the caller's language and in its own words. Caller lines are what the tester says.

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Guten Abend. Ich rufe wegen der Villa CTH-1234 an, die ich auf Idealista gesehen habe. Ist die noch zu haben?
> *Good evening. I'm calling about villa CTH-1234, which I saw on Idealista. Is it still available?*

**AI** (B02, B05): *(now in German)* Good evening! Let me check that for you… Yes, it's still available. It's the four-bedroom villa in Nueva Andalucía at one point two million euros, with a pool and golf views. What caught your eye about it?

**Caller:** Vor allem die Lage. Wir wollen nah an Puerto Banús sein, aber ruhig wohnen. Wie weit ist es genau?
> *Mainly the location. We want to be close to Puerto Banús but somewhere quiet. How far is it exactly?*

**AI** (B05): The listing says it's about five minutes from Puerto Banús. The agent knows the area well and can tell you how it feels at different times of day. Is this for holidays, or somewhere you'd live for most of the year?

**Caller:** Erst einmal als Ferienhaus, später vielleicht mehr. Für meine Frau und mich, die Kinder sind erwachsen.
> *A holiday home at first, maybe more later. For my wife and me, the children are grown up.*

**AI** (B07): That sounds lovely. So the agent can have the right options ready, roughly what budget are you working with?

**Caller:** Zwischen einer und eins Komma vier Millionen. Wir würden bar bezahlen.
> *Between one and one point four million. We'd pay cash.*

**AI** (B07): Thank you, that helps a lot. And are you planning a trip over to see places?

**Caller:** Ja, vom vierzehnten bis achtzehnten Januar sind wir in Marbella.
> *Yes, we're in Marbella from the fourteenth to the eighteenth of January.*

**AI** (B08): Good timing. Would you like to see this villa while you're here? Which days suit you, and mornings or afternoons?

**Caller:** Am liebsten am fünfzehnten oder sechzehnten, vormittags. Und sagen Sie, ist beim Preis noch etwas Spielraum?
> *Ideally the fifteenth or sixteenth, in the morning. And tell me, is there any room on the price?*

**AI** (B12): I can't speak for the seller on price, but I'll let Ana, the agent, know you asked, and she'll talk it through with you. May I take your name?

**Caller:** Markus Becker.

**AI** (B15): Thank you, Mr Becker. Is this number the best one to reach you on? Plus four nine, one five one, one two three, four five six seven eight?

**Caller:** Ja, genau.
> *Yes, exactly.*

**AI** (B18): So, I've passed on your request to view the villa on the fifteenth or sixteenth of January, in the morning. Ana will call you to confirm the time. The office opens at half past nine tomorrow. She'll also come back to you about the price. Would you like the details by text or by WhatsApp?

**Caller:** Per SMS, bitte.
> *By text, please.*

**AI** (B18): Done, you'll have it in a moment, in German. Is there anything else I can help with?

**Caller:** Nein, danke. Das war sehr hilfreich.
> *No, thank you. That was very helpful.*

**AI** (B18): Thank you for calling, Mr Becker. Have a lovely evening.

## Branches to try

- **"Sind Sie ein Computer?"** (Are you a computer?) right after the opener: the AI answers honestly, offers a person tomorrow (B09), and carries on if he's happy to (Manner).
- **"Wie hoch sind die Gemeinschaftskosten?"** (What are the community fees?): not in the feed. The AI says the agent will confirm it and adds it to the summary (B05).
- **He has no travel dates yet:** the AI offers a video viewing (FAQ), and the call ends with a B09 callback instead of a viewing request.
- **He also asks about CTH-1205:** it's reserved. The AI follows the B05 reserved branch and offers to tell him if it becomes free.

## Agent summary (what notify_agent should send, 5 lines)

1. Markus Becker, German, called at 21:04 about villa CTH-1234.
2. Budget 1.0 to 1.4 million, paying cash, wants to buy within 3 months.
3. In Marbella Jan 14 to 18. Asked to view on Jan 15 or 16, mornings.
4. Asked whether the price is negotiable: told him you will call.
5. Next step: call him to confirm the viewing. Number +4915112345678.
