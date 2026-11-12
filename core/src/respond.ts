// One Claude call per enquiry, returning strict JSON, followed by deterministic
// safety nets (see checks.ts). Legal rules never rely on the model alone.
import Anthropic from "@anthropic-ai/sdk";
import {
  detectHandoffTopics,
  enforceBookingLink,
  enforceDisclosure,
  unverifiedAmounts,
} from "./checks.ts";
import { findListing } from "./data.ts";
import { parseEnquiry } from "./parse.ts";
import { buildSystemPrompt, buildUserMessage, OUTPUT_SCHEMA } from "./prompt.ts";
import type { AgencyConfig, AssistantOutput, EnquiryResult, Listing } from "./types.ts";

export const DEFAULT_MODEL = "claude-haiku-5-5";

export function modelName(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set. Add it to .env (local) or the environment's secrets (cloud).");
  }
}

export interface RespondDeps {
  config: AgencyConfig;
  listings: Listing[];
  client?: Anthropic;
}

let sharedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError();
  // 15 s is our product promise; one retry covers a transient 5xx/429.
  sharedClient ??= new Anthropic({ timeout: 15_000, maxRetries: 1 });
  return sharedClient;
}

/** Validates the model's JSON. Throws with a clear message if the shape is wrong. */
export function parseAssistantOutput(text: string): AssistantOutput {
  const data = JSON.parse(text) as Record<string, unknown>;
  const q = data.qualification as Record<string, unknown> | undefined;
  const isStrOrNull = (v: unknown) => v === null || typeof v === "string";
  const ok =
    typeof data.language === "string" &&
    typeof data.reply === "string" &&
    typeof data.summary_en === "string" &&
    typeof data.needs_human === "boolean" &&
    typeof data.reason === "string" &&
    !!q &&
    ["budget", "area", "timing", "travel_dates"].every((k) => isStrOrNull(q[k]));
  if (!ok) throw new Error(`Model returned JSON in an unexpected shape: ${text.slice(0, 300)}`);
  return data as unknown as AssistantOutput;
}

export async function respond(rawEnquiry: string, deps: RespondDeps): Promise<EnquiryResult> {
  const started = performance.now();
  const { config, listings } = deps;
  const client = deps.client ?? getClient();
  const model = modelName();

  const parsed = parseEnquiry(rawEnquiry);
  const listing = findListing(listings, parsed.listing_ref);

  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    // Low effort keeps latency down; this is a short, well-specified task.
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: buildSystemPrompt(config),
    messages: [{ role: "user", content: buildUserMessage(config, parsed, listing, rawEnquiry) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this enquiry. Route it to an agent.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("The model's answer was cut off (max_tokens). Try again.");
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("The model returned no text.");

  const output = parseAssistantOutput(textBlock.text);
  const adjustments: string[] = [];

  // Rule 1: disclosure must be the first sentence.
  const disclosed = enforceDisclosure(output.reply, config, output.language);
  if (disclosed.changed) adjustments.push("Added AI disclosure as first sentence");
  output.reply = disclosed.reply;

  // Rule 7: end with the booking link.
  const linked = enforceBookingLink(output.reply, config.booking_link);
  if (linked.changed) adjustments.push("Moved/added booking link at the end");
  output.reply = linked.reply;

  // Rule 4: keyword safety net for legal/tax/mortgage/residency topics.
  const topics = detectHandoffTopics(parsed.message);
  if (topics.length && !output.needs_human) {
    output.needs_human = true;
    output.reason = `Buyer asked about ${topics.join(", ")}; an agent must follow up.`;
    adjustments.push(`Set needs_human: buyer mentioned ${topics.join(", ")}`);
  }

  // Unknown or missing listing always needs a person to identify the property.
  if (!listing && !output.needs_human) {
    output.needs_human = true;
    output.reason = parsed.listing_ref
      ? `Listing ref ${parsed.listing_ref} not found; an agent must identify the property.`
      : "No listing ref given; an agent must identify the property.";
    adjustments.push("Set needs_human: listing not identified");
  }

  // Rule 3: flag any euro amount that is not a listing price or the buyer's own figure.
  const unverified = unverifiedAmounts(output.reply, listings, rawEnquiry);
  if (unverified.length) {
    output.needs_human = true;
    output.reason = `Reply contains unverified amount(s): ${unverified.join(", ")} EUR. Check before sending.`;
    adjustments.push("Flagged unverified price in reply");
  }

  return {
    ...output,
    parsed,
    listing,
    legal_footer: config.legal_footer[output.language] ?? config.legal_footer[config.fallback_language],
    model,
    elapsed_ms: Math.round(performance.now() - started),
    adjustments,
  };
}
