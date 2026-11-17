# Personal data sent outside Saudi Arabia: what applies, what's missing, what to do

Prepared 17 November 2026 from the official texts, which were read in full: the PDPL (M/19, amended M/148); the Regulation on Personal Data Transfer Outside the Kingdom v2.0 (Aug 2024); SDAIA's Standard Contractual Clauses v1.0 (Sep 2024); and SDAIA's Risk Assessment Guideline for transfers (Feb 2025). The provider facts come from each provider's own terms and documentation (sources at the end).

**This is preparation for the operator and a lawyer, not legal advice.** Nothing here has been signed or submitted.

## The requirement, step by step

1. **A permitted purpose (PDPL Art 29(1)).** Tiraez qualifies. Its transfers are "to the performance of an obligation to which the Data Subject is a party" (Art 29(1)(c)), and "to provide a service or benefit to the subject of the personal data" (Transfer Regulation Art 2(2)).
2. **The conditions in Art 29(2).** The transfer must not prejudice national security (a). It needs an adequate level of protection in the destination, "according to the results of an assessment conducted by" SDAIA (b). And it must be limited to the minimum data needed (c).
3. **No adequacy list yet.** SDAIA hasn't published its adequacy list, the one Transfer Regulation Art 3 requires, as of the latest checks found (Sept 2026). That comes from secondary sources: no list was found on SDAIA's own pages. So condition (b) can't currently be met by relying on a list.
4. **The exemption route (Transfer Regulation Art 4).** A controller can be exempted from (b) and (c) only in the listed cases, and only with "appropriate safeguards": SDAIA standard contractual clauses, binding common rules, or an accreditation certificate.
   - The case closest to Tiraez is **4(2)(D)**: "to provide a service or benefit directly to the data subject". It requires the recipient to hold "an approval certificate from a body licensed by the competent authority". None of our providers is known to hold one.
   - **SDAIA's standard contractual clauses** say they "are one of the appropriate safeguards that Controllers and Processors may use". They apply when transferring "to a country … that does not have an appropriate level of Personal Data protection".
   - **Open question for the lawyer:** whether signed SDAIA SCCs are enough for a case like ours, given Art 4(2)(D)'s wording.
5. **A risk assessment, before the transfer (Transfer Regulation Art 7).** It's required for every transfer made under Art 4, and has six required elements (A–F). SDAIA provides a tool for it on the National Data Governance Platform.
6. **Tell people (PDPL Art 13).** The privacy notice must say that data is transferred outside the Kingdom. It already says where each provider stores data.

**What this means for Tiraez:** every account sign-up sends personal data to Railway (US) and Resend (US), and every video sends a photo and instructions to fal and Kling (US and elsewhere). Until a safeguard and a risk assessment are in place for those recipients, the code keeps the affected operations off in production:
- `config/compliance.json` keeps sign-ups closed and generation off;
- `npm run launch-check` lists what's missing.

## The providers, one by one

| | Railway (hosting) | Resend (account email) | fal.ai and Kling (video model) |
|---|---|---|---|
| **Data sent** | Everything the service stores: account, eligibility and agreement records, photos, inputs, videos, credit and purchase records, reports, logs | Email address and the text of account emails (links to confirm, reset or change) | The framed photo and the generation instructions. No name, email or account id |
| **Where** | US West (California). Logs in the US. Railway has **no Middle East region** (its regions are US West, US East, EU West in Amsterdam, and Singapore) | All account data, logs and metadata stored in the US, whatever sending region is chosen | fal: "the United States and other countries", not named. Kling: unknown |
| **Role** | Processor (Railway DPA). Independent controller for its own account data | Processor (Resend DPA) | Processor (fal DPA). fal passes partner-model requests to the model's developer ("Client Content will be transferred to such a third party") |
| **What its contract offers** | EU SCCs (2021/914), UK Addendum, EU-US DPF. SOC 2 Type 2 (trust centre). Daily backups, retention not published | EU SCCs, EU-US DPF. SOC 2 Type II. Email data kept 30 days on paid plans, backups 7 days | EU SCCs (Module 2), UK IDTA. Request history off with `X-Fal-Store-IO: 0` (default 90 days). Files expire after 24h (we set this). No training on Client Content for "enterprise ready" models; Kling 4.0 is marked ready |
| **What's missing for Saudi law** | SDAIA SCCs (or SDAIA accreditation), and a risk assessment | Same | Same, for fal. Plus where Kling processes data |
| **Data minimisation already done** | Only what the service needs. Ages never stored. Unused photos deleted after 7 days. Unconfirmed accounts deleted after 30 days | Emails carry no names and no tracking. Only account emails are sent | Only the cropped photo, stripped of metadata. No identity data. Shortest storage options set |

EU clauses alone neither prove nor rule out compliance with the Saudi rules. The PDPL asks for SDAIA's safeguards, or an exemption case that fits, and a provider's EU clauses aren't one of those.

## What to do (in order)

1. **Register as a controller.** The Rules Governing the National Register of Controllers (Art 2(4)) make registration mandatory for "the individual [who] processes personal data for purposes exceeding personal or family use". That's you, running Tiraez.
   - Register at https://dgp.sdaia.gov.sa. You'll need an official email address and contact number (Art 5).
   - The portal's public menu shows Government, Private, Outside-Kingdom and Non-Profit routes. If there's no individual route, use the Private route or ask SDAIA through the platform.
   - Then put the certificate number in `config/legal.json` → `unresolved.controllerRegistration`. For example: "We are registered in SDAIA's National Register of Controllers, certificate number …."
2. **Ask each provider to sign SDAIA's standard contractual clauses** (controller-to-processor). Send the SCC document from the SDAIA knowledge centre (https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter), with Appendices 1 to 3 filled from the table above.
   - Railway: from the dashboard's support or Enterprise contact.
   - Resend: support@resend.com or privacy@resend.com.
   - fal: fal sales or enterprise.
   - The clauses must not be modified, apart from the blank fields. Self-serve plans may be refused. If a provider refuses, see "Alternatives" below.
   - **Suggested message:** "We operate in Saudi Arabia and act as a controller under the Saudi PDPL. To continue using your service for personal data of people in Saudi Arabia, we need the Standard Contractual Clauses issued by the Saudi Data & AI Authority (attached) signed alongside your DPA. Can you sign them, or tell us whether you hold an SDAIA-recognised accreditation certificate?"
3. **Complete the risk assessment**, using SDAIA's tool on the platform or the six elements of Transfer Regulation Art 7(2). The draft below covers each element. Keep the finished assessment on file.
4. **Record what's done** in `config/compliance.json`:
   - `mechanism`: for example "SDAIA SCCs signed by Railway on 2027-01-10";
   - `riskAssessment`: for example "transfer-risk-assessment-v1.pdf, 2027-01-12".

   Then put a one-sentence summary in `unresolved.transferSafeguards`, for example: "We send this data under the Standard Contractual Clauses issued by SDAIA, signed with each provider, after assessing the risks as the law requires."
5. **Run `npm run launch-check`** with the production settings.

## Draft risk assessment (Transfer Regulation Art 7(2))

- **A. Purpose and legal basis.** To provide the Tiraez service the person signed up for: hosting their account and content, emailing them about their account, and generating their videos. Basis: PDPL Art 29(1)(c) (an obligation to which the data subject is a party) and Transfer Regulation Art 2(2). Processing is based on the agreement with the user (PDPL Art 6(2)).
- **B. Nature and geography.**
  - Hosting: continuous, all service data, United States.
  - Email: per message, address plus message text, United States.
  - Generation: per video, photo plus instructions, United States and other countries not named by fal.
  - Collection is from the data subject only, through web forms and photo upload. One session cookie; no analytics.
- **C. Safeguards.** [The signed SDAIA SCCs per provider, once obtained.] Plus:
  - the providers' DPAs (processor duties, security, breach notice, deletion on termination);
  - SOC 2 reports for Railway and Resend;
  - encryption in transit;
  - per-user authorisation, hashed credentials, no identity data sent to fal.
- **D. Minimisation.**
  - The age isn't stored, only the 18+ result.
  - Photos are re-encoded without metadata, and only the crop is sent.
  - fal request history is off and its files are deleted after 24h.
  - Unused photos are deleted after 7 days, and unconfirmed accounts after 30 days.
  - Emails carry no names.
  - A deleted account removes everything except anonymous purchase rows.
- **E. Possible effects and likelihood.**
  - Disclosure of an email address or of product photos through a provider breach: low to moderate harm. Spam or phishing risk; photos are usually of products.
  - Access by foreign public authorities under US law: likelihood low for this data; impact moderate.
  - Photos showing people: higher impact; users are told not to upload them without permission.
  - No sensitive data is collected by design.
- **F. Measures.**
  - Keep the minimisation above.
  - Breach handling in `docs/SECURITY.md`, including telling SDAIA within 72 hours (Implementing Regulation Art 24).
  - Review this assessment yearly, and when a provider or its terms change.
  - Stop the transfer if a safeguard stops applying (Transfer Regulation Art 6).

## Alternatives, if a provider won't sign

- **Host in Saudi Arabia.** Removes the Railway transfer, the largest one. Options include:
  - Oracle Cloud (Jeddah, Riyadh);
  - Google Cloud Dammam (only through CNTXT for Saudi customers);
  - Alibaba Cloud Riyadh (partner region);
  - Azure Saudi Arabia East (announced for November 2026, not confirmed live).

  The app is a single Node process with SQLite and a disk, so moving it means a VM or container, a persistent disk, TLS and a DNS change. That's about one to two days of work, plus a monthly cost of a small VM (typically tens of US dollars) instead of Railway. Resend and fal would still be outside the Kingdom, so their safeguards are still needed.
- **Email:** a provider that will sign SDAIA SCCs, or one hosted in the Kingdom, replaces Resend with a small change to `app/mail.ts`.
- **Video model:** no in-Kingdom option is known for this model. Generation stays off until fal's transfer is covered. That doesn't block accounts, because the code gates the two separately.

## Sources

- **Railway:** https://docs.railway.com/reference/deployment-regions, https://railway.com/legal/dpa, https://docs.railway.com/guides/logs, https://trust.railway.com/
- **Resend:** https://resend.com/docs/dashboard/domains/regions, https://resend.com/legal/dpa, https://resend.com/docs/security, https://resend.com/pricing
- **fal:** https://fal.ai/legal/data-processing-addendum (31 Jul 2026), https://fal.ai/legal/terms-of-service (8 Sep 2026), https://fal.ai/legal/api-services, https://fal.ai/docs/documentation/model-apis/media-expiration, https://fal.ai/models/kling/v4/image-to-video
- **SDAIA documents:** https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter
