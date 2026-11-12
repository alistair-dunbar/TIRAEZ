# Call scripts (Part B)

There are 15 test calls for the AI phone receptionist, all against the test agency Costa Test Homes. They are built from 18 reusable conversation blocks in [`blocks.md`](blocks.md). Each block is a part of a conversation with one job, such as answering about a listing, finding alternatives, or booking a callback. The scripts mix those blocks the way a real call would. Every call ends with something done, except the wrong number.

## The 15 calls

| # | Language | When (local) | Scenario | Ends with |
| --- | --- | --- | --- | --- |
| [01](01-de-buyer-villa-by-reference.md) | German | Tue 21:04, closed | Buyer asks about villa CTH-1234 by reference, and asks about the price | Viewing request, SMS |
| [02](02-sv-returning-buyer-wants-sea-views.md) | Swedish | Wed 20:40, closed | Returning buyer (emailed yesterday) wants sea views instead | 2 listings by WhatsApp, and a callback from a Swedish speaker |
| [03](03-nl-family-reserved-townhouse-mortgage.md) | Dutch | Thu 22:15, closed | Family's townhouse is reserved, an over-budget alternative, a mortgage question | Viewing request, WhatsApp |
| [04](04-fr-luxury-buyer-negotiation-email.md) | French | Sun 11:30, closed | 3 million euro villa, discretion, "would they take 2.6?", everything by email | High-priority callback, email |
| [05](05-es-buyer-asks-for-person-transfer.md) | Spanish | Thu 11:15, open | Buyer asks for a person | Warm transfer, answered |
| [06](06-en-wrong-reference-video-viewing.md) | English | Mon 23:20, closed | Wrong reference, found by her description | Video viewing request, WhatsApp |
| [07](07-en-sold-listing-alternatives.md) | English | Sat 15:40, closed | Listing has sold, asks what it went for | 2 alternatives by WhatsApp, and a callback |
| [08](08-en-noisy-line-plot-planning.md) | English | Fri 19:30, closed | Scottish accent, speaker phone in a car, building plot, planning questions | High-priority callback, SMS link |
| [09](09-en-seller-valuation-request.md) | English | Mon 14:30, lunch closure | Owner wants to sell, "what's it worth?" | Same-day high-priority callback |
| [10](10-de-couple-legal-tax-questions.md) | German and English | Wed 08:50, closed | NIE, taxes, buying through a company | High-priority callback with a lawyer introduction |
| [11](11-en-angry-caller-unanswered-emails.md) | English | Mon 17:10, open | Angry: three emails, no reply | Calmed, then a warm transfer |
| [12](12-fr-named-agent-no-answer.md) | French | Fri 12:30, open | Asks for James, who doesn't answer, wants to make an offer | Callback from James before 14:00 |
| [13](13-es-silence-then-dropped-call.md) | Spanish | Sat 22:05, closed | Silence, a faint voice, then the line drops | Agent alerted, callback at the next opening |
| [14](14-es-wrong-number.md) | Spanish | Tue 13:20, open | Looking for the dentist | Polite exit, log only |
| [15](15-no-sv-language-switch-cancelada.md) | Norwegian, then English, then Swedish | Thu 21:45, closed | Unsupported language, then switches mid-call | Viewing request, SMS in Norwegian |

## Test matrix coverage

| Matrix line (from the business plan) | Calls |
| --- | --- |
| One call per launch language, with a reference that exists | 01 (de), 02 (sv), 03 (nl), 04 (fr), 05 (es), 06 (en) |
| A reference that does not exist, and a sold listing | 06, 07 |
| A strong accent, background noise, a speaker phone | 08 |
| A seller asking for a valuation | 09 |
| A legal question, which must hand off | 10 (and 08, 03, 04 for planning, mortgage and negotiation) |
| An angry caller, who must be transferred | 11 |
| A transfer to an agent who doesn't answer | 12 |
| Silence, a hang-up mid-call, a wrong number | 13, 14 |
| A caller who switches language mid-call | 15 (and 10) |

## How to read a script

Each script has:

1. **Front matter** (between the `---` lines), with these fields:
    - the call time and whether the office is open;
    - the blocks used;
    - the functions the agent should call, in order, with their key arguments;
    - the expected `call_ended` outcome, and what must be done by the end;
    - the pass criteria, and what the agent must not do.
2. **The caller:** who they are, and how the tester should play them.
3. **The call:** the main path. **AI** lines are the intent, in English, and the AI says them in the caller's language and its own words. **Caller** lines are what the tester says, in the call's language, with an English gloss underneath.
4. **Branches to try:** variations that test the same blocks in other directions.
5. **Agent summary:** the 5 lines `notify_agent` should send.

## How to use them

- **Writing the prompt (B2):** `blocks.md` is the spec for the voice agent's behaviour. Each block's rules belong in the system prompt.
- **Testing (B2 to B4):** play each call on the demo line, with a native speaker for the non-English ones. Score it against `pass_criteria` and `must_not`, check the function calls in the mock's log, and note the delay. Then try at least one branch per call.
- **Platform bake-off (B4):** run all 15 on both voice platforms and compare.
- **Before each pilot (join 2):** run all 15 again on the pilot's real feed. Swap in that agency's listings, and keep the same blocks and behaviours.

## Keeping them correct

```bash
python3 fixtures/calls/check_calls.py
```

This checks every script against the contract and the test agency. It checks that listings exist, that office-open flags and callback times match the agency's real hours, that transfers only happen while the office is open, that functions, templates and enum values are in the contract, that every call ends with something done, and that every matrix line is covered. It runs in CI.
