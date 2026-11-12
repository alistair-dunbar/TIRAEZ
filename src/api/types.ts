// Types for the core API (contract v1). The JSON Schemas in contract/schemas are
// the source of truth for Part B; these mirror them for Part A's code.
import type { AgencyConfig, Qualification } from "../types.ts";

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  languages: string[];
}

/** Opening hours per weekday as [open, close] pairs in the agency's time zone. */
export type OfficeHours = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string][]>;

/** Agency settings as stored and returned by GET /agency/{id}. Superset of the demo's AgencyConfig. */
export interface AgencyRecord extends AgencyConfig {
  id: string;
  timezone: string;
  summary_language: string;
  agents: Agent[];
  office_hours: OfficeHours;
  feed: { format: "kyero"; url: string };
}

export type ListingStatus = "available" | "reserved" | "sold";

export interface ListingRecord {
  agency_id: string;
  ref: string;
  title: string;
  type: string;
  town: string;
  area: string | null;
  province: string;
  price_eur: number;
  beds: number;
  baths: number;
  built_m2: number;
  plot_m2: number | null;
  pool: boolean;
  features: string[];
  status: ListingStatus;
  url: string;
  description_en: string;
  updated_at: string;
}

export interface ListingSearch {
  agency_id: string;
  ref?: string;
  town?: string;
  type?: string;
  min_price_eur?: number;
  max_price_eur?: number;
  min_beds?: number;
  pool?: boolean;
  include_sold?: boolean;
  limit?: number;
}

export type Channel = "email" | "portal" | "web" | "whatsapp" | "phone";
export type LeadStatus = "new" | "in_conversation" | "needs_human" | "suppressed";

export interface LeadQualification extends Qualification {
  financing: string | null;
}

export interface Lead {
  id: string;
  agency_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  listing_ref: string | null;
  source_channel: Channel;
  status: LeadStatus;
  qualification: LeadQualification;
  first_contact_at: string;
  first_reply_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadUpsert {
  agency_id: string;
  channel: Channel;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  language?: string | null;
  listing_ref?: string | null;
  status?: LeadStatus;
  qualification?: Partial<LeadQualification>;
}

export type EventType =
  | "message_in"
  | "message_out"
  | "draft_ready"
  | "call_started"
  | "call_ended"
  | "handoff"
  | "opt_out"
  | "note";

export interface LeadEvent {
  id: string;
  lead_id: string;
  type: EventType;
  channel: Channel;
  at: string;
  body: string | null;
  meta: Record<string, unknown>;
}

export interface LeadEventInput {
  type: EventType;
  channel: Channel;
  at?: string;
  body?: string | null;
  meta?: Record<string, unknown>;
}
