# Owner review notes for the policy drafts

These notes aren't shown to customers. Each one points at a clause in `legal/*.md` that needs the operator's decision or a lawyer's check. The drafts show the matching placeholders in development and preview, and production won't publish while any placeholder is unfilled.

## Placeholders to fill

**`config/business.json`**

| Placeholder | Where | Note |
|---|---|---|
| `[LEGAL OPERATOR NAME]` | Terms (intro, §13), Privacy, Contact | `operatorName`, the name you trade under as the operator. |
| `[BUSINESS ADDRESS REQUIRED FOR PUBLICATION]` | Terms, Privacy, Contact | `address`. E-Commerce Law Art 6 requires an address unless your store is authenticated through the Ministry-linked platform. |
| (filled) | all | `contactEmail` = support@tiraez.com. tiraez.com's MX records point to Zoho; check the mailbox exists. |
| `[FREELANCE LICENCE DETAILS, IF APPLICABLE]` | Contact | `licenceDetails`. Optional: set it to `""` to show nothing, or to e.g. "Freelance licence: FL-…". Law Art 6(c) mentions a registration number "if any, or of any other publicly available register". Showing the licence number is a reasonable way to meet that, but it isn't a stated requirement. No copy of the licence or ID is needed. |

**`config/legal.json`**

| Placeholder | Where | Note |
|---|---|---|
| `[EFFECTIVE DATE]` | all | `documents.*.effective` |
| `[SDAIA CONTROLLER REGISTRATION DETAILS, ONCE REGISTERED]` | Privacy | `unresolved.controllerRegistration`. Fill in only after registering. |
| `[TRANSFER SAFEGUARDS: DESCRIBE ONLY ONCE IN PLACE]` | Privacy | `unresolved.transferSafeguards`. Describe only safeguards that exist (`docs/compliance/transfers.md`). |
| `[VAT STATUS, AND WHETHER PRICES INCLUDE VAT]` | Billing | Payments only. |
| `[CREDIT EXPIRY RULE]` | Billing | Payments only. The code doesn't expire credits today. |
| `[REFUND RULE FOR PARTLY USED PACKS AND OTHER CASES]` | Billing | Payments only. The draft already covers what the law settles: a pack with no credits used, within 7 days; failed videos; delivered videos; billing mistakes. You decide the rest, for example a pro-rata refund of the unused credits. |
| `[RECEIPT OR INVOICE PROVIDED, AND ITS CONTENTS]` | Billing | Payments only. Reg Art 8 lists what an invoice must contain. Don't issue tax invoices unless you're VAT-registered. |
| `[HOW LONG A REFUND TAKES TO REACH THE CARD]` | Billing | Payments only. Check with Moyasar. |
| `[CONFIRMED RETENTION PERIOD FOR PURCHASE RECORDS]` | Privacy | Payments only. Ask an accountant. |

**`config/retention.json`** (approved on 17 Nov 2026; see docs/RETENTION.md)

| Placeholder | Where | Note |
|---|---|---|
| (none left) | Privacy | All retention periods are now approved: videos 90 days, source photos 7 days, abandoned uploads 7 days, unverified accounts 30 days, restricted accounts 30 days, reset links 1 hour. |

While payments are switched off, the payment-only placeholders don't block the other documents. A published billing page then says these points "will be set out here before buying credits opens".

## Clauses to review

1. **Terms §2, business customers.** These terms bind the business as well as the person who accepts them. Check this is enforceable against a business when someone accepts on its behalf.
2. **Terms §5, output rights.** These rest on fal's terms (no ownership claim, model listed for commercial use) and the model page as checked on 17 Nov 2026. Kling's own API terms (output belongs to the user, commercial use unrestricted) bind Kling's direct customers; whether they apply through fal is unconfirmed. The promise to "only use a model whose terms allow this use" is our commitment, so check it suits you.
3. **Terms §8, refund on our own unjustified closure.** This is a commitment we've added. It's consumer-protective and likely what the law expects, but it's your decision.
4. **Terms §10, liability.** There's no cap and no blanket exclusion. The listed exclusions (your publication of a video, your content, your breach, events beyond our control) need checking under the Saudi Civil Transactions Law.
5. **Terms §12, disputes.** Saudi law and the competent Saudi courts, with no arbitration. Confirm this is what you want.
6. **Billing, the 7-day right.** The draft applies E-Commerce Law Art 13 to packs with no credits used, and treats delivered videos as a received service. Whether a partly used pack can be partly cancelled is your decision (placeholder above).
7. **Privacy, legal bases.** The draft relies on the agreement with the user (PDPL Art 6), on legal duties, and on consent only for the optional report email. It uses no "legitimate interest" basis, which would need a documented assessment first.
8. **Privacy, provider statements.** Railway, Resend and fal facts are attributed to those providers ("states") because we can't verify them independently. Recheck them before publishing; they change.
9. **Privacy, breach notice.** The draft promises to notify affected people "without undue delay" and SDAIA as required (Implementing Regulation Art 24: 72 hours).
10. **Activity scope of the freelance licence.** Not a policy clause, but confirm your licence's profession covers operating this service (`freelanceActivity`).
