# Part A (revised): core platform and text responder

Revised on 2026-11-12 after a council review of the original Part A plan.

Target by Dec 18: **one pilot agency, email only, on the existing code, starting in shadow mode.**
The Dec 7 join date with Part B (the phone receptionist, built by Dakhil) is still open and needs
agreeing between the two founders.

## The four changes from the original

- **Stack:** keep the current Node/TypeScript repo and its tests. Use a managed EU host and managed
  Postgres. No n8n, Docker or self-run server.
- **Rules:** the 7 agreed reply rules in CLAUDE.md apply unchanged (90 words, booking link, legal and
  mortgage questions go to a human).
- **Rollout:** shadow mode first, then auto-send for routine replies only, with an off switch.
- **Scope:** one agency, one inbox, one feed format (Kyero). Everything else waits until a pilot asks for it.

## A0: Go live and agree the contract (Nov 13 to 15, with B)

**Done means:** a real AI reply works, the contract is agreed, and the slow external items are started.
**Hands to B:** the contract, a mock API and the fixtures.

- [ ] Add Claude API credit with a spending cap, fix the 403, and run the live tests until they pass
- [ ] Merge the demo PR into `main`
- [ ] Write the contract for four endpoints only: `GET /agency/{id}`, `POST /listings/search`,
      `POST /leads/upsert`, `POST /leads/{id}/events`, with one example each
- [ ] Give B a mock server built from those examples, so B never waits on A
- [ ] Build the fixtures: `agency.json`, a 20-listing Kyero `feed.xml` and 30 sample emails
- [ ] Start Meta Business verification (build nothing for WhatsApp yet)
- [ ] Book the lawyer for three questions: the data processing agreement, whether the audit enquiries
      are acceptable, and the AI disclosure wording
- [ ] Decide with Dakhil whether Part B continues in parallel or pauses until a text pilot exists

## A1: Hosted core (Nov 16 to 22, demo by Nov 22)

**Done means:** the app runs on a public HTTPS address with a real database, and the test agency's
listings sync hourly.
**Hands to B and sales:** the demo videos, and the first two endpoints on a staging address.

- [ ] Deploy the existing app to a managed EU host with managed Postgres and daily backups
- [ ] Tables: `agencies`, `listings`, `leads`, `events`, `messages`
- [ ] Settings loader: `agency.json` is validated and stored
- [ ] Listing sync: Kyero XML every 60 minutes, with missing listings marked `sold`
- [ ] `GET /agency/{id}` and `POST /listings/search` with an API key check
- [ ] A `/health` check with uptime alerts to both phones
- [ ] Record the 60-second demo video in English, German and Swedish, in live mode, not offline mode

## A2: Email in, shadow mode (Nov 23 to Dec 1)

**Done means:** an email forwarded to the test agency's lead address produces a draft reply and an
agent summary within 60 seconds, logged with timestamps. Nothing is sent to buyers.
**Hands to B:** `POST /leads/upsert` and `POST /leads/{id}/events` on staging.

- [ ] Inbound: a forwarding rule from the agency inbox to `leads-<agency>@` on our domain. This needs
      an inbound email service, which is a new dependency to choose
- [ ] Parser: keep the current one, and add a Claude fallback for emails it can't read
- [ ] Language detection on the buyer's own words, not the portal's template text
- [ ] Reply writer: the current prompt and all code checks, plus a stronger fact check (every number
      and every feature must appear in the listing)
- [ ] Shadow output: the agent gets the draft and the summary by email, sent from our own domain
- [ ] Lead log: each lead and message stored, with `first_contact_at` and `draft_ready_at`
- [ ] Off switch: one setting per agency that stops all processing
- [ ] Test: all 30 sample emails, with time and correctness recorded
- [ ] Sales goal: one real agency agrees to shadow mode on its live enquiries, with the data
      agreement signed first

## A3: Auto-send and qualify (Dec 2 to 10)

**Done means:** routine replies go out automatically within 60 seconds. Anything else waits for the
agent. The assistant holds a conversation across several emails.

- [ ] Auto-send only when every code check passes and no handoff topic is found
- [ ] Approval queue: legal, tax, mortgage, residency and unknown-listing replies go to the agent as a
      draft with Approve, Edit and Reject. The buyer gets "I'll ask [agent] and come back to you" at once
- [ ] Sending route: agree it with the pilot agency. Sending from our domain with replies routed to
      the agency is the fast option. Sending from the agency's own mailbox needs Google's approval,
      which can be slow, so check the lead time now
- [ ] Threading: buyer replies continue the same lead, and the history goes into the prompt
- [ ] Qualifying: timing first, then viewing dates, with at most two questions per message
- [ ] Agent summary: 5 lines in the agent's language, by email
- [ ] Opt-out: STOP, BAJA, ABMELDEN, AVSLUTA and AFMELDEN suppress the lead

## A4: Pilot hardening (Dec 11 to 18)

**Done means:** the pilot runs unattended, failures alert us within 5 minutes, and we have proof numbers.

- [ ] Alerts: a reply over 60 seconds, a feed over 24 hours old, a parser failure, an approval waiting
      over 2 hours
- [ ] Daily check: 10 random conversations emailed to the builder each morning
- [ ] Scoreboard: enquiries, median reply time, share under 60 seconds, and AI time against the
      agent's own reply time
- [ ] On-call plan: who responds at night and over Christmas, and when to use the off switch
- [ ] Whatever B needs next from the contract, added one endpoint at a time with a changelog

## Deferred until a pilot asks

- WhatsApp inbound and templates
- Dedicated parsers for the seven portals
- Feed formats beyond Kyero
- CRM handoffs
- The onboarding form and forwarding guides
- Load tests and rate limits
- The Google Sheet view
- Viewing-request links, callbacks, the duty endpoint, SMS

## Sales and admin share (reduced)

- **Before any audit enquiry is sent:** the lawyer confirms the audit is acceptable
- **Nov 18 to 27:** send at most 40 audit enquiries and log the replies by hand or with a simple script
- **Nov 23 to Dec 5:** one video template with a short personal intro per agency, about 5 minutes each
- **By Nov 20:** the accountant's call on the legal entity and VAT
- **By Nov 27:** the lawyer signs off the client contract, the data processing agreement and the
  privacy notice. This must happen before any real buyer email is processed
- **By Dec 5:** one agency signed for shadow mode

## Go or no-go checks

- **Nov 15:** live tests pass. If not, nothing else starts.
- **Dec 1:** all 30 sample emails get a correct draft in under 60 seconds. If not, A3 waits.
- **Dec 5:** one agency has agreed to shadow mode. If not, building stops and both founders sell.
- **Dec 10:** auto-send starts only after a week of shadow drafts with no wrong facts.

## Why the plan changed (council review, Nov 12)

- The original A1 packed a self-run server, Docker, n8n, Postgres, backups, a feed sync, two endpoints,
  CI and monitoring into four days for one person new to servers, with Part B blocked on it.
- Moving to n8n would have meant rebuilding the tested legal safety checks in a tool that is harder to test.
- The original A2 rules were weaker than the agreed ones (120 words, no booking link, no legal handoff).
- A4 and A5 solved problems that only exist once several agencies have signed.
- Approving every reply by hand would break the 60-second promise at night, so shadow mode comes
  first and auto-send is limited to replies that pass every check.
