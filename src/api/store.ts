// Storage behind the core API. v1 is in memory, loaded from fixtures/ (this is what the
// mock server for Part B runs on). A1 adds a Postgres implementation of CoreStore.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { repoPath } from "../data.ts";
import type {
  AgencyRecord,
  Lead,
  LeadEvent,
  LeadEventInput,
  LeadQualification,
  LeadUpsert,
  ListingRecord,
  ListingSearch,
} from "./types.ts";

export interface CoreStore {
  getAgency(id: string): Promise<AgencyRecord | null>;
  searchListings(q: ListingSearch): Promise<{ total: number; results: ListingRecord[] }>;
  upsertLead(input: LeadUpsert): Promise<{ lead: Lead; created: boolean }>;
  getLead(id: string): Promise<Lead | null>;
  addEvent(leadId: string, input: LeadEventInput): Promise<LeadEvent | null>;
  listEvents(leadId: string): Promise<LeadEvent[]>;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const normEmail = (s?: string | null) => (s ? s.trim().toLowerCase() : null);
/** Digits only, without a leading 00, so "+34 600 111 222" and "0034600111222" match. */
export const normPhone = (s?: string | null) => (s ? s.replace(/\D/g, "").replace(/^00/, "") || null : null);

const EMPTY_QUALIFICATION: LeadQualification = { budget: null, area: null, timing: null, travel_dates: null, financing: null };

export interface MemoryStoreOptions {
  agencies: AgencyRecord[];
  listings: ListingRecord[];
  /** Injectable for deterministic contract examples and tests. */
  newId?: (prefix: string) => string;
  now?: () => Date;
}

export class MemoryCoreStore implements CoreStore {
  private readonly agencies: Map<string, AgencyRecord>;
  private readonly listings: ListingRecord[];
  private readonly leads = new Map<string, Lead>();
  private readonly events = new Map<string, LeadEvent[]>();
  private readonly newId: (prefix: string) => string;
  private readonly now: () => Date;

  constructor(opts: MemoryStoreOptions) {
    this.agencies = new Map(opts.agencies.map((a) => [a.id, a]));
    this.listings = opts.listings;
    this.newId = opts.newId ?? ((prefix) => `${prefix}_${randomBytes(6).toString("hex")}`);
    this.now = opts.now ?? (() => new Date());
  }

  /** Test agency and its 20 listings from fixtures/. */
  static fromFixtures(opts: Partial<MemoryStoreOptions> = {}): MemoryCoreStore {
    const read = <T>(rel: string) => JSON.parse(readFileSync(repoPath(rel), "utf8")) as T;
    return new MemoryCoreStore({
      agencies: [read<AgencyRecord>("fixtures/agency.json")],
      listings: read<ListingRecord[]>("fixtures/listings.json"),
      ...opts,
    });
  }

  async getAgency(id: string) {
    return this.agencies.get(id) ?? null;
  }

  async searchListings(q: ListingSearch) {
    const matches = this.listings
      .filter((l) => l.agency_id === q.agency_id)
      .filter((l) => q.include_sold || l.status !== "sold")
      .filter((l) => !q.ref || l.ref.toUpperCase() === q.ref.trim().toUpperCase())
      .filter((l) => !q.town || fold(l.town) === fold(q.town) || (l.area !== null && fold(l.area) === fold(q.town)))
      .filter((l) => !q.type || l.type === q.type)
      .filter((l) => q.min_price_eur === undefined || l.price_eur >= q.min_price_eur)
      .filter((l) => q.max_price_eur === undefined || l.price_eur <= q.max_price_eur)
      .filter((l) => q.min_beds === undefined || l.beds >= q.min_beds)
      .filter((l) => q.pool === undefined || l.pool === q.pool)
      .sort((a, b) => a.price_eur - b.price_eur);
    return { total: matches.length, results: matches.slice(0, q.limit ?? 5) };
  }

  async upsertLead(input: LeadUpsert) {
    const email = normEmail(input.email);
    const phone = normPhone(input.phone);
    const nowIso = this.now().toISOString();

    // A caller who emailed earlier joins the same lead: match on email or phone within the agency.
    const existing = [...this.leads.values()].find(
      (l) =>
        l.agency_id === input.agency_id &&
        ((email !== null && normEmail(l.email) === email) || (phone !== null && normPhone(l.phone) === phone)),
    );

    if (existing) {
      existing.name = input.name ?? existing.name;
      existing.email = input.email?.trim() ?? existing.email;
      existing.phone = input.phone?.trim() ?? existing.phone;
      existing.language = input.language ?? existing.language;
      existing.listing_ref = input.listing_ref ?? existing.listing_ref;
      existing.status = input.status ?? existing.status;
      for (const [k, v] of Object.entries(input.qualification ?? {})) {
        if (v !== null && v !== undefined) existing.qualification[k as keyof LeadQualification] = v;
      }
      existing.updated_at = nowIso;
      return { lead: existing, created: false };
    }

    const lead: Lead = {
      id: this.newId("lead"),
      agency_id: input.agency_id,
      name: input.name ?? null,
      email: input.email?.trim() ?? null,
      phone: input.phone?.trim() ?? null,
      language: input.language ?? null,
      listing_ref: input.listing_ref ?? null,
      source_channel: input.channel,
      status: input.status ?? "new",
      qualification: { ...EMPTY_QUALIFICATION, ...(input.qualification ?? {}) },
      first_contact_at: nowIso,
      first_reply_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.leads.set(lead.id, lead);
    this.events.set(lead.id, []);
    return { lead, created: true };
  }

  async getLead(id: string) {
    return this.leads.get(id) ?? null;
  }

  async addEvent(leadId: string, input: LeadEventInput) {
    const lead = this.leads.get(leadId);
    if (!lead) return null;
    const event: LeadEvent = {
      id: this.newId("evt"),
      lead_id: leadId,
      type: input.type,
      channel: input.channel,
      at: input.at ?? this.now().toISOString(),
      body: input.body ?? null,
      meta: input.meta ?? {},
    };
    this.events.get(leadId)!.push(event);
    if (event.type === "message_out" && !lead.first_reply_at) lead.first_reply_at = event.at;
    if (event.type === "opt_out") lead.status = "suppressed";
    if (event.type === "handoff" && lead.status !== "suppressed") lead.status = "needs_human";
    lead.updated_at = this.now().toISOString();
    return event;
  }

  async listEvents(leadId: string) {
    return this.events.get(leadId) ?? [];
  }
}
