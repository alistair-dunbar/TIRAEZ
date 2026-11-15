// Prepaid credits. Packs and prices live in config/packs.json, never in code.
// Payments go through a provider interface; the only one implemented is "test",
// which grants credits without charging and must never run in production.
import { readFileSync } from "node:fs";
import { UserError } from "./auth.ts";
import { db, tx } from "./db.ts";

export interface Pack { id: string; credits: number; priceSar: number }

export const packs: Pack[] = JSON.parse(readFileSync(new URL("../config/packs.json", import.meta.url), "utf8"));

export interface PaymentProvider {
  name: string;
  /** Starts a payment. "paid" means credits can be granted now; "redirect" sends the buyer to a checkout page. */
  start(purchaseId: number, pack: Pack, email: string): Promise<{ status: "paid"; ref: string } | { status: "redirect"; url: string; ref: string }>;
}

const testProvider: PaymentProvider = {
  name: "test",
  async start(purchaseId) { return { status: "paid", ref: `test-${purchaseId}` }; },
};

export function paymentProvider(): PaymentProvider {
  const name = process.env.PAYMENTS ?? "none";
  if (name === "test") {
    if (process.env.NODE_ENV === "production") throw new Error("PAYMENTS=test is not allowed in production");
    return testProvider;
  }
  // A real gateway (Moyasar, Tap, HyperPay) plugs in here once one is chosen.
  throw new UserError("payments_not_configured", 503);
}

export function balance(userId: number): number {
  return (db.prepare("SELECT credits FROM users WHERE id = ?").get(userId) as any).credits;
}

function change(userId: number, delta: number, reason: string, ref: string): void {
  db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(delta, userId);
  db.prepare("INSERT INTO credit_events (user_id, delta, reason, ref) VALUES (?, ?, ?, ?)").run(userId, delta, reason, ref);
}

export async function buy(userId: number, email: string, packId: string) {
  const pack = packs.find((p) => p.id === packId);
  if (!pack) throw new UserError("unknown_pack", 404);
  const provider = paymentProvider();
  const id = Number(db.prepare(
    "INSERT INTO purchases (user_id, pack_id, credits, price_sar, provider, status) VALUES (?, ?, ?, ?, ?, 'pending')")
    .run(userId, pack.id, pack.credits, pack.priceSar, provider.name).lastInsertRowid);
  const result = await provider.start(id, pack, email);
  db.prepare("UPDATE purchases SET provider_ref = ? WHERE id = ?").run(result.ref, id);
  if (result.status === "paid") markPaid(id);
  return { purchaseId: id, ...result };
}

/** Grants a purchase's credits exactly once (safe to call again from a payment webhook). */
export function markPaid(purchaseId: number): void {
  tx(() => {
    const p = db.prepare("SELECT user_id, credits, status FROM purchases WHERE id = ?").get(purchaseId) as any;
    if (!p || p.status === "paid") return;
    db.prepare("UPDATE purchases SET status = 'paid' WHERE id = ?").run(purchaseId);
    change(p.user_id, p.credits, "purchase", String(purchaseId));
  });
}

/** Takes one credit for a video. Throws if the balance is empty. Call inside a transaction. */
export function spendForVideo(userId: number, videoId: number): void {
  const r = db.prepare("UPDATE users SET credits = credits - 1 WHERE id = ? AND credits >= 1").run(userId);
  if (r.changes !== 1) throw new UserError("no_credits", 402);
  db.prepare("INSERT INTO credit_events (user_id, delta, reason, ref) VALUES (?, -1, 'video', ?)").run(userId, String(videoId));
}

/** Gives the credit back when a video fails. Never refunds the same video twice. */
export function refundVideo(userId: number, videoId: number): void {
  tx(() => {
    const done = db.prepare("SELECT 1 FROM credit_events WHERE reason = 'refund' AND ref = ?").get(String(videoId));
    if (!done) change(userId, 1, "refund", String(videoId));
  });
}
