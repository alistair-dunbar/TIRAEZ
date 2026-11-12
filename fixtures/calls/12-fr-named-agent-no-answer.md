---
id: call-12
title: French buyer asks for a named agent who doesn't answer, and gets a callback before lunch
language: fr
caller_number: "+33698765432"
call_time_local: "2026-12-11T12:30"
office_open: true
matrix:
  - "transfer to an agent who does not answer"
  - "boundary topic: negotiation (wants to make an offer)"
listings: [CTH-1217]
blocks: [B01, B02, B10, B12, B09, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {ref: CTH-1217}
  - save_answers: {name: "Amélie Moreau", intent: buyer, add_listing_refs: [CTH-1217]}
  - transfer_call: {agent_id: james}
  - book_callback: {reason: handoff, priority: high, preferred_time: "2026-12-11T13:30"}
  - send_confirmation: {channel: sms, template: callback_booked}
  - log_call: {}
  - notify_agent: {agent_id: james}
expected_outcome: callback_booked
end_action: "James doesn't answer within 25 seconds. High-priority callback from James today at 13:30, before the office closes at 14:00. SMS confirmation in French."
pass_criteria:
  - "Transfers to the named agent (James), not just whoever is on duty"
  - "After 25 seconds with no answer, comes back to her straight away, apologises, and doesn't try a second hold"
  - "Offers a callback time inside office hours today (before 14:00)"
  - "Gives no view on offers or other buyers, and passes her intention to James"
  - "Logs transfer_attempted, but not transfer_answered"
  - "Sends the summary to James, not only to the on-duty agent"
must_not:
  - "Keep her on hold longer than about 25 seconds"
  - "Say whether other offers exist, or what figure might be accepted"
  - "Transfer her to a different agent without asking"
---

# Call 12: French buyer, named agent, no answer

## The caller

Amélie Moreau, 36, from Paris. She works in fashion and is buying a pied-à-terre. She viewed the Golden Mile apartment with James last week and wants to make an offer. Quick, decisive, and polite. French throughout.

**Test setup:** James's mobile rings but doesn't answer (the platform's no-answer test mode).

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Bonjour. J'ai visité l'appartement CTH-1217 avec James la semaine dernière. Je voudrais lui parler, s'il vous plaît.
> *Hello. I viewed apartment CTH-1217 with James last week. I'd like to speak to him, please.*

**AI** (B02, B10): *(now in French)* Hello! Of course. The Golden Mile apartment with the spa. I'll try James for you now. May I tell him your name?

**Caller:** Amélie Moreau.

**AI** (B10): Thank you, Ms Moreau. One moment, I'm calling him now.

*Whisper attempt to James:* "Amélie Moreau, French, viewed CTH-1217 with you last week and wants to talk about it." *(No answer for 25 seconds.)*

**AI** (B10, B09): I'm sorry, James isn't picking up. He may be with a client. Rather than keep you waiting, can I have him call you back? The office is open until two today.

**Caller:** D'accord. C'est assez urgent, je voudrais faire une offre. Est-ce qu'il y a déjà d'autres offres ?
> *All right. It's fairly urgent, I'd like to make an offer. Are there already other offers?*

**AI** (B12): I can't speak about offers, but I'll tell James that you want to make one, and mark it as urgent. He'll go through everything with you. Would half past one work?

**Caller:** Treize heures trente, parfait.
> *One thirty, perfect.*

**AI** (B15): Is this number the best one? Plus three three, six nine eight, seven six five, four three two?

**Caller:** Oui.
> *Yes.*

**AI** (B18): So, James will call you today at half past one about making an offer on the Golden Mile apartment. I'll text you a confirmation, in French. Anything else I can do?

**Caller:** Non, merci beaucoup.
> *No, thank you very much.*

**AI** (B18): Thank you, Ms Moreau. Have a good afternoon.

## Branches to try

- **"Can someone else help me now?":** the AI offers Ana, the on-duty agent (B10), and asks before transferring.
- **She calls at 13:55:** the office closes at 14:00, so a 13:30 callback isn't possible. The AI offers 16:30 today, when it reopens (B09).
- **James answers after 10 seconds:** it becomes a normal warm transfer (see call 05).

## Agent summary (to James)

1. Amélie Moreau, French, viewed CTH-1217 with you last week. Called at 12:30.
2. Wants to MAKE AN OFFER. Asked whether there are other offers (not answered).
3. Your phone wasn't answered at 12:30.
4. Callback booked for today at 13:30 (high priority).
5. Number +33698765432.
