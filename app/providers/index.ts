// Which provider serves a model. ENGINE picks the implementation for the "fal" provider slot:
//   ENGINE=fal   real generation (needs FAL_KEY, or FAL_AUTH=proxy in cloud sessions)
//   ENGINE=mock  tests only (NODE_ENV=test); refused anywhere else
//   unset        generation is switched off and the site says so
import { fal } from "./fal.ts";
import { mock } from "./mock.ts";
import type { VideoProvider } from "./types.ts";

export function engineName(): "fal" | "mock" | "none" {
  const e = process.env.ENGINE;
  if (e === "mock") {
    if (process.env.NODE_ENV !== "test") throw new Error("ENGINE=mock is for automated tests only");
    return "mock";
  }
  return e === "fal" ? "fal" : "none";
}

export function provider(name: string): VideoProvider | null {
  if (name !== "fal") return null;
  const e = engineName();
  return e === "fal" ? fal : e === "mock" ? mock : null;
}

export function providerReady(name: string): boolean {
  const p = provider(name);
  return Boolean(p && p.ready());
}
