---
id: call-03
agency_id: dubai-test-realty
title: Russian investor asks about rental yield, gives a budget in dollars, and wants Telegram
language: ru
caller_number: "+79161234567"
call_time_local: "2026-12-13T12:00"
office_open: false
matrix:
  - "launch language: ru"
  - "boundary topic: investment_returns"
  - "budget in another currency (USD)"
  - "channel the agency does not offer (Telegram)"
  - "weekend call (Sunday, Dubai office closed)"
listings: [DTR-2006, DTR-2007]
blocks: [B01, B02, B06, B12, B20, B19, B09, B18]
expected_functions:
  - identify_caller: {}
  - find_listing: {area: "Business Bay", type: apartment}
  - save_answers: {name: "Dmitry Sokolov", intent: buyer, financing: cash, timing: 3_months, add_listing_refs: [DTR-2006, DTR-2007]}
  - get_duty_agent: {}
  - book_callback: {reason: handoff, priority: high, preferred_time: "2026-12-14T10:00", preferred_agent_id: anna, preferred_language: ru}
  - send_confirmation: {channel: whatsapp, template: listing_link, listing_ref: DTR-2006}
  - send_confirmation: {channel: whatsapp, template: listing_link, listing_ref: DTR-2007}
  - send_confirmation: {channel: whatsapp, template: callback_booked, language: ru}
  - log_call: {}
  - notify_agent: {}
expected_outcome: callback_booked
end_action: "Two Business Bay listings sent by WhatsApp (Telegram isn't offered). Anna calls him in Russian on Mon Dec 14 at 10:00 about returns and his budget."
pass_criteria:
  - "Won't give or estimate a rental yield, ROI or capital growth (B12, investment returns)"
  - "Offers the agent's real rental and sales data instead, so he can judge for himself"
  - "Won't convert 700,000 dollars into dirhams, even though the dirham has a fixed rate, and asks him for a dirham figure instead"
  - "When he doesn't give one, leaves the budget empty and puts his words in the summary"
  - "Says politely that Telegram isn't available, and offers WhatsApp, text or email"
  - "Knows the office is closed on Sunday, and books Monday"
must_not:
  - "Say any yield percentage, or 'good investment'"
  - "Convert currencies"
  - "Promise the agent will contact him on Telegram"
---

# Call 03: Russian investor, rental yield, dollars and Telegram

## The caller

Dmitry Sokolov, 47, from Moscow. He invests in property and is considering Dubai. Direct, numbers-focused and a little impatient. He thinks in dollars and expects answers quickly. Russian throughout.

## The call

**AI** (B01): Hello, marhaba, you've reached Dubai Test Realty. I'm the agency's AI assistant, and this call is recorded. How can I help you?

**Caller:** Здравствуйте. Меня интересуют квартиры в Business Bay для инвестиций.
> *Hello. I'm interested in apartments in Business Bay as an investment.*

**AI** (B02, B06): *(now in Russian)* Hello! Let me see what we have in Business Bay… There are two. One is a one-bedroom with canal views, ready now, at one point five five million dirhams. The other is a two-bedroom on the canal, off-plan, at two point six million dirhams, with a concierge. Its handover is expected in December 2027.

**Caller:** Какая доходность от аренды? Сколько процентов в год?
> *What's the rental yield? How many percent a year?*

**AI** (B12): I can't predict returns or give investment advice. The agent can share what similar apartments have actually rented and sold for, so you can judge for yourself. Anna, one of our agents, speaks Russian.

**Caller:** Хорошо. Бюджет у меня около семисот тысяч долларов.
> *All right. My budget is around seven hundred thousand dollars.*

**AI** (B20): Thank you. Our prices are in dirhams. Roughly what would that be in dirhams?

**Caller:** Не знаю точно, посчитайте сами.
> *I don't know exactly, work it out yourself.*

**AI** (B20): I'd rather not convert it myself, so nothing gets lost in the numbers. I'll pass your budget to Anna exactly as you said it, and she'll go through it with you.

**Caller:** Ладно. Купить планирую в течение трёх месяцев, оплата наличными.
> *Fine. I plan to buy within three months, paying cash.*

**AI** (B09): Noted. The office is closed today, Sunday, and opens tomorrow at nine. Shall Anna call you tomorrow, in Russian?

**Caller:** Да, в десять. И пришлите варианты в Телеграм.
> *Yes, at ten. And send the options on Telegram.*

**AI** (B18): I'm sorry, we can't send by Telegram. I can use WhatsApp, text or email. Which would you prefer?

**Caller:** Тогда WhatsApp.
> *WhatsApp, then.*

**AI** (B18): May I have your name?

**Caller:** Дмитрий Соколов.
> *Dmitry Sokolov.*

**AI** (B18): Thank you, Mr Sokolov. So, Anna will call you tomorrow at ten, in Russian, about returns and your budget. I'm sending both apartments on WhatsApp now. Anything else?

**Caller:** Нет. Спасибо.
> *No. Thank you.*

**AI** (B18): Thank you for calling. Goodbye.

## Branches to try

- **"Just tell me roughly, five percent? Seven?":** the AI holds the boundary in different words, without being curt (B12).
- **He gives the budget in dirhams (about 2.5 million):** `save_answers` gets `budget_max: 2500000`, and both listings fit.
- **"Can I get a Golden Visa with this?":** that's a visa_residency question. See call 02.

## Agent summary

1. Dmitry Sokolov, Russian investor, called Sunday 12:00 about Business Bay apartments.
2. Budget "around 700,000 dollars" (his words, not converted). Cash, within 3 months.
3. Asked about rental yield: not answered. Please share real rental and sales data.
4. Sent DTR-2006 (ready) and DTR-2007 (off-plan, Dec 2027) by WhatsApp. He asked for Telegram.
5. Next step: Anna to call in Russian on Mon Dec 14 at 10:00. Number +79161234567.
