// Storage interface. v0 keeps enquiries in memory; swap for Postgres/SQLite/a CRM later.
import type { InboundEnquiry } from "../channels/types.ts";
import type { EnquiryResult } from "../types.ts";

export interface StoredEnquiry {
  id: string;
  inbound: InboundEnquiry;
  result: EnquiryResult | null;
  error: string | null;
}

export interface EnquiryStore {
  save(record: Omit<StoredEnquiry, "id">): Promise<StoredEnquiry>;
  get(id: string): Promise<StoredEnquiry | null>;
  list(limit?: number): Promise<StoredEnquiry[]>;
}
