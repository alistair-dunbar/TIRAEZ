// Request limits and log redaction.
// Limits are fixed windows held in memory: they reset on restart and aren't shared between servers,
// which is enough for one server and is said so in docs/SECURITY.md.
import type { IncomingMessage } from "node:http";
import { UserError } from "./auth.ts";

const buckets = new Map<string, { n: number; resetAt: number }>();

/** Throws 429 once `key` has been used `max` times in the current window. */
export function limit(key: string, max: number, windowMs: number): void {
  if (process.env.RATE_LIMITS === "off" && process.env.NODE_ENV === "test") return;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    if (buckets.size > 50_000) for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    b = { n: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  if (++b.n > max) throw new UserError("rate_limited", 429);
}

export function resetLimits(): void { buckets.clear(); }

/**
 * The visitor's address. Behind Railway's proxy the last X-Forwarded-For entry is the one the proxy
 * added (earlier entries can be written by the client), so that is the one trusted.
 */
export function clientIp(req: IncomingMessage): string {
  if (process.env.NODE_ENV === "production") {
    const xff = String(req.headers["x-forwarded-for"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];
  }
  return req.socket.remoteAddress ?? "unknown";
}

const HOUR = 3600_000;
export const LIMITS = {
  signup: [10, HOUR],          // per address
  login: [30, 15 * 60_000],    // per address (each email also locks after 8 wrong passwords)
  onboarding: [20, HOUR],      // per account
  report: [10, HOUR],          // per address
  photo: [60, HOUR],           // per account
  export: [10, HOUR],          // per account
  sensitive: [10, HOUR],       // password, email and deletion attempts, per account
  purchase: [20, HOUR],        // per account
} as const satisfies Record<string, readonly [number, number]>;

export function limitBy(name: keyof typeof LIMITS, who: string | number): void {
  const [max, windowMs] = LIMITS[name];
  limit(`${name}:${who}`, max, windowMs);
}

/** Strips things that must never reach logs: keys and tokens, email addresses, signed URL queries. */
export function redact(text: unknown): string {
  return String(text ?? "")
    .replace(/\b(Key|Bearer|Basic)\s+[A-Za-z0-9._~+/=:-]{8,}/gi, "$1 [redacted]")
    .replace(/\b(sk|pk)_(live|test)_[A-Za-z0-9]+/g, "[redacted-key]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/(https?:\/\/[^\s"'?]+)\?[^\s"']*/g, "$1?[query]")
    .replace(/\b[a-f0-9]{40,}\b/gi, "[hex]");
}
