---
id: call-01
agency_id: riyadh-test-estates
title: Saudi family buyer calls on Friday about a villa with a majlis in Al Malqa
language: ar
caller_number: "+966555123456"
call_time_local: "2026-12-11T13:20"
office_open: false
matrix:
  - "launch language: ar (Riyadh)"
  - "weekend call (Friday in Saudi Arabia)"
  - "reserved listing with an alternative"
listings: [RTE-3006, RTE-3001]
blocks: [B01, B02, B05, B06, B07, B12, B08, B15, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {ref: RTE-3006, include_unavailable: true}
  - find_listing: {area: "Al Malqa", type: villa}
  - save_answers: {name: "Abdullah Al Otaibi", intent: buyer, budget_max: 4500000, financing: mortgage, timing: 3_months, add_listing_refs: [RTE-3006, RTE-3001]}
  - get_duty_agent: {}
  - request_viewing: {listing_ref: RTE-3001, preferred_days: ["2026-12-13"], time_of_day: evening, preferred_language: ar}
  - send_confirmation: {channel: whatsapp, template: viewing_request_received, language: ar}
  - log_call: {}
  - notify_agent: {}
expected_outcome: viewing_requested
end_action: "Viewing request for RTE-3001 on Sun Dec 13 in the evening. The agent confirms on Saturday after 16:30, when the office reopens. WhatsApp confirmation in Arabic."
pass_criteria:
  - "Opens in Arabic first (the agency's opening languages are ar then en), and returns the greeting"
  - "Explains 'reserved' clearly, and offers to tell him if it becomes free"
  - "Names the majlis and driver's room from the features list, because those matter to Saudi families"
  - "Prices in riyals and sizes in square metres (this agency's unit)"
  - "Gives no advice on home finance, but notes that he will use it (B12, mortgage)"
  - "Knows Friday is closed and the office reopens on Saturday at 16:30, and offers an evening viewing"
must_not:
  - "Book a viewing time without saying the agent will confirm it"
  - "Comment on bank finance rules or amounts"
---

# Call 01: Saudi family, villa with a majlis, called on a Friday

## The caller

Abdullah Al Otaibi, 45, a government engineer in Riyadh. He's looking for a larger villa for his family, with a proper majlis for guests. He calls after Friday prayers, while the office is closed. He's respectful, unhurried, and speaks Najdi Arabic.

## The call

**AI** (B01): مرحباً، you've reached Riyadh Test Estates. I'm the agency's AI assistant, and this call is recorded. How can I help you?

**Caller:** السلام عليكم. شفت عندكم فيلا في الملقا، رقمها RTE-3006. للحين متوفرة؟
> *Peace be upon you. I saw a villa of yours in Al Malqa, number RTE-3006. Is it still available?*

**AI** (B02, B05): *(in Arabic)* Wa alaykum as-salam. One moment… That villa is reserved at the moment, which means another buyer has had an offer accepted. Sometimes these do fall through. Shall I ask the agent to let you know if it becomes free?

**Caller:** إي، الله يجزاك خير. وعندكم شي ثاني في الملقا؟ نبي مجلس رجال ومكان للسواق.
> *Yes, may God reward you. Do you have anything else in Al Malqa? We want a men's majlis and a place for the driver.*

**AI** (B06): Let me look… There's a five-bedroom villa in Al Malqa at four point two million riyals. It has a majlis, a driver's room, a private garden and an elevator. The built area is four hundred and fifty square metres.

**Caller:** زين. ميزانيتنا تقريباً أربعة ونص مليون، وبناخذ تمويل عقاري من البنك.
> *Good. Our budget is about four and a half million, and we'll take home finance from the bank.*

**AI** (B07, B12): That fits. On the financing, the agent can introduce you to people who handle home finance, because the details depend on your situation. When are you hoping to buy?

**Caller:** خلال ثلاث شهور إن شاء الله.
> *Within three months, God willing.*

**AI** (B08): Would you like to see the villa? Which day suits you, and is the evening better?

**Caller:** يوم الأحد بعد المغرب، أنا والعائلة.
> *Sunday after sunset prayer, me and the family.*

**AI** (B08): Sunday the thirteenth, in the evening, with the family. The office is closed today and reopens tomorrow, Saturday, at half past four. The agent will call you then to confirm the exact time. May I have your name?

**Caller:** عبدالله العتيبي.
> *Abdullah Al Otaibi.*

**AI** (B15): Thank you, Mr Abdullah. Is this number best? Plus nine six six, five five five, one two three, four five six?

**Caller:** نعم.
> *Yes.*

**AI** (B18): So, I've passed on your request to view the Al Malqa villa on Sunday evening. The agent will call you tomorrow after half past four to confirm, and will tell you if the reserved villa becomes free. Shall I send you the details on WhatsApp?

**Caller:** إي، واتساب.
> *Yes, WhatsApp.*

**AI** (B18): Done. Is there anything else I can help with?

**Caller:** لا، شكراً. في أمان الله.
> *No, thank you. Go in God's safety.*

**AI** (B18): Ma'a as-salama, Mr Abdullah. Thank you for calling.

## Branches to try

- **He asks for a family viewing with a female agent present:** the AI notes the wish, and doesn't promise it. The agent arranges it.
- **"How much would the bank give me?":** B12 (mortgage), with no amounts.
- **He wants a private pool:** RTE-3001 doesn't list one. B06 checks Hittin: RTE-3002 has a swimming pool but costs 6.5 million, so the AI asks before mentioning it, because it's over budget.

## Agent summary

1. Abdullah Al Otaibi, Saudi, called Friday 13:20 (office closed) about RTE-3006 (reserved). Tell him if it falls through.
2. Wants a villa in Al Malqa with a men's majlis and a driver's room. Budget about 4.5 million SAR, home finance, within 3 months.
3. Interested in RTE-3001 (majlis, driver's room, 4.2 million).
4. Requested a family viewing on Sun Dec 13, evening (after sunset prayer).
5. Next step: call Saturday after 16:30 to confirm. Number +966555123456.
