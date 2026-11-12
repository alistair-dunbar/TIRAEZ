---
id: call-01
agency_id: dubai-test-realty
title: Emirati buyer asks about a family villa in Arabian Ranches, in Arabic, after hours
language: ar
caller_number: "+971501234567"
call_time_local: "2026-12-14T21:30"
office_open: false
matrix:
  - "launch language: ar (Dubai)"
  - "sizes in square feet"
listings: [DTR-2002]
blocks: [B01, B02, B05, B20, B07, B08, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {ref: DTR-2002}
  - save_answers: {name: "Khalid Al Suwaidi", intent: buyer, budget_max: 6000000, financing: cash, timing: now, add_listing_refs: [DTR-2002]}
  - get_duty_agent: {}
  - request_viewing: {listing_ref: DTR-2002, preferred_days: ["2026-12-19"], time_of_day: morning, preferred_agent_id: omar, preferred_language: ar}
  - send_confirmation: {channel: whatsapp, template: viewing_request_received, language: ar}
  - log_call: {}
  - notify_agent: {}
expected_outcome: viewing_requested
end_action: "Viewing request for DTR-2002 on Sat Dec 19 in the morning. Omar (Arabic-speaking) confirms tomorrow. WhatsApp confirmation in Arabic."
pass_criteria:
  - "Returns the greeting in kind (Wa alaykum as-salam) and switches to Arabic at once"
  - "Says prices in dirhams and sizes in square feet: about 3,550 sq ft built, about 6,460 sq ft plot"
  - "Says honestly that the listing shows a community pool, and no private pool"
  - "Uses respectful forms of address (Abu ... if offered, or his name) and stays warm and unhurried"
  - "Offers Saturday morning inside the agency's Saturday hours, and says Omar will confirm when the office opens tomorrow at 09:00"
must_not:
  - "Imitate a Gulf accent, or switch to English without being asked"
  - "Say the villa has a private pool"
  - "Quote government or transfer fees"
---

# Call 01: Emirati family buyer, villa in Arabian Ranches, in Arabic

## The caller

Khalid Al Suwaidi, 42, Emirati, from Dubai. He's buying a bigger home for his growing family, with cash. Courteous, and expects courtesy back. He speaks Gulf Arabic and uses "أبي" (I want) and "نبي" (we want). Play him relaxed. He calls after the family's evening meal.

## The call

AI lines are the intent, in English. The AI says them in Arabic, in its own words. Caller lines are what the tester says.

**AI** (B01): Hello, marhaba, you've reached Dubai Test Realty. I'm the agency's AI assistant, and this call is recorded. How can I help you?

**Caller:** السلام عليكم. أبي أستفسر عن الفيلا اللي في المرابع العربية، رقمها DTR-2002.
> *Peace be upon you. I want to ask about the villa in Arabian Ranches, its number is DTR-2002.*

**AI** (B02, B05): *(now in Arabic)* Wa alaykum as-salam, and welcome. One moment, let me check… Yes, it's available: a four-bedroom family villa in Arabian Ranches at five point nine million dirhams, with a private garden and a maid's room. There's a community pool, and a golf course nearby. What would you like to know?

**Caller:** كم مساحتها؟ وفيها مسبح خاص؟
> *How big is it? And does it have a private pool?*

**AI** (B20, B05): It's about three thousand five hundred and fifty square feet built, on a plot of about six thousand four hundred and sixty square feet. The listing shows a community pool, but no private pool. If a private pool matters, I can ask the agent whether there's room to add one.

**Caller:** لا، عادي، المسبح المشترك يكفي. الميزانية حوالي ستة ملايين، كاش.
> *No, that's fine, the shared pool is enough. The budget is around six million, cash.*

**AI** (B07): That fits well. Are you hoping to move soon?

**Caller:** إي، بأسرع وقت. نبي نشوفها هالأسبوع، يوم السبت الصبح إذا ممكن.
> *Yes, as soon as possible. We want to see it this week, Saturday morning if possible.*

**AI** (B08): Of course, Saturday the nineteenth, in the morning. Omar, one of our agents, speaks Arabic and will call you to confirm the exact time. May I take your name?

**Caller:** خالد السويدي.
> *Khalid Al Suwaidi.*

**AI** (B15): Thank you, Mr Khalid. Is this number the best one? Plus nine seven one, five zero, one two three, four five six seven?

**Caller:** صح.
> *Correct.*

**AI** (B18): So, I've passed on your request to view the villa on Saturday morning. Omar will call you tomorrow, when the office opens at nine, to confirm. Shall I send you the details on WhatsApp, in Arabic?

**Caller:** إي، أرسلها واتساب.
> *Yes, send it on WhatsApp.*

**AI** (B18): Done. Is there anything else I can help you with?

**Caller:** لا، مشكور. الله يعطيك العافية.
> *No, thank you. May God give you strength.*

**AI** (B18): And you, Mr Khalid. Thank you for calling, and have a good evening.

## Branches to try

- **He asks for the size in square metres:** the AI gives 330 m² and 600 m² (B20).
- **"What are the fees on top?":** only the FAQ: a 2% agency fee plus VAT. Government fees go to the agent (B12).
- **He wants a private pool after all:** B06 searches for villas with a private pool within 6 million dirhams. If nothing fits, B09 with the criteria in the note.

## Agent summary

1. Khalid Al Suwaidi, Emirati, called at 21:30 about villa DTR-2002 (Arabian Ranches).
2. Cash buyer, budget about 6 million AED, wants to move as soon as possible.
3. Happy with the community pool (no private pool on the listing).
4. Requested a viewing on Sat Dec 19, morning. Prefers Arabic.
5. Next step: Omar to call and confirm. Number +971501234567.
