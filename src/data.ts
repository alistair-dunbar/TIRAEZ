import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AgencyConfig, Listing } from "./types.ts";

const root = resolve(import.meta.dirname, "..");

function readJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(resolve(root, relPath), "utf8")) as T;
}

export function loadConfig(path = process.env.AGENCY_CONFIG || "config/agency.demo.json"): AgencyConfig {
  return readJson<AgencyConfig>(path);
}

export function loadListings(path = "data/listings.json"): Listing[] {
  return readJson<Listing[]>(path);
}

export function findListing(listings: Listing[], ref: string | null): Listing | null {
  if (!ref) return null;
  const wanted = ref.trim().toUpperCase();
  return listings.find((l) => l.ref.toUpperCase() === wanted) ?? null;
}

export function repoPath(rel: string): string {
  return resolve(root, rel);
}
