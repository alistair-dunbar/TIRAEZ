// Prepaid credits. Packs and prices live in config/packs.json, never in code.
// Payments go through a provider interface: PAYMENTS=moyasar (real, see moyasar.ts) or
// PAYMENTS=test, which grants credits without charging and must never run in production.
import { readFileSync } from "node:fs";
import { UserError } from "./auth.ts";
import { db, tx } from "./db.ts";
import { moyasar } from "./moyasar.ts";
import { legalEnforced, paymentTermsMissing } from "./legal.ts";

export interface Pack { id: string; credits: number; priceSar: number }

export const packs: Pack[] = JSON.parse(readFileSync(new URL("../config/packs.json", import.meta.url), "utf8"));

export interface PaymentProvider {
  name: string;
  /** Starts a payment. "paid" means credits can be granted now; "redirect" sends the buyer to a checkout page. */
  start(purchaseId: number, pack: Pack, email: string): Promise<{ status: "paid"; ref: string } | { status: "redirect"; url: string; ref: string }>;
  /** Asks the provider directly what was paid. The only thing we trust when granting credits. */
  verify(ref: string): Promise<{ paid: boolean; amountHalalas: number; currency: string; purchaseId: string | undefined }>;
}

const testProvider: PaymentProvider = {
  name: "test",
  async start(purchaseId) { return { status: "paid", ref: `test-${purchaseId}` }; },
  async verify() { throw new Error("test payments are granted at purchase time"); },
};

export function paymentProvider(): PaymentProvider {
  const name = process.env.PAYMENTS ?? "none";
  if (name === "test") {
    if (process.env.NODE_ENV === "production") throw new Error("PAYMENTS=test is not allowed in production");
    return testProvider;
  }
  if (name === "moyasar") {
    // The billing policy's price, VAT, expiry and refund terms must be settled before anyone can pay.
    if (legalEnforced() && paymentTermsMissing().length) throw new UserError("payments_not_configured", 503);
    return moyasar;
  }
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

/**
 * Called when the buyer returns from checkout or the provider's webhook arrives. Neither is
 * trusted: we ask the provider what was actually paid and compare it with our own record.
 */
export async function confirmPurchase(purchaseId: number): Promise<boolean> {
  const p = db.prepare("SELECT id, price_sar, provider, provider_ref, status FROM purchases WHERE id = ?").get(purchaseId) as any;
  if (!p) return false;
  if (p.status === "paid") return true;
  if (p.provider !== "moyasar" || !p.provider_ref) return false;
  const v = await moyasar.verify(p.provider_ref);
  const ok = v.paid && v.currency === "SAR" && v.amountHalalas === p.price_sar * 100 && v.purchaseId === String(p.id);
  if (ok) markPaid(p.id);
  return ok;
}

export function purchaseByRef(ref: string): number | undefined {
  return (db.prepare("SELECT id FROM purchases WHERE provider_ref = ?").get(ref) as any)?.id;
}

export function purchaseOwner(purchaseId: number): number | undefined {
  return (db.prepare("SELECT user_id FROM purchases WHERE id = ?").get(purchaseId) as any)?.user_id;
}

// The ledger (credit_events). users.credits is the spendable balance; every change to it is a row here.
//   purchase         +n  credits bought (ref: purchase id)
//   grant            +n  credits given by the operator (ref: note)
//   video            -n  credits reserved when a video is requested (ref: job id)
//   consume           0  the video finished, so its reserved credits are used for good (ref: job id)
//   refund           +n  the video failed, so its reserved credits come back (ref: job id)
//   purchase_refund  -n  a purchase was refunded, so its unused credits are removed (ref: purchase id)
// A unique index on (reason, ref) means none of these can be recorded twice.

/** Takes (reserves) credits for a job. Throws if the balance is too low. Call inside a transaction. */
export function spendForJob(userId: number, jobId: number, credits: number): void {
  const r = db.prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?").run(credits, userId, credits);
  if (r.changes !== 1) throw new UserError("no_credits", 402);
  db.prepare("INSERT INTO credit_events (user_id, delta, reason, ref) VALUES (?, ?, 'video', ?)").run(userId, -credits, String(jobId));
}

/** Returns a failed job's credits. Never refunds the same job twice. Returns true once the refund exists. */
export function refundJob(userId: number, jobId: number, credits: number): boolean {
  tx(() => {
    const done = db.prepare("SELECT 1 FROM credit_events WHERE reason = 'refund' AND ref = ?").get(String(jobId));
    if (!done) change(userId, credits, "refund", String(jobId));
  });
  return isRefunded(jobId);
}

/** Marks a finished video's reserved credits as used. Safe to call more than once. */
export function consumeJob(userId: number, jobId: number): void {
  db.prepare("INSERT OR IGNORE INTO credit_events (user_id, delta, reason, ref) VALUES (?, 0, 'consume', ?)").run(userId, String(jobId));
}

const ACTIVE = ["queued", "uploading", "submitting", "in_queue", "in_progress", "saving"];

/** Where every credit on an account stands. */
export function creditSummary(userId: number) {
  const sum = (reason: string) => (db.prepare("SELECT COALESCE(SUM(delta), 0) AS s FROM credit_events WHERE user_id = ? AND reason = ?").get(userId, reason) as any).s as number;
  const jobs = (where: string, ...a: unknown[]) => (db.prepare(`SELECT COALESCE(SUM(credits), 0) AS s FROM jobs WHERE user_id = ? AND ${where}`).get(userId, ...(a as any[])) as any).s as number;
  return {
    available: balance(userId),
    reserved: jobs(`status IN (${ACTIVE.map(() => "?").join(",")})`, ...ACTIVE),
    used: jobs("status = 'completed'"),
    returned: sum("refund"),
    purchased: sum("purchase"),
    granted: sum("grant"),
    refundedPurchases: -sum("purchase_refund"),
  };
}

export function purchasesFor(userId: number) {
  return (db.prepare(`SELECT p.id, p.pack_id AS pack, p.credits, p.price_sar AS priceSar, p.status, p.created_at AS createdAt,
      p.refunded_at AS refundedAt, p.refunded_credits AS refundedCredits,
      (SELECT status FROM refund_requests r WHERE r.purchase_id = p.id ORDER BY r.id DESC LIMIT 1) AS refundRequest
    FROM purchases p WHERE p.user_id = ? AND p.status IN ('paid', 'refunded') ORDER BY p.id DESC`).all(userId) as any[]);
}

/** A customer asks for a purchase to be refunded. One open request per purchase. */
export function requestRefund(userId: number, purchaseId: unknown, details: unknown, reason = "customer"): number {
  const p = db.prepare("SELECT id, status FROM purchases WHERE id = ? AND user_id = ?").get(Number(purchaseId), userId) as any;
  if (!p) throw new UserError("not_found", 404);
  if (p.status !== "paid") throw new UserError("not_refundable", 409);
  const open = db.prepare("SELECT id FROM refund_requests WHERE purchase_id = ? AND status = 'open'").get(p.id) as any;
  if (open) return open.id;
  const text = typeof details === "string" ? details.replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? c : "")).trim().slice(0, 2000) : "";
  return Number(db.prepare("INSERT INTO refund_requests (user_id, purchase_id, reason, details) VALUES (?, ?, ?, ?)")
    .run(userId, p.id, reason, text || null).lastInsertRowid);
}

/**
 * Refunds a purchase in our records: removes its credits from the spendable balance and marks it
 * refunded. Only credits that are still unused can be removed; if some were spent or are reserved by a
 * video in progress, the reviewer must say how many to remove. Idempotent: a refunded purchase can't be
 * refunded again. Returning the money is done in the payment provider (see docs/DEPLOY.md).
 */
export function refundPurchase(purchaseId: number, opts: { credits?: number; note: string; providerRef?: string }): { removed: number } {
  return tx(() => {
    const p = db.prepare("SELECT id, user_id, credits, status FROM purchases WHERE id = ?").get(purchaseId) as any;
    if (!p) throw new UserError("not_found", 404);
    if (p.status === "refunded") return { removed: 0 };
    if (p.status !== "paid") throw new UserError("not_refundable", 409);
    const available = balance(p.user_id);
    const removed = opts.credits ?? p.credits;
    if (!Number.isInteger(removed) || removed < 0 || removed > p.credits) throw new UserError("bad_request");
    if (removed > available) throw new UserError("credits_in_use", 409);
    db.prepare("UPDATE users SET credits = credits - ? WHERE id = ?").run(removed, p.user_id);
    db.prepare("INSERT INTO credit_events (user_id, delta, reason, ref) VALUES (?, ?, 'purchase_refund', ?)").run(p.user_id, -removed, String(p.id));
    db.prepare(`UPDATE purchases SET status = 'refunded', refunded_at = datetime('now'), refunded_credits = ?, refund_note = ?,
      refund_provider_ref = ? WHERE id = ?`).run(removed, opts.note.slice(0, 500), opts.providerRef ?? null, p.id);
    db.prepare("UPDATE refund_requests SET status = 'approved', decided_at = datetime('now'), decision_note = ? WHERE purchase_id = ? AND status = 'open'")
      .run(opts.note.slice(0, 500), p.id);
    return { removed };
  });
}

export function declineRefund(requestId: number, note: string): boolean {
  return db.prepare("UPDATE refund_requests SET status = 'declined', decided_at = datetime('now'), decision_note = ? WHERE id = ? AND status = 'open'")
    .run(note.slice(0, 500), requestId).changes > 0;
}

export function isRefunded(jobId: number): boolean {
  return !!db.prepare("SELECT 1 FROM credit_events WHERE reason = 'refund' AND ref = ?").get(String(jobId));
}

/** Operator tool (npm run credits): adds credits to an account without a payment. */
export function grantCredits(email: string, credits: number, note: string): number {
  const u = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase()) as any;
  if (!u) throw new Error(`No account for ${email}`);
  tx(() => change(u.id, credits, "grant", note.slice(0, 200)));
  return balance(u.id);
}
