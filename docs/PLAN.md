# Photo-to-Video Ads: Business Plan v2

*Draft of 15 November 2026. Working name: "Reel-in-60". All numbers are starting assumptions to test, not research.*

---

## 1. The concept

A **100% self-serve, credit-based web app** that turns one product photo into a ready-to-post vertical video ad for TikTok, Instagram Reels and Snapchat.

**What the merchant does:** buys credits → picks a template (e.g. "Luxury Product Reveal", "Cafe Pour", "Property Tour") → uploads 1 photo → types a one-line offer → gets a finished video in about 60 seconds.

**What happens behind the scenes:** the product is cut out of the photo and placed, **unchanged**, on an AI-generated background scene. Captions, music and an end card are added automatically, and 1 credit is deducted.

**Hard rule:** no agency work. No client management, no calls, no custom edits.

**Why we beat the raw AI platforms (Higgsfield, Kling, Runway):** they sell camera controls and empty prompt boxes to creators. We sell **tested ad formats and local taste** to busy merchants who don't write prompts.

---

## 2. Key decisions so far

| Decision | Detail |
|---|---|
| **Product for everyone, built on templates** | Any business can use it. Fragrance, coffee shops, real estate, beauty and so on are template sets, not separate products. |
| **Market to one group first** | Build for everyone, but spend the first marketing money on one group so samples, ads and outreach all speak to the same merchant. Start with Saudi Salla and Zid merchants. |
| **The product never goes through the AI model** | It is cut out and laid on top of an AI-generated background. Labels, logos and Arabic text can't be damaged. This applies to every template. |
| **Background scenes are reusable** | Scenes don't depend on the merchant's product, so they're rendered once into a library and reused. That makes each video cost about SAR 1 instead of SAR 4.5. |
| **Opening lines written by people** | Saudi copywriters write the library of opening lines. The AI only picks and adapts them to the merchant's offer. |
| **One pack at launch** | **SAR 250 for 15 videos (SAR 16.7 per video).** Add smaller and larger packs once you know where buyers hesitate. |
| **Global English market dropped** | Too crowded (Creatify, Topview, Arcads, Pippit) and acquisition costs are too high. |

---

## 3. Business Model Canvas

### Customer segments
- **First marketing focus:** Saudi merchants on Salla and Zid, typically 1 to 10 staff, already spending SAR 1,500–10,000 a month on Snapchat or TikTok ads, with the owner doing the marketing.
- **Next template sets:** coffee and dessert shops (Riyadh, Jeddah, Khobar), beauty, real estate. Property photos have no labels, so real estate is the easiest template to render.
- **Not served:** agencies wanting white-label output, brands wanting custom work, anyone asking for a call.

### Value proposition
> *"10 different Snapchat ads for your product tonight. Your label stays exactly as it is."*

- **Volume for ad testing:** many variations of one product so the ad platform can find the one that sells. The real competitor is a free CapCut template or no ad at all, not a freelancer.
- **Speed:** 60 seconds instead of 3–5 days.
- **Price:** ~SAR 17 per video, against SAR 150–500 for a freelance reel.
- **Label guarantee:** the real product photo is never altered.
- **Local taste:** Gulf Arabic opening lines and seasonal templates (Ramadan, Eid, Founding Day, National Day, White Friday).

### Channels
| Stage | Channel |
|---|---|
| Awareness | Salla and Zid app listings, your own website, Snapchat/TikTok ads showing a plain photo becoming the finished ad, affiliates |
| Trial | 1 free watermarked render per connected store (costs about SAR 1) |
| Purchase | Web checkout with mada, Apple Pay and STC Pay, or the platform's own billing for app-store installs |
| Delivery | MP4 download plus a "send to my WhatsApp" link |
| After-sales | Seasonal template alerts, credit expiry reminders |

Treat every app-store install as a contact you own (WhatsApp opt-in and email on first render), so you don't depend entirely on Salla.

### Customer relationships
- Fully automated self-serve.
- **Automated WhatsApp bot:** answers to common questions, a refund-credit button and a re-render link. No human support.
- Credits are refunded automatically when a render fails.
- 1 free re-roll per video. At most 2 generations per credit, after which the credit is refunded.

### Key activities
1. Build the background-scene library (about 40 scenes per template at launch).
2. Make the composite look real: shadows, light sweeps, colour matching.
3. Maintain the opening-line library with Saudi copywriters, plus a list of approved cosmetics wording.
4. Release 2–4 seasonal templates a month.
5. Run the app-store, affiliate and paid-ad channels.

### Key resources
- The scene library and template set.
- The compositing and assembly pipeline.
- The human-written opening-line library.
- Starting cash: about SAR 40k for 4 months.

### Key partners
- **Video models** via fal.ai (Kling as default, others as fallback), used to build the scene library and for the premium tier only.
- **Assembly:** Creatomate or Shotstack at first, then your own FFmpeg worker.
- **Payments:** a mada-capable gateway (Moyasar, Tap or HyperPay) that works with your company setup.
- **Distribution:** Salla App Store and Zid App Market.
- **People:** 2–3 Saudi copywriters, paid per batch.
- **Licensed assets:** commercial Arabic fonts and a music library cleared for ads.
- **Affiliates:** Saudi e-commerce creators, paid a **one-off SAR 40** when a referred merchant buys their first pack. Affiliates must hold a Mawthooq licence.

### Cost structure

| Credit type | What it is | Cost to make | Credits charged |
|---|---|---|---|
| **Studio** (standard) | Library scene + real product on top + opening line + music | ~SAR 1 ($0.25) | 1 |
| **Cinematic** (premium) | Scene generated for this order, with a visual label check | ~SAR 8 ($2.10, incl. retries) | 3 |

- **Fixed:** hosting, tools and licences about SAR 1,500 a month. Company registration and accounting depend on where you incorporate.
- **Biggest cost:** acquiring customers, not making videos.

*API prices are from memory: check current fal.ai and Kling pricing.*

### Revenue streams

| Pack | Price (excl. 15% VAT) | Per video | Margin (all Studio) | Margin (25% Cinematic) |
|---|---|---|---|---|
| Free | 1 watermarked render per store | — | costs ~SAR 1 | — |
| **Launch pack: 15 credits** | **SAR 250** | **SAR 16.7** | **~92%** | **~85%** |

Prepaid only, no unlimited plans, credits expire after 12 months. Margins include payment fees but **not** the Salla/Zid cut, which still needs confirming.

**CAC check:** for every 100 merchants who buy the pack, assume 40 buy another (SAR 250 each).
- Revenue: 25,000 + 10,000 = **SAR 35,000**, so **SAR 350 per buyer**
- At ~85% margin: **~SAR 300 of gross profit per buyer**
- To keep LTV at 3× CAC: **CAC ≤ ~SAR 100 per paying merchant**

---

## 4. What we build, in order

Start building now, but build the piece that tests the biggest unknown first, not the full app.

| Dates | Step | Pass rule (miss it = stop or change direction) |
|---|---|---|
| **Nov 16–22** | **Render test.** A rough script: photo → cut out product → place on AI background → captions + music → vertical video. Run it on ~30 products across 3 templates (fragrance, coffee shop, real estate). Blind-test with 10 merchants or ad buyers. | Composite videos rated as good as fully AI-generated ones by 6 of 10. Real cost per video ≤ SAR 2. |
| **Nov 16–22** (alongside) | **Admin checks:** mada payment link, Salla/Zid app terms, approved cosmetics wording, the model's commercial-use terms. | A working mada payment link exists. |
| **Nov 23 – Dec 13** | **Manual sales test.** Message 150 businesses, each with a finished sample ad made from their own store photo (sent privately, never published). They see only a form, a payment link and an automatic delivery link. No chatting. | **10 packs paid** · **≥60% of credits used within 30 days** · **≥70% of videos downloaded and reported as posted** |
| **Dec 14 – Jan 10** | **Build the real self-serve app:** accounts, credits, checkout, job queue, scene library, WhatsApp bot. Submit Salla and Zid listings. | Full flow works with no one involved. |
| **Jan 10 – Feb 7** | **Ramadan launch:** 4 Ramadan/Eid templates, affiliate outreach, a first SAR 5k Snapchat ad test. | **CAC ≤ SAR 100** on at least one channel · ≥2 merchants share an ad-results screenshot |
| **~Feb 8** | Ramadan 2027 expected to start (confirm the date). Check repeat purchases at 60 days for the test merchants. | ≥30% have bought again. If not, it's a one-off novelty: stop or change direction. |

**Tracking during the manual test, per video:** API spend, re-rolls, minutes of your time, downloaded (yes/no), posted (one WhatsApp question 7 days later). Offer 2 free credits for a screenshot of the ad's results.

---

## 5. Legal and admin to check before taking money

*Flags to verify, not legal advice.*

| Item | Why it matters |
|---|---|
| Company registration and payment gateway | Moyasar and HyperPay generally require a Saudi commercial registration. Find a mada-capable gateway that works with your company. |
| Cosmetics ad claims | The Saudi Food and Drug Authority restricts claims like "whitening" or "cures acne". Opening lines must use approved wording. |
| Affiliate licence | Saudi influencers running paid promotion need a Mawthooq licence. |
| Commercial use of AI output | Read the video model's and fal.ai's terms. |
| AI content labels | TikTok requires realistic AI content to be labelled. Build it into the export. |
| VAT | Prices exclude 15% VAT. Check when registration becomes mandatory for you. |

---

## 6. The 5 risks still open

1. **Will the composite look fake?** If the product looks pasted on, the label guarantee costs you the premium look. The Nov 16–22 render test is mainly about this.
2. **Do the videos actually sell anything?** No ad-results data yet. The screenshot-for-credits offer is the only early signal.
3. **Will Salla or Zid build this themselves?** Compositing is easier to copy than tuned prompts. Your protection is the scene library, the human-written opening lines and how fast you ship seasonal templates.
4. **Can you get a paying merchant for SAR 100 or less?** Unproven on every channel.
5. **Can you stay fully self-serve under pressure?** Ramadan is when merchants will message you. Decide now what the WhatsApp bot says, and stick to it.
