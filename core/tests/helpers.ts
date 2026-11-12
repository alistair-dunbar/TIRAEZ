import "../src/env.ts";
import { readFileSync } from "node:fs";
import { loadConfig, loadListings, repoPath } from "../src/data.ts";
import { loadSamples } from "../src/samples.ts";

export const config = loadConfig();
export const listings = loadListings();
export const samples = loadSamples();

export function fixture(name: string): string {
  return readFileSync(repoPath(`tests/fixtures/${name}`), "utf8");
}

export const HAS_API_KEY = Boolean(process.env.ANTHROPIC_API_KEY);
export const SKIP_LIVE = HAS_API_KEY
  ? false
  : "ANTHROPIC_API_KEY is not set - skipping live API tests. Add the key to .env (local) or your cloud environment's settings, then run npm test again.";
