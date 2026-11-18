// Everything that varies by business decision lives in config/*.json, read once at start-up.
import { readFileSync } from "node:fs";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../config/${name}`, import.meta.url), "utf8"));

export interface SiteConfig { brandName: string; showPricing: boolean; contactEmail: string | null }
export interface PricingConfig { currency: string; creditsByDuration: Record<string, number> }
export interface GenerationConfig {
  upload: { maxBytes: number; minShortSide: number; maxLongSide: number };
  maxActiveJobsPerUser: number;
  statusStaleAfterSeconds: number;
  giveUpAfterMinutes: number;
}
export interface ModelConfig {
  provider: string;
  endpoint: string;
  usdPerSecond: number;
  image: { minWidth: number; minHeight: number; minAspect: number; maxAspect: number; maxBytes: number };
  supports: { minDuration: number; maxDuration: number; resolutions: string[]; negativePrompt: boolean; audio: boolean };
  aspectRatioFromImage: boolean;
}

export const site: SiteConfig = read("site.json");
export const pricing: PricingConfig = read("pricing.json");
export const generation: GenerationConfig = read("generation.json");
export const models: Record<string, ModelConfig> = read("models.json");

/** Credits a video of this length costs, or null when no price is configured for it. */
export function creditsFor(duration: number): number | null {
  const c = pricing.creditsByDuration[String(duration)];
  return Number.isInteger(c) && c > 0 ? c : null;
}
