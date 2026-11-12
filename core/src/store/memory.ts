import { randomUUID } from "node:crypto";
import type { EnquiryStore, StoredEnquiry } from "./types.ts";

/** Stub store: in-memory, lost on restart. */
export class MemoryStore implements EnquiryStore {
  private readonly items: StoredEnquiry[] = [];

  async save(record: Omit<StoredEnquiry, "id">): Promise<StoredEnquiry> {
    const stored = { id: randomUUID(), ...record };
    this.items.unshift(stored);
    return stored;
  }

  async get(id: string): Promise<StoredEnquiry | null> {
    return this.items.find((i) => i.id === id) ?? null;
  }

  async list(limit = 50): Promise<StoredEnquiry[]> {
    return this.items.slice(0, limit);
  }
}
