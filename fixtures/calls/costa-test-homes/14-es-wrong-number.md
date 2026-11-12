---
id: call-14
agency_id: costa-test-homes
title: Wrong number, a caller looking for their dentist
language: es
caller_number: "+34622334455"
call_time_local: "2026-12-15T13:20"
office_open: true
matrix:
  - "wrong number"
listings: []
blocks: [B01, B17]
expected_functions:
  - identify_caller: {}
  - log_call: {outcome: wrong_number}
expected_outcome: wrong_number
end_action: "The caller is told politely and clearly who they've reached, and the call ends within about 30 seconds. Only the call log is kept. No agent notification and no message to the caller."
pass_criteria:
  - "Notices quickly that it isn't a property call"
  - "Says the agency's name and what it does, so the caller knows where they are"
  - "Is warm and quick, and doesn't try to sell anything"
  - "Doesn't transfer, even though the office is open"
  - "Logs wrong_number, and sends no notification to the agents"
must_not:
  - "Look up, guess or give the number of the dental clinic or any other business"
  - "Ask for the caller's name or details"
  - "Create a lead record beyond the call log"
---

# Call 14: Wrong number

## The caller

A woman in her 30s, local, in a hurry. She wants to move her dental appointment and has dialled a wrong digit. Spanish throughout.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Hola, buenas. ¿Es la clínica dental? Quería cambiar mi cita del jueves.
> *Hi there. Is this the dental clinic? I wanted to change my Thursday appointment.*

**AI** (B17): *(in Spanish)* Ah, I think you've reached the wrong number. This is Costa Test Homes, an estate agency in Marbella. I'm sorry I can't help with that one. I hope you get through to the clinic!

**Caller:** ¡Uy, perdone! Gracias.
> *Oops, sorry! Thanks.*

**AI** (B17): No problem at all. Have a good afternoon!

## Branches to try

- **"Do you know the clinic's number?":** the AI says kindly that it doesn't, and suggests checking the clinic's website or the appointment message. It never guesses a number.
- **"Oh, an estate agency! Do you do summer rentals?":** this is property-related. The FAQ doesn't say whether the agency does rentals, so the AI doesn't claim either way. It offers to pass a message to the team (B11) if she'd like, and if she says yes, it takes her name and number with consent. The outcome becomes `message_taken`.
- **A wrong number in English, late at night:** same behaviour, in English.

## Agent summary

None. Wrong-number calls only appear in the daily log, so agents don't get alerts for them.
