---
id: call-13
agency_id: costa-test-homes
title: Silent start, faint caller, and the line drops mid-call
language: es
caller_number: "+34655112233"
call_time_local: "2026-12-12T22:05"
office_open: false
matrix:
  - "silence"
  - "hang-up mid-call"
listings: [CTH-1206]
blocks: [B01, B16, B15, B05, B16]
expected_functions:
  - identify_caller: {}
  - find_listing: {town: Estepona, type: apartment, price_max: 350000}
  - log_call: {outcome: hung_up}
  - notify_agent: {}
  - book_callback: {reason: buyer_question, priority: normal, preferred_time: null}
expected_outcome: hung_up
end_action: "The call drops. Afterwards the system logs hung_up, sends the agent what was said, and books a normal callback for Mon Dec 14 at 09:30, the next opening. No message is sent to the caller."
pass_criteria:
  - "After 8 seconds of silence, prompts gently once"
  - "Doesn't fill the silence with more than one prompt before 20 seconds"
  - "With a faint voice, asks about the specific part it missed"
  - "Once the call drops, the post-call webhook still runs log_call, notify_agent and book_callback"
  - "The callback note says the call dropped, and what was asked (apartments in Estepona, about 300,000)"
  - "Variant with no speech at all: ends after 20 seconds and logs hung_up. The agent gets a missed-call note, with no callback"
must_not:
  - "Send the caller an SMS or WhatsApp. There was no agreed channel or consent"
  - "Book a callback in the no-speech variant"
---

# Call 13: Silence, a faint voice, then the line drops

## The caller

Unknown, on a Spanish mobile. A man on a bad connection, possibly outside. He is silent for the first 8 seconds, then speaks faintly in Spanish. The line drops while the AI is answering.

**Test setup:**

- Stay silent for 9 seconds after the opener.
- Speak quietly, away from the microphone.
- Hang up while the AI is mid-sentence, after it starts describing the apartment.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

*(9 seconds of silence)*

**AI** (B16): ¿Hola? ¿Sigue ahí? Le escucho cuando quiera.
> *Hello, are you still there? I'm here whenever you're ready.*

**Caller:** *(faint)* ¿Hola? Perdone, se oye fatal… Llamaba por los apartamentos en Estepona… algo por unos trescientos mil…
> *Hello? Sorry, it's a terrible line… I was calling about the apartments in Estepona… something around three hundred thousand…*

**AI** (B15, B05): *(in Spanish)* No problem. I caught apartments in Estepona, around three hundred thousand. Let me look… There's a two-bedroom apartment near the old town and the promenade at three hundred and fifty thousand, with sea views fr—

*(The line drops.)*

## What happens after the call (B16)

1. `log_call` with outcome `hung_up`, the transcript so far, and a language of `es`.
2. `notify_agent` with a 5-line summary marked as a dropped call.
3. `book_callback` with a `normal` priority, `preferred_time: null` (so the next opening, Mon Dec 14 at 09:30), and a note: "Call dropped. Asked about apartments in Estepona around 300,000. Possible match CTH-1206."
4. No message to the caller: they didn't choose a channel or agree to one.

## The silence-only variant

The tester says nothing at all.

1. At 8 seconds, the AI prompts once (B16).
2. At 20 seconds: "No le oigo, así que voy a colgar. Llámenos cuando quiera." (*I can't hear you, so I'll hang up. Call us any time.*) Then it ends the call.
3. After the call: `log_call` with outcome `hung_up`, and `notify_agent` with "Missed call from +34655112233, nothing said." No callback.

## Branches to try

- **The caller calls straight back:** `identify_caller` returns `is_new: false`, with this dropped call in the history. The AI says: "I think we were cut off a moment ago. You were asking about apartments in Estepona?" (B03)
- **The caller says only "¿Hola?" and drops:** nothing useful was said, so treat it like the silence-only variant.

## Agent summary

1. Missed or dropped call from +34655112233, Sat 22:05, in Spanish.
2. Asked about apartments in Estepona, around 300,000, then the line dropped.
3. Possible match: CTH-1206 (2-bed, Estepona centre, 350,000).
4. No name, and no message sent to him.
5. Next step: callback booked for Mon Dec 14 at 09:30.
