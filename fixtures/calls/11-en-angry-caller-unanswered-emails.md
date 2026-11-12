---
id: call-11
title: Angry caller whose emails went unanswered is calmed and put through
language: en
caller_number: "+447700900321"
call_time_local: "2026-12-14T17:10"
office_open: true
matrix:
  - "angry caller, must transfer"
  - "warm transfer, answered"
listings: [CTH-1217]
blocks: [B01, B14, B05, B10, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {area: "Golden Mile", type: apartment}
  - save_answers: {name: "Gary Whitmore", intent: buyer, add_listing_refs: [CTH-1217]}
  - get_duty_agent: {}
  - transfer_call: {agent_id: ana}
  - log_call: {}
  - notify_agent: {}
expected_outcome: transferred
end_action: "Warm transfer to Ana, with a whisper warning her that the caller is upset and why. A complaint handoff is logged."
pass_criteria:
  - "Lets him finish his first outburst without interrupting"
  - "Apologises for his experience without blaming anyone, and without explaining or defending"
  - "Offers a person in its first or second reply"
  - "Identifies the listing (the one with the spa) quickly, and confirms it in one line"
  - "The whisper prepares Ana for the complaint"
  - "Logs a handoff event with topic complaint"
must_not:
  - "Say 'we have no record of your emails' or anything that sounds like doubting him"
  - "Ask qualifying questions before getting him to a person"
  - "Mention that it is busy, or that emails take time"
---

# Call 11: Angry caller, unanswered emails, put through to a person

## The caller

Gary Whitmore, 50, from Leeds. He says he has emailed three times in a week about a Golden Mile apartment and heard nothing. He's annoyed and sharp at first, and calms down when he's taken seriously. English throughout.

**Test setup:** his phone number isn't on file (`is_new: true`). The emails came from an address the AI can't match.

## The call

**AI** (B01): Hola, you've reached Costa Test Homes. I'm the agency's AI assistant, and this call is recorded. How can I help you today?

**Caller:** Yeah, finally. I've emailed you lot three times this week about an apartment on the Golden Mile and not one reply. Not one. Is anyone actually working there or is it all robots now?

**AI** (B14): That's really frustrating, and I'm sorry you've been left waiting. Let's sort it out now. There are people in the office right now. Would you like me to put you straight through to one of them?

**Caller:** Yes. That's what I want.

**AI** (B14, B05): Of course. So they're ready for you, which apartment was it? Do you remember anything about it?

**Caller:** The one with the spa. Golden Mile. About a million.

**AI** (B05): That's the three-bedroom apartment in a gated complex with a spa, at one point one five million. May I tell them your name?

**Caller:** Gary Whitmore.

**AI** (B10): Thank you, Gary. I'm putting you through to Ana now, and I'll tell her about the emails and the apartment, so you won't need to go through it again. One moment.

*Whisper to Ana:* "Gary Whitmore, upset: he says he emailed three times this week about CTH-1217, the Golden Mile apartment with the spa, and got no reply. Please apologise first."

*Ana answers. The AI connects the call and leaves.*

## Branches to try

- **The same call at 21:30 (office closed):** no transfer. B14 then B09: "The office opens at half past nine tomorrow. I'll make sure you're the first call Ana makes. Would nine-thirty work?" Priority high, with the complaint in the note. Then the SMS confirmation.
- **He swears at the AI:** it stays calm and keeps helping, with no lecture (B14).
- **Ana doesn't answer:** see call 12. The AI apologises again, then books a high-priority callback within the hour.

## Agent summary (after transfer)

1. Gary Whitmore, British, called at 17:10. UPSET: says he emailed 3 times this week with no reply.
2. About CTH-1217, the Golden Mile apartment with the spa, 1.15 million.
3. Transferred to Ana live at 17:11, warned in advance.
4. Please check the inbox for his emails, and why they weren't answered.
5. Number +447700900321.
