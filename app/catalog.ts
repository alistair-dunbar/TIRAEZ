// Template catalogue: one JSON file per template in catalog/templates/.
// Each file holds both public metadata and the private prompt definition; only
// publicTemplate() output ever reaches the browser.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { creditsFor, models } from "./config.ts";
import { providerReady } from "./providers/index.ts";

export interface Niche { id: string; label: string }
export interface SelectOption { value: string; label: string; prompt: string }
export interface TemplateInput {
  id: string;
  type: "text" | "select";
  label: string;
  help: string | null;
  required: boolean;
  maxLength?: number;
  example?: string;
  default?: string;
  options?: SelectOption[];
}
type PromptPart = string | { input: string };
export interface Template {
  id: string;
  slug: string;
  version: number;
  name: string;
  niche: string;
  summary: string;
  outcome: string;
  photoGuidance: string[];
  limitations: string[];
  inputs: TemplateInput[];
  output: {
    aspectRatios: string[]; defaultAspectRatio: string;
    durations: number[]; defaultDuration: number;
    resolutions: string[]; defaultResolution: string;
  };
  model: string;
  availability: "available" | "unavailable";
  preview: { asset: string | null; approved: boolean };
  prompt: Record<string, PromptPart>;
}

export const ASPECT_RATIOS: Record<string, number> = { "9:16": 9 / 16, "1:1": 1, "16:9": 16 / 9 };
const PROMPT_ORDER = ["subject", "composition", "environment", "camera", "subjectMotion", "lighting", "mood", "timing", "preserve", "preserveExtra", "avoid"];

const ROOT = new URL("../catalog/", import.meta.url);
export const niches: Niche[] = JSON.parse(readFileSync(new URL("niches.json", ROOT), "utf8"));

function check(t: Template, file: string): void {
  const fail = (why: string) => { throw new Error(`catalog/templates/${file}: ${why}`); };
  for (const k of ["id", "slug", "name", "niche", "summary", "outcome", "model"] as const) if (!t[k]) fail(`missing ${k}`);
  if (!Number.isInteger(t.version) || t.version < 1) fail("version must be a positive integer");
  if (!niches.some((n) => n.id === t.niche)) fail(`unknown niche ${t.niche}`);
  const model = models[t.model];
  if (!model) fail(`unknown model ${t.model}`);
  const o = t.output;
  if (!o.aspectRatios.length || o.aspectRatios.some((a) => !ASPECT_RATIOS[a])) fail("unsupported aspect ratio");
  if (!o.aspectRatios.includes(o.defaultAspectRatio)) fail("default aspect ratio not in the list");
  if (o.durations.some((d) => d < model.supports.minDuration || d > model.supports.maxDuration)) fail("duration outside the model's range");
  if (o.durations.some((d) => creditsFor(d) === null)) fail("a duration has no price in config/pricing.json");
  if (!o.durations.includes(o.defaultDuration)) fail("default duration not in the list");
  if (o.resolutions.some((r) => !model.supports.resolutions.includes(r))) fail("resolution the model doesn't support");
  if (!o.resolutions.includes(o.defaultResolution)) fail("default resolution not in the list");
  const ids = new Set<string>();
  for (const i of t.inputs) {
    if (ids.has(i.id)) fail(`duplicate input ${i.id}`);
    ids.add(i.id);
    if (i.type === "select") {
      if (!i.options?.length) fail(`select ${i.id} has no options`);
      if (i.options!.some((op) => !op.prompt)) fail(`select ${i.id} has an option without prompt text`);
      if (i.default && !i.options!.some((op) => op.value === i.default)) fail(`select ${i.id} default not an option`);
    } else if (i.type === "text") {
      if (!i.maxLength || i.maxLength > 300) fail(`text ${i.id} needs a maxLength of 300 or less`);
    } else fail(`input ${i.id} has unknown type`);
  }
  for (const [part, value] of Object.entries(t.prompt)) {
    if (!PROMPT_ORDER.includes(part)) fail(`unknown prompt part ${part}`);
    if (typeof value === "object" && !t.inputs.some((i) => i.id === value.input && i.type === "select")) {
      fail(`prompt part ${part} uses unknown select input ${value.input}`);
    }
  }
  for (const m of String(t.prompt.subject ?? "").matchAll(/\{(\w+)\}/g)) {
    if (!t.inputs.some((i) => i.id === m[1] && i.type === "text" && i.required)) fail(`subject uses {${m[1]}}, which is not a required text input`);
  }
}

function load(): Template[] {
  const dir = new URL("templates/", ROOT);
  const list = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => {
    const t = JSON.parse(readFileSync(new URL(f, dir), "utf8")) as Template;
    check(t, f);
    return t;
  });
  // Listed in the order of catalog/niches.json, then by file name within a niche.
  list.sort((a, b) => niches.findIndex((n) => n.id === a.niche) - niches.findIndex((n) => n.id === b.niche));
  const seen = new Set<string>();
  for (const t of list) {
    if (seen.has(t.id) || seen.has(t.slug)) throw new Error(`catalog: duplicate id or slug ${t.id}`);
    seen.add(t.id); seen.add(t.slug);
  }
  return list;
}

export const templates: Template[] = load();
export const templateBySlug = (slug: string) => templates.find((t) => t.slug === slug);
export const templateById = (id: string) => templates.find((t) => t.id === id);

/** Whether a template can generate right now, and if not, why (shown to the customer). */
export function availability(t: Template): { ready: boolean; reason: "template_unavailable" | "generation_not_configured" | null } {
  if (t.availability !== "available") return { ready: false, reason: "template_unavailable" };
  if (!providerReady(models[t.model].provider)) return { ready: false, reason: "generation_not_configured" };
  return { ready: true, reason: null };
}

/** Preview media is shown only when it exists AND is explicitly approved. Nothing is approved yet. */
function approvedPreview(t: Template): { poster: string; video: string | null } | null {
  if (!t.preview.approved || !t.preview.asset) return null;
  const base = new URL(`../media/previews/${t.preview.asset}`, import.meta.url);
  if (!existsSync(new URL(`${base.href}.jpg`))) return null;
  return {
    poster: `/media/previews/${t.preview.asset}.jpg`,
    video: existsSync(new URL(`${base.href}.mp4`)) ? `/media/previews/${t.preview.asset}.mp4` : null,
  };
}

export function publicTemplate(t: Template) {
  const a = availability(t);
  return {
    id: t.id, slug: t.slug, version: t.version, name: t.name, niche: t.niche,
    summary: t.summary, outcome: t.outcome,
    photoGuidance: t.photoGuidance, limitations: t.limitations,
    inputs: t.inputs.map((i) => ({
      id: i.id, type: i.type, label: i.label, help: i.help, required: i.required,
      maxLength: i.maxLength ?? null, example: i.example ?? null, default: i.default ?? null,
      options: i.options?.map((o) => ({ value: o.value, label: o.label })) ?? null,
    })),
    output: t.output,
    cost: Object.fromEntries(t.output.durations.map((d) => [d, creditsFor(d)])),
    ready: a.ready, unavailableReason: a.reason,
    preview: approvedPreview(t),
  };
}

/** Preview media files that may be served (approved ones only). */
export function servablePreviewFiles(): Set<string> {
  const out = new Set<string>();
  for (const t of templates) {
    const p = approvedPreview(t);
    if (p) { out.add(p.poster); if (p.video) out.add(p.video); }
  }
  return out;
}

export const PROMPT_PARTS = PROMPT_ORDER;
