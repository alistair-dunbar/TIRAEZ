// Offline demo mode (DEMO_MODE=offline): no API key, no network. Returns
// pre-written replies from data/offline-replies.json for the 5 samples, through
// a stand-in for the Anthropic client, so respond() and its safety nets still run.
// These replies are NOT AI output and must never be presented as live replies.
import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { repoPath } from "./data.ts";
import type { SampleEnquiry } from "./samples.ts";
import type { AssistantOutput } from "./types.ts";

export const OFFLINE_MODEL_LABEL = "offline demo (pre-written replies, not AI)";

export function isOfflineMode(): boolean {
  return process.env.DEMO_MODE?.trim().toLowerCase() === "offline";
}

type ReplyBook = Record<string, AssistantOutput | string>;

export function loadOfflineReplies(path = "data/offline-replies.json"): ReplyBook {
  return JSON.parse(readFileSync(repoPath(path), "utf8")) as ReplyBook;
}

const normalise = (s: string) => s.replace(/\s+/g, " ").trim();

/** Picks the pre-written reply for an unedited sample, or the fallback for anything else. */
export function offlineOutputFor(rawText: string, samples: SampleEnquiry[], book: ReplyBook): AssistantOutput {
  const sample = samples.find((s) => normalise(s.text) === normalise(rawText));
  const entry = (sample && book[sample.id]) || book._fallback;
  return structuredClone(entry as AssistantOutput);
}

/** Minimal stand-in for the Anthropic client that returns a fixed output. */
export function offlineClient(output: AssistantOutput): Anthropic {
  return {
    messages: {
      create: async () => ({
        stop_reason: "end_turn",
        content: [{ type: "text", text: JSON.stringify(output) }],
      }),
    },
  } as unknown as Anthropic;
}
