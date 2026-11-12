# Call scripts (Part B)

There are 23 test calls for the AI phone receptionist, one folder per test agency. They are built from 20 reusable conversation blocks in [`blocks.md`](blocks.md). Each block is a part of a conversation with one job, such as answering about a listing, finding alternatives, explaining an off-plan payment plan, or booking a callback. The scripts mix those blocks the way a real call would. Every call ends with something done, except the wrong number.

| Folder | Market | Scripts | Languages |
| --- | --- | --- | --- |
| [`costa-test-homes/`](costa-test-homes/) | Spain | 15 | German, Swedish, Dutch, French, Spanish, English, Norwegian (unsupported, switches) |
| [`dubai-test-realty/`](dubai-test-realty/) | UAE | 5 | Arabic, English, Russian, Hindi (mixed with English), Mandarin |
| [`riyadh-test-estates/`](riyadh-test-estates/) | Saudi Arabia | 3 | Arabic, Urdu |

The test agencies themselves (settings and listings) are in `fixtures/agencies/`.

## Spain: Costa Test Homes

| # | Language | When (local) | Scenario | Ends with |
| --- | --- | --- | --- | --- |
| [01](costa-test-homes/01-de-buyer-villa-by-reference.md) | German | Tue 21:04, closed | Buyer asks about villa CTH-1234 by reference, and asks about the price | Viewing request, SMS |
| [02](costa-test-homes/02-sv-returning-buyer-wants-sea-views.md) | Swedish | Wed 20:40, closed | Returning buyer (emailed yesterday) wants sea views instead | 2 listings by WhatsApp, callback from Lena in Swedish |
| [03](costa-test-homes/03-nl-family-reserved-townhouse-mortgage.md) | Dutch | Thu 22:15, closed | Townhouse reserved, an over-budget alternative, a mortgage question | Viewing request, WhatsApp |
| [04](costa-test-homes/04-fr-luxury-buyer-negotiation-email.md) | French | Sun 11:30, closed | 3 million euro villa, discretion, "would they take 2.6?", everything by email | High-priority callback, email |
| [05](costa-test-homes/05-es-buyer-asks-for-person-transfer.md) | Spanish | Thu 11:15, open | Buyer asks for a person | Warm transfer, answered |
| [06](costa-test-homes/06-en-wrong-reference-video-viewing.md) | English | Mon 23:20, closed | Wrong reference, found by her description | Video viewing request, WhatsApp |
| [07](costa-test-homes/07-en-sold-listing-alternatives.md) | English | Sat 15:40, closed | Listing has sold, asks what it went for | 2 alternatives by WhatsApp, callback |
| [08](costa-test-homes/08-en-noisy-line-plot-planning.md) | English | Fri 19:30, closed | Scottish accent, speaker phone in a car, building plot, planning questions | High-priority callback, SMS link |
| [09](costa-test-homes/09-en-seller-valuation-request.md) | English | Mon 14:30, lunch closure | Owner wants to sell, "what's it worth?" | Same-day high-priority callback |
| [10](costa-test-homes/10-de-couple-legal-tax-questions.md) | German and English | Wed 08:50, closed | NIE, taxes, buying through a company | High-priority callback with a lawyer introduction |
| [11](costa-test-homes/11-en-angry-caller-unanswered-emails.md) | English | Mon 17:10, open | Angry: three emails, no reply | Calmed, then a warm transfer |
| [12](costa-test-homes/12-fr-named-agent-no-answer.md) | French | Fri 12:30, open | Asks for James, who doesn't answer, wants to make an offer | Callback from James before 14:00 |
| [13](costa-test-homes/13-es-silence-then-dropped-call.md) | Spanish | Sat 22:05, closed | Silence, a faint voice, then the line drops | Agent alerted, callback at the next opening |
| [14](costa-test-homes/14-es-wrong-number.md) | Spanish | Tue 13:20, open | Looking for the dentist | Polite exit, log only |
| [15](costa-test-homes/15-no-sv-language-switch-cancelada.md) | Norwegian, then English, then Swedish | Thu 21:45, closed | Unsupported language, then switches mid-call | Viewing request, SMS in Norwegian |

## Gulf: Dubai Test Realty and Riyadh Test Estates

| # | Language | When (local) | Scenario | Ends with |
| --- | --- | --- | --- | --- |
| [Dubai 01](dubai-test-realty/01-ar-family-villa-arabian-ranches.md) | Gulf Arabic | Mon 21:30, closed | Emirati family villa in Arabian Ranches. Sizes in sq ft, no private pool | Viewing request with Omar, WhatsApp in Arabic |
| [Dubai 02](dubai-test-realty/02-en-off-plan-golden-visa.md) | English | Mon 20:15, closed | Off-plan in Dubai Harbour: handover, 80/20 plan, "would this get me a Golden Visa?" | High-priority callback, show-unit video tour |
| [Dubai 03](dubai-test-realty/03-ru-investor-yield-dollars-telegram.md) | Russian | Sun 12:00, closed | Investor: rental yield, budget in dollars, wants Telegram | 2 listings by WhatsApp, callback from Anna in Russian |
| [Dubai 04](dubai-test-realty/04-hi-family-code-switching-jvc.md) | Hindi and English mixed | Wed 20:30, closed | Family two-bed in JVC, sq ft, schools, pre-approved mortgage | Viewing request with Priya, SMS |
| [Dubai 05](dubai-test-realty/05-zh-investor-wechat-transfer.md) | Mandarin | Thu 11:00, open | Burj Khalifa views, price per sq ft, off-plan plan, wants WeChat | Listings by email, warm transfer to Wei |
| [Riyadh 01](riyadh-test-estates/01-ar-family-villa-friday.md) | Najdi Arabic | Fri 13:20, closed | Family villa with a majlis. Reserved, then an alternative. Home finance | Evening viewing request, WhatsApp in Arabic |
| [Riyadh 02](riyadh-test-estates/02-ar-seller-valuation-hittin.md) | Arabic | Sun 10:15, open | Owner selling a villa in Hittin, asks its value, asks for a woman agent | High-priority evening callback from Sara |
| [Riyadh 03](riyadh-test-estates/03-ur-family-apartment-off-plan.md) | Urdu | Tue 22:00, closed | Ready versus off-plan apartment, finance as a non-Saudi | Evening viewing request with Imran, SMS in Urdu |

Behaviour that is the same in every market (silence, dropped calls, wrong numbers, angry callers, noisy lines, a named agent not answering) is tested in the Spain set. Run those again in Arabic and English before the first Gulf pilot.

## Test matrix coverage

| Market | Matrix line | Calls |
| --- | --- | --- |
| Spain | One call per launch language, with a reference that exists | 01 (de), 02 (sv), 03 (nl), 04 (fr), 05 (es), 06 (en) |
| Spain | A reference that does not exist, and a sold listing | 06, 07 |
| Spain | A strong accent, background noise, a speaker phone | 08 |
| Spain | A seller asking for a valuation | 09 |
| Spain | A legal question, which must hand off | 10 (and 08, 03, 04 for planning, mortgage and negotiation) |
| Spain | An angry caller, who must be transferred | 11 |
| Spain | A transfer to an agent who doesn't answer | 12 |
| Spain | Silence, a hang-up mid-call, a wrong number | 13, 14 |
| Spain | A caller who switches language mid-call | 15 (and 10) |
| Gulf | One call per launch language | Dubai 01 (ar), 02 (en), 03 (ru), 04 (hi), 05 (zh). Riyadh 01 (ar), 03 (ur) |
| Gulf | An off-plan listing (handover and payment plan) | Dubai 02, 03, 05. Riyadh 03 |
| Gulf | Visa and residency, and investment returns, must hand off | Dubai 02, 03 |
| Gulf | A weekend call (Sunday in Dubai, Friday in Riyadh) | Dubai 03, Riyadh 01 |
| Gulf | A seller asking for a valuation | Riyadh 02 |
| Gulf | A budget in another currency, and sizes in square feet | Dubai 03, Dubai 01, Dubai 04 |
| Gulf | Code-switching mid-call | Dubai 04 |
| Gulf | A channel the agency doesn't offer (Telegram, WeChat) | Dubai 03, 05 |
| Gulf | A warm transfer, answered | Dubai 05 |

## How to read a script

Each script has:

1. **Front matter** (between the `---` lines), with these fields:
    - the agency and the call time, and whether the office is open;
    - the blocks used;
    - the functions the agent should call, in order, with their key arguments;
    - the expected `call_ended` outcome, and what must be done by the end;
    - the pass criteria, and what the agent must not do.
2. **The caller:** who they are, and how the tester should play them.
3. **The call:** the main path. **AI** lines are the intent, in English, and the AI says them in the caller's language and its own words. **Caller** lines are what the tester says, in the call's language, with an English gloss underneath.
4. **Branches to try:** variations that test the same blocks in other directions.
5. **Agent summary:** the 5 lines `notify_agent` should send.

## How to use them

- **Writing the prompt (B2):** `blocks.md` is the spec for the voice agent's behaviour. Each block's rules belong in the system prompt. The agency's settings (opening languages, voice languages, currency, units, handoff topics) are read at the start of every call.
- **Testing (B2 to B4):** play each call on the demo line for that test agency, with a native speaker for the non-English ones. Score it against `pass_criteria` and `must_not`, check the function calls in the mock's log, and note the delay. Then try at least one branch per call.
- **Platform bake-off (B4):** run all 23 on both voice platforms. For the Gulf, score Arabic separately for Gulf callers and for Najdi callers.
- **Before each pilot (join 2):** run that market's scripts again on the pilot's real feed. Swap in its listings, and keep the same blocks and behaviours.

## What these scripts can't tell you yet

They are finished as written tests. Three things can only happen once the system exists, or need a person:

- **Playing them on the real voice agent**, which is the point of phases B2 to B4.
- **A native speaker reading each caller line aloud.** One review has already corrected 9 lines across Arabic, German, Spanish, Swedish, Dutch, Urdu and Chinese. The Gulf Arabic and Urdu lines most need a native speaker's check before the Gulf launch.
- **Real feeds for Dubai and Riyadh.** The Gulf test listings are made up for testing. Once you have a real Property Finder or Bayut export, check the fields map onto the contract.

## Keeping them correct

```bash
python3 fixtures/calls/check_calls.py
```

This checks every script against the contract and its own test agency. It checks:

- that listings exist in that agency;
- that office-open flags and callback times match that agency's real hours and weekend;
- that transfers only happen while the office is open;
- that call languages are ones that agency's receptionist speaks;
- that functions, templates and enum values are in the contract;
- that every call ends with something done;
- that every line of each market's test matrix is covered.

It runs in CI.
