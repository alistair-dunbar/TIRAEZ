---
id: call-05
agency_id: dubai-test-realty
title: Chinese investor asks for WeChat and is put through to a Mandarin-speaking agent
language: zh
caller_number: "+8613812345678"
call_time_local: "2026-12-17T11:00"
office_open: true
matrix:
  - "launch language: zh"
  - "channel the agency does not offer (WeChat)"
  - "off-plan listing compared with a ready one"
  - "warm transfer, answered (named agent, same language)"
listings: [DTR-2008, DTR-2009]
blocks: [B01, B02, B06, B19, B20, B18, B15, B10]
expected_functions:
  - identify_caller: {}
  - find_listing: {area: "Downtown Dubai", type: apartment}
  - save_answers: {name: "Zhang Hui", email: "zhang.hui@hui-capital.example", intent: buyer, add_listing_refs: [DTR-2008, DTR-2009]}
  - send_confirmation: {channel: email, template: listing_link, listing_ref: DTR-2008}
  - send_confirmation: {channel: email, template: listing_link, listing_ref: DTR-2009}
  - transfer_call: {agent_id: wei}
  - log_call: {}
  - notify_agent: {agent_id: wei}
expected_outcome: transferred
end_action: "Both Downtown listings sent by email (WeChat isn't offered), then a warm transfer to Li Wei, who speaks Mandarin. Wei answers."
pass_criteria:
  - "Explains the difference between the ready and the off-plan apartment simply (B19)"
  - "Gives the price per square foot only because he asks, worked out from the listing, rounded and marked as approximate (about 2,940 dirhams per sq ft)"
  - "Says kindly that WeChat isn't offered, and offers email, WhatsApp or text"
  - "Spells the email back before sending"
  - "Transfers to Wei, because the caller wants a Mandarin speaker and the office is open"
must_not:
  - "Promise the agent will add him on WeChat"
  - "Compare the two apartments as investments"
---

# Call 05: Chinese investor, Downtown apartments, WeChat, transfer to Wei

## The caller

Zhang Hui, 51, from Shanghai. He owns a trading company and is looking at Downtown Dubai for himself and his children. Polite and precise, and asks about price per square foot. He prefers WeChat and Mandarin throughout. He calls during a business trip.

## The call

**AI** (B01): Hello, marhaba, you've reached Dubai Test Realty. I'm the agency's AI assistant, and this call is recorded. How can I help you?

**Caller:** 您好。我想了解迪拜市中心能看到哈利法塔的公寓。
> *Hello. I'd like to know about apartments in Downtown Dubai with a view of the Burj Khalifa.*

**AI** (B02, B06): *(now in Mandarin)* Hello! Let me check… There are two. One is a two-bedroom, ready now, at three point nine five million dirhams, with Burj Khalifa views and a concierge. The other is a one-bedroom, off-plan, at two point one five million dirhams, also with Burj Khalifa views. Its handover is expected in March 2028, according to the developer.

**Caller:** 现房那套每平方英尺多少钱？
> *How much per square foot is the ready one?*

**AI** (B20): It works out at roughly two thousand nine hundred and forty dirhams per square foot. That's approximate, from the listed price and size.

**Caller:** 好的。期房的付款方式是怎样的？
> *OK. What's the payment plan for the off-plan one?*

**AI** (B19): The developer's plan is seventy-thirty: seventy percent during construction, and thirty percent on handover. The agent can go through the exact schedule.

**Caller:** 请把这两套的资料发到我的微信。
> *Please send the details of both to my WeChat.*

**AI** (B18): I'm sorry, we can't send by WeChat. I can send them by email, WhatsApp or text. Which would you prefer?

**Caller:** 那发邮件吧。zhang点hui，at，hui杠capital点example。
> *Email then. zhang dot hui, at, hui dash capital dot example.*

**AI** (B15): Let me read it back: Z-H-A-N-G, dot, H-U-I, at, H-U-I, dash, C-A-P-I-T-A-L, dot, example. Is that right?

**Caller:** 对。我叫张辉。现在能和会说中文的人谈谈吗？
> *Yes. My name is Zhang Hui. Can I speak to someone who speaks Chinese now?*

**AI** (B10): Of course. Li Wei, one of our agents, speaks Mandarin and is in the office. I'm sending the two listings to your email now, and I'll tell Wei what you're interested in, so you won't need to repeat it. One moment, please.

*Whisper to Wei:* "Zhang Hui, Chinese, wants Downtown apartments with Burj Khalifa views: DTR-2008 (ready) and DTR-2009 (off-plan). Asked about price per sq ft and the payment plan. Wanted WeChat; listings sent by email."

*Wei answers. The AI connects the call and leaves.*

## Branches to try

- **Wei doesn't answer:** see the Spanish call 12 pattern. The AI apologises and books a B09 callback with `preferred_agent_id: wei` and `preferred_language: zh`.
- **"Which is the better investment?":** B12 (investment returns), with no comparison given.
- **The same call on Sunday:** the office is closed. Listings go by email, then a B09 callback on Monday with Wei.

## Agent summary (to Wei, after the transfer)

1. Zhang Hui, Chinese, called at 11:00 about Downtown apartments with Burj Khalifa views.
2. Interested in DTR-2008 (2-bed, ready, 3.95 million) and DTR-2009 (1-bed, off-plan, March 2028, 70/30).
3. Asked about price per sq ft (about 2,940 for DTR-2008) and the payment plan.
4. Asked for WeChat (not offered). Listings sent to zhang.hui@hui-capital.example.
5. Transferred to you live at 11:04. Number +8613812345678.
