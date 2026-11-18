# Legal pages, registration and launch: status

Updated 17 November 2026. This is engineering groundwork, not legal advice. The policy drafts in `legal/*.md` describe how the code actually behaves. A qualified lawyer should review the points marked **Review** before launch. Nothing here, and nothing on the site, should be described as "fully compliant".

`npm run launch-check` prints, at any time, exactly what each operation still waits for.

## How the gates work

Each operation is blocked only by what it depends on.

| Operation | Opens in production when | Why |
|---|---|---|
| Policies published | operator facts filled in (`config/business.json`); retention periods confirmed; every policy value filled in; `status: "published"` | E-Commerce Law Art 6 (name, address, contact, any public register number); Reg Art 6 (privacy policy, complaints procedure); PDPL Arts 12–13 (privacy notice) |
| New accounts | policies published; safeguards and a risk assessment recorded for Railway and Resend (`config/compliance.json`); email can be sent | PDPL Art 29 and Transfer Regulation Arts 4 and 7 (`docs/compliance/transfers.md`). Email confirms the address before any billable use |
| Video generation | safeguards and a risk assessment recorded for Railway and fal | Same, for photos and instructions sent to the model |
| Payments | VAT, credit expiry, refund and invoice decisions recorded (`paymentsOnly` in `config/legal.json`); Moyasar configured | E-Commerce Law Art 7 and Reg Arts 7–8: total price including taxes, cancellation right, invoice contents |

While payments are off, the billing decisions don't hold anything else up: the policy says they'll be set out before buying opens. `LEGAL_PREVIEW=1` shows the drafts with a "not in force" banner, on a deployment that isn't public.

## Operator: the freelance document

- **What the document is.** A Saudi freelance document (وثيقة العمل الحر, freelance.sa, Ministry of Human Resources and Social Development) lets an individual work independently in approved professions. It **is not a commercial registration**, and freelance.sa says it doesn't allow opening a commercial store. Under the E-Commerce Law the operator is therefore a **"practitioner"** (Art 1: "practices e-commerce but not registered in the Commercial Register"). Registering in the Commercial Register is optional for a practitioner (Reg Art 12).
- **What the pages show.**
  - operator name;
  - the freelance document number (Law Art 6(c) covers "any other publicly available register"; the number can be checked at freelance.sa);
  - an explicit "no commercial registration" statement;
  - address;
  - contact email;
  - complaint routes: the operator, the Ministry of Commerce (1900, Balagh Tijari) and SDAIA.

  None of these values has been invented: they're all `null` until supplied.
- **Address.** Reg Art 3 makes a practitioner's address the one stated on the site, or else their National Address. The exemption from showing an address applies only to stores authenticated through the Ministry-linked platform (business.sa), per Reg Art 13(3).
- **Review:** whether the profession on your freelance document covers selling this online service. freelance.sa lists, among others, software engineering, website programming and development, video editing, animation and graphic design. I found no category for selling a SaaS or online service. Check your document's profession (the `freelanceActivity` field) and, if needed, ask freelance.sa (011 502 0137).

## SDAIA controller registration

The Rules Governing the National Register of Controllers, Art 2(4), make registration mandatory for "the individual [who] processes personal data for purposes exceeding personal or family use". Running Tiraez does that. Register at dgp.sdaia.gov.sa, then record the certificate number in `unresolved.controllerRegistration`; the Privacy Policy states it. This is **separate from** the authority to operate (the freelance document) and from what customers are shown.

## Transfers outside Saudi Arabia

See `docs/compliance/transfers.md`. In short:
- SDAIA hasn't published an adequacy list.
- The exemption case for providing a service to the data subject requires the recipient to hold an SDAIA accreditation certificate.
- Otherwise the safeguard available is SDAIA's own standard contractual clauses, plus a risk assessment.
- Railway, Resend and fal offer EU clauses, which aren't SDAIA's.
- Railway has no Saudi region.

The doc has the step-by-step actions, a draft risk assessment, a message to send the providers, and alternatives with their cost.

## Registration as built

- **Fields:** name (any language), email, password, and age in whole years.
- **Agreements:** two separate unticked boxes, one for the terms and one for 18+. The privacy notice sits beside them as information.
- **Marketing consent:** none, because no marketing is sent.
- **Age rule:**
  - Under 18 at sign-up is refused server-side and nothing is stored.
  - Only the 18+ result, its method (`self_declared`) and the time are kept. The age itself isn't stored.
  - No IP addresses are logged for agreements.
  - Age is self-declared, and the site says it isn't verified.
- **Duplicate emails:** one neutral reply: "Check your email for the next steps. If you already have an account, you can log in or reset your password." Nobody is logged in by signing up. The owner of an existing account is emailed instead, at most three times an hour.
- **Email confirmation:** required before uploads, generation and purchases. Links are single-use, hashed and expiring.
- **Password reset:** one neutral reply, a 1-hour single-use link, every session ends after a reset, and the account is told by email.
- **Existing account declaring under 18:**
  - restricted, not deleted: uploads, generation and purchases stop;
  - videos not yet sent to the model are cancelled and refunded, and paid purchases get a refund request;
  - re-entering an age is blocked;
  - a person reviews corrections (`npm run suspend -- --email … --lift-age --note …`);
  - otherwise the account is deleted after 30 days.

## Credits and refunds as built

- **The ledger** records every change, and a unique index stops any entry being written twice:
  - purchase and grant;
  - reserve (when a video starts), consume (when it finishes) and return (when it fails);
  - purchase refund.
- **The account page** shows credits available, reserved, used, returned and refunded.
- **Refunds:**
  - Customers request them per purchase, with one open request at a time.
  - A person reviews them (`npm run refunds`). Approval removes the purchase's unused credits, so they can't be spent.
  - It never takes a balance below zero, and repeating it changes nothing.
  - The money goes back through Moyasar's dashboard.
- **The 7-day right.** The billing page states the E-Commerce Law Art 13 cancellation right: a pack with no credits used, within 7 days. Delivered videos are excluded (the service has been received). **Review** whether partly used packs should be partly refunded. That's a business decision, recorded in `unusedCreditRefunds`.
- **Checkout.** The button reads "Pay SAR 250 for 15 credits", with the total price and the cancellation right shown next to it (Reg Art 7).

## Decisions still needed from the operator

- **Operator facts:** your name as on the freelance document, the document number (FL-…), its profession, your address (National Address) and a contact email.
- **Retention periods:** confirm them in `config/retention.json`: unused photos 7 days; video model files 24 hours; unconfirmed accounts 30 days; restricted accounts 30 days.
- **Payments only, when you want to sell:**
  - VAT: registration is required above SAR 375,000 a year and voluntary above SAR 187,500, and an unregistered person mustn't issue tax invoices;
  - credit expiry;
  - refunds for partly used packs;
  - what invoice the buyer gets (Reg Art 8 lists its contents);
  - how long purchase records are kept.

## Points for the lawyer

1. **Transfers:** whether signed SDAIA SCCs, together with a risk assessment, are enough for continuous service transfers, given Transfer Regulation Art 4(2)(D)'s wording.
2. **Liability:** the Terms §10. There's no cap and no blanket exclusion. Check that the stated limits are enforceable under Saudi law.
3. **Disputes:** Saudi law and the competent Saudi courts (§12). No arbitration.
4. **Output rights:** the Terms §5. They rest on fal's terms: no ownership claim and no commercial restriction, and the model is listed "Commercial use". Kling's own API terms (user owns output, commercial use unrestricted) bind Kling's direct customers; whether they apply through fal is unconfirmed.
5. **fal's Supplemental API terms:** these require end-user terms at least as protective as fal's. Check the Terms and AUP against them.
6. **Freelance activity scope** (above).
7. **Business buyers:** whether they count as consumers (the Law's definition covers legal persons). The policy treats them as covered.

## Sources (checked 17 Nov 2026)

- **PDPL, Implementing Regulation, Transfer Regulation, SCCs, Risk Assessment Guideline and National Register Rules:** dgp.sdaia.gov.sa knowledge centre.
- **E-Commerce Law:** misa.gov.sa (official translation). Implementing Regulation (Ministerial Resolution 200, 1441H): the consolidated copy at qadha.org.sa (secondary).
- **Freelance programme:** freelance.sa.
- **VAT:** ZATCA SME and Retail guidelines.
- **Providers:** Railway, Resend and fal legal pages and docs (listed in `docs/compliance/transfers.md`). Kling: kling.ai API terms (21 Apr 2026).
