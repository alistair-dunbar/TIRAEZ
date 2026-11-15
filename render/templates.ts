import { readFileSync, readdirSync } from "node:fs";
import type { Placement } from "./ffmpeg.ts";

export interface ScenePrompt { still: string; motion: string }

export type Template =
  | { id: string; mode: "composite"; subject?: string; placement: Placement; scenes: ScenePrompt[] }
  | { id: string; mode: "pan" };

const DIR = new URL("../templates/", import.meta.url);

export function templateIds(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
}

export function loadTemplate(id: string): Template {
  if (!templateIds().includes(id)) {
    throw new Error(`Unknown template "${id}". Available: ${templateIds().join(", ")}`);
  }
  return JSON.parse(readFileSync(new URL(`${id}.json`, DIR), "utf8"));
}

/** Per-scene settings saved next to each scene clip (placement can be tuned per scene). */
export interface SceneInfo {
  template: string;
  index: number;
  still: string;
  motion: string;
  stillFile: string;
  videoFile: string;
  placement?: Partial<Placement>;
  costUsd: number;
}
