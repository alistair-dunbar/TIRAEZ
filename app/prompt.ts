// Validates a customer's choices against a template and assembles the private prompt.
// Customer text is treated as data: trimmed, length-limited, stripped of control
// characters and braces, and quoted inside a fixed sentence.
import { ASPECT_RATIOS, PROMPT_PARTS, type Template } from "./catalog.ts";
import { creditsFor } from "./config.ts";

export type FieldErrors = Record<string, string>;
export interface Settings { aspectRatio: string; duration: number; resolution: string }

export function cleanText(v: unknown, max: number): string {
  return String(v ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, " ")
    .replace(/[{}<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function validateInputs(t: Template, raw: unknown): { inputs: Record<string, string>; errors: FieldErrors } {
  const given = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const inputs: Record<string, string> = {};
  const errors: FieldErrors = {};
  for (const i of t.inputs) {
    if (i.type === "select") {
      const v = given[i.id] === undefined || given[i.id] === "" ? i.default ?? "" : String(given[i.id]);
      if (!v) { if (i.required) errors[i.id] = `Choose an option for ${i.label.toLowerCase()}.`; continue; }
      if (!i.options!.some((o) => o.value === v)) { errors[i.id] = `Choose one of the listed options for ${i.label.toLowerCase()}.`; continue; }
      inputs[i.id] = v;
    } else {
      const rawText = String(given[i.id] ?? "");
      if (rawText.length > i.maxLength! * 2) { errors[i.id] = `Keep ${i.label.toLowerCase()} to ${i.maxLength} characters.`; continue; }
      const v = cleanText(rawText, Number.MAX_SAFE_INTEGER);
      if (v.length > i.maxLength!) { errors[i.id] = `Keep ${i.label.toLowerCase()} to ${i.maxLength} characters.`; continue; }
      if (!v) { if (i.required) errors[i.id] = `Write a few words for ${i.label.toLowerCase()}.`; continue; }
      inputs[i.id] = v;
    }
  }
  return { inputs, errors };
}

export function validateSettings(t: Template, raw: unknown): { settings: Settings; errors: FieldErrors } {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};
  const aspectRatio = String(s.aspectRatio ?? t.output.defaultAspectRatio);
  const duration = Number(s.duration ?? t.output.defaultDuration);
  const resolution = String(s.resolution ?? t.output.defaultResolution);
  if (!t.output.aspectRatios.includes(aspectRatio) || !ASPECT_RATIOS[aspectRatio]) {
    errors.aspectRatio = `This template makes ${t.output.aspectRatios.join(", ")} videos. Choose one of those.`;
  }
  if (!t.output.durations.includes(duration) || creditsFor(duration) === null) {
    errors.duration = `This template makes ${t.output.durations.join(" or ")}-second videos.`;
  }
  if (!t.output.resolutions.includes(resolution)) {
    errors.resolution = `Choose ${t.output.resolutions.join(" or ")}.`;
  }
  return { settings: { aspectRatio, duration, resolution }, errors };
}

function part(t: Template, name: string, inputs: Record<string, string>, settings: Settings): string {
  const p = t.prompt[name];
  if (p === undefined) return "";
  if (typeof p === "object") {
    const input = t.inputs.find((i) => i.id === p.input)!;
    return input.options!.find((o) => o.value === inputs[p.input])?.prompt ?? "";
  }
  return p.replace(/\{(\w+)\}/g, (_, id) => inputs[id] ?? "").replace("{duration}", String(settings.duration));
}

/** The prompt sent to the model. Never sent to the browser. */
export function assemblePrompt(t: Template, inputs: Record<string, string>, settings: Settings): string {
  const lines: string[] = [];
  for (const name of PROMPT_PARTS) {
    if (name === "timing") {
      lines.push(part(t, name, inputs, settings) || `The whole video is one continuous shot lasting ${settings.duration} seconds, with steady, unhurried movement.`);
      continue;
    }
    const text = part(t, name, inputs, settings);
    if (text) lines.push(text);
    if (name === "preserveExtra" && inputs.keep) lines.push(`The customer also asked to keep this as it is: "${inputs.keep}".`);
    if (name === "avoid" && inputs.avoid) lines.push(`The customer asked to leave this out: "${inputs.avoid}".`);
  }
  return lines.join(" ");
}
