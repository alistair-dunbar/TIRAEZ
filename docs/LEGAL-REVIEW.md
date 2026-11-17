# Legal pages: status, open facts and launch blockers

Written 17 November 2026. This is engineering groundwork, not legal advice. The drafts describe how the
code actually behaves. A qualified lawyer needs to review them before they are published, especially on
the Saudi points below. Nothing here, and nothing on the site, should be described as "fully compliant".

## How publishing works

- **Where the drafts live.** The policy text is in `legal/*.md`. Facts come from `config/business.json`, `config/legal.json` and `config/retention.json`.
- **Unconfirmed facts.** Any fact still `null` (or retention periods not yet confirmed) shows in development as a highlighted "to confirm" mark.
- **In production**, a policy page only shows its text when **both** of these hold:
  - `config/legal.json` has `"status": "published"`;
  - no fact is left unconfirmed.

  Until then, each policy page says it is being prepared, and **new accounts can't be opened**. They would have to agree to terms that don't exist yet.
- **Previewing.** `LEGAL_PREVIEW=1` shows the drafts with a "not in force" banner. Use it only on a deployment that isn't public.
- **Changing the terms.** Change the terms version in `config/legal.json` whenever the terms text changes. Signed-in users are then asked to accept the new version before they upload or generate again.

## Facts the founders must supply (`config/business.json`)

| Field | What's needed | Why |
|---|---|---|
| Legal entity | `legalName`, `entityType`, `country` | Who users contract with. PDPL notice (IR Art 4). E-Commerce Law Art 6. |
| Commercial registration | `registrationNumber` | E-Commerce Law Art 6 ("if any"). Art 15 requires e-shops to be in the Commercial Register. |
| VAT | `vatNumber`: write "Not registered" if that is the case | E-Commerce Regulation (tax number, if any). |
| Address | `address` (postal) | E-Commerce Law Art 6. SDAIA privacy-policy guideline. |
| Contact emails | `supportEmail`, `privacyEmail`, `abuseEmail`; they can be the same mailbox | Contact, rights requests, complaints, reports. |
| Law and disputes | `governingLaw`, `disputes` | The terms. **No arbitration clause has been drafted**, and none should be added without advice. |

## Decisions the founders must make (`config/legal.json` → `unresolved`)

Each one is written as a full sentence, which goes into the policy as it is.

| Key | Decision | Notes from research |
|---|---|---|
| `vatTreatment` | Are prices VAT-inclusive, or are you not VAT-registered? | VAT is 15%. Registration is mandatory above SAR 375,000 a year and voluntary above SAR 187,500. Advertised prices must include VAT (ZATCA retail guideline §4.2.1). |
| `creditExpiry` | Do credits expire? | No rule found requiring expiry. Never expiring is simplest to explain. |
| `unusedCreditRefunds` | The cancellation and refund policy for unused credits | E-Commerce Law Art 13 gives consumers **7 days to cancel** where they haven't "received the service". Unused credits probably fall inside that. **Needs legal review.** The Regulation also requires the cancellation steps to be stated, or a statement that the right doesn't apply. |
| `invoices` | What invoice or receipt buyers get | E-Commerce Law Art 8 requires an itemised invoice. Whether Moyasar's receipt is enough is not verified. |
| `paymentRecordRetention` | How long purchase records are kept after an account is deleted | Tax and accounting duties. Confirm the period with an accountant. |
| `deletedAccountRetention` | Anything else kept after deletion | At present: nothing except purchase rows. |
| `backupRetention` | Railway backups and their lifetime | Not checked. See `docs/SECURITY.md`. |
| `providerAgreement` | Railway's log retention and its data processing agreement | Railway keeps logs in US West. Its agreement uses EU standard contractual clauses (SCCs). |
| `transferSafeguards` | The legal basis for sending data to the US | **Launch blocker** (see below). |
| `emailProvider` | The name and description of the email delivery provider, once chosen | The code is ready for Resend. From its documents, checked 17 Nov 2026: Resend is a processor under its DPA; data is processed mainly in the United States; customer data is deleted within 90 days of account termination; EU standard contractual clauses and the EU-US Data Privacy Framework apply. Not verified: its retention of email content and logs while the account is active, and whether content is used for model training. Get both in writing before naming it. |
| `outputLicence` | The rights users get in generated videos, and the model provider's content rules | fal's model page shows a "Commercial use" badge for Kling v4. No Kling-specific licence was found. |
| `liabilityCap` | Any limit on liability | No blanket exclusions were drafted. A cap needs legal advice. |
| `supervisoryAuthority` | Which regulator to name, and how to complain to it | SDAIA under the PDPL. |
| `rightsResponseTime` | The response time for privacy requests | Suggested wording, matching PDPL IR Art 3: "We reply within 30 days. If we need longer, we will tell you why within that time and take no more than 30 more days." |
| Each document's `effective` date | Set when published | |

Also set `config/retention.json` → `"confirmed": true` once the founders accept these periods: unused photos deleted after 7 days, and copies held by the provider expiring after 24 hours.

## What each rule rests on

| Rule in the product | Type | Basis |
|---|---|---|
| 18 or over, with age asked in whole years | Provider contract, and product policy | fal's terms require end users of products built on fal to be 18+, or the local age of majority. In Saudi Arabia, majority is 18 Hijri years (Civil Transactions Law Art 12(2)). The PDPL requires consent from someone with full legal capacity. |
| The exact age is not stored | Best practice (data minimisation) | The PDPL limits collection to what is necessary. |
| Separate, unticked boxes for the terms and for 18+ | Best practice | PDPL Art 7: consent can't be bundled as a condition of service. The privacy notice is information, not consent. |
| Records of the terms version and acceptance time | Best practice, and evidence | |
| Privacy notice contents | Legal requirement where the PDPL applies | Law Arts 12–13 and IR Art 4. Purposes, legal basis, recipients, transfers abroad, retention, rights, required vs optional data and controller contact are drafted. The controller contact still needs the facts above. |
| Data download, correction, deletion | Legal requirement (PDPL Art 4) | Built into the account page. |
| No cookie banner | Legal assessment | Only the sign-in cookie and two session-storage keys for features the user asks for. Under PECR as amended (in force 5 Feb 2026), strictly necessary storage needs no consent. Treating the form draft as necessary is our reading. The ICO guidance doesn't name it. No analytics are used. |
| Reminder to label AI ads | Platform rule, and best practice | TikTok requires disclosure for fully AI-generated ads (ads policy, Nov 2026). Meta's rules for ordinary commercial ads are not verified. No binding Saudi labelling rule was found. SDAIA's deepfake guidelines are guidance only. |
| Report form and review queue | Best practice, and provider terms | fal's acceptable use policy bans deepfakes, using a likeness without consent, and infringement. |
| Price shown before paying, no subscriptions | Legal requirement (E-Commerce Law Art 7) | The confirm button should make clear that clicking creates an obligation to pay (Regulation Art 7, from a secondary source). Today it reads "Buy 15 credits for SAR 250". |
| Business identity on the contact page | Legal requirement (E-Commerce Law Art 6) | Needs the facts above. |

## Launch blockers

1. **Business identity facts** (table above). Without them, no policy can be published.
2. **Transfers outside Saudi Arabia.**
   - Railway (US) and fal (US and other countries) both receive personal data.
   - The PDPL Transfer Regulation requires either an adequacy decision (no list was found on SDAIA's site) or safeguards such as SDAIA's standard clauses. A risk assessment is required before the transfer (Art 7).
   - Both providers' agreements use the **EU** clauses, not SDAIA's. Whether they would sign SDAIA's clauses is not verified.
   - Draft PDPL amendments (consultation closed 5 Nov 2026, **not in force**) would add data-localisation rules and registration for controllers that transfer data abroad. Watch for adoption.
3. **SDAIA national register of controllers.** Registration is mandatory if the controller's "main activity is based on processing personal data". Whether this service counts **needs legal review**.
4. **Data protection officer.** Probably not required, as there is no systematic monitoring and no sensitive data. **Confirm with counsel.**
5. **Documented assessments.** The policy relies on contract and legal duties, not legitimate interest. Relying on legitimate interest would first need a documented assessment (IR Art 16).
6. **The refund, cancellation, VAT and invoice decisions** above.
7. **No email provider configured.** Confirmation, reset and email change are built and tested against a sandbox. Sign-ups stay closed until a provider is set up (`docs/DEPLOY.md`, "Account emails").

## Registration as built (17 Nov 2026)

- **Fields:** name (one field, any language), email, password, and age in whole years.
- **Agreements:** two separate unticked boxes, one for the terms and one for 18+. The privacy notice is shown as information, not as a consent.
- **Marketing consent:** none, because no marketing is sent.
- **Recorded at sign-up:**
  - the terms version and server timestamp;
  - the privacy version shown;
  - the adult-eligibility result, the method (`self_declared`) and the time. **The age itself isn't stored.**
- **Not collected:** IP addresses.
- **Age is self-declared.** The product doesn't claim this verifies identity or stops a minor from giving a false age.
- **Email:** must be confirmed before uploads, generation and purchases. An unconfirmed account can sign in, look at, export and delete its data. It is deleted after 30 days if nothing was bought (`config/retention.json`, still to be confirmed).
- **Password reset:** gives the same answer whether or not an account exists. Links are single-use, last 1 hour and are stored only as hashes. A successful reset signs out every session.
- **No social sign-in** exists, so there is no OAuth onboarding path.

## Points for the lawyer

- Do unused prepaid credits fall under the 7-day cancellation right?
- Signing up reveals whether an email already has an account ("There's already an account with this email"). Password reset doesn't. Decide whether sign-up should also give a neutral answer.
- Do business buyers count as "consumers" under the E-Commerce Law? The definition doesn't exclude legal persons.
- The deletion rule at onboarding: an existing account whose holder says they are under 18 is closed and its data deleted at once. That matches the policy text, but it's a product decision worth confirming.
- fal's terms say its APIs must not be exposed directly to end users and the service must not be resold. Tiraez is a product built on fal, which those terms contemplate. Confirm.
- fal's terms let it use anonymised or aggregated usage data, which may come from inputs, to develop its services, including AI models. The privacy policy says so. Tiraez itself doesn't train on user content.
- Kling-specific licence terms for commercial use of outputs.
- Whether to add visible watermarks or metadata to generated videos. SDAIA's deepfake guidelines recommend them, but they are not binding.

## Sources checked on 17 Nov 2026

- **PDPL** (M/19, amended by M/148) and its Implementing Regulation, Transfer Regulation, National Register Rules and Privacy Policy Guideline: all at https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter
- **Civil Transactions Law** (M/191): https://misa.gov.sa/app/uploads/2025/07/Civil-Transactions-Law.pdf
- **E-Commerce Law** (M/126): https://misa.gov.sa/app/uploads/2025/07/E-Commerce-Law.pdf. The Implementing Regulation was only seen through a secondary source.
- **ZATCA** SME guide and Retail Sector VAT guideline (Issue 3, May 2026): zatca.gov.sa
- **Data (Use and Access) Act 2025** Sch 12, SI 2026/82 and ICO storage-and-access guidance (29 Apr 2026): legislation.gov.uk, ico.org.uk
- **fal:** privacy policy (22 Jul 2026), terms (8 Sep 2026), data processing agreement (31 Jul 2026) and acceptable use policy at fal.ai/legal; media-expiration and common-parameters docs.
- **Railway:** privacy policy (20 Apr 2026) and data processing agreement at railway.com/legal; regions documentation.
- **TikTok:** community guidelines (24 Sep 2026) and ads policy (Nov 2026). **Meta:** AI labelling announcements and SIEP ad standards.
- **SDAIA:** Deepfakes Guidelines (2025).
