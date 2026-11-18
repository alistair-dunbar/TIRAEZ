// Founders' review of refund requests (no admin web page yet).
//   npm run refunds                                         open requests, with each account's credit position
//   npm run refunds -- --approve 3 --note "Unused, within 7 days" [--credits 10] [--provider-ref rf_...]
//   npm run refunds -- --decline 3 --note "Credits already used"
// Approving removes the purchase's unused credits from the account so they can't be spent, and marks the
// purchase refunded; it is safe to run twice. The money itself is returned in the payment provider's
// dashboard (Moyasar), whose refund reference goes in --provider-ref.
import { creditSummary, declineRefund, refundPurchase } from "./credits.ts";
import { db } from "./db.ts";

const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

if (arg("approve")) {
  const r = db.prepare("SELECT purchase_id FROM refund_requests WHERE id = ?").get(Number(arg("approve"))) as any;
  const note = arg("note");
  if (!r || !note) { console.log("Usage: --approve <request id> --note <reason> [--credits n] [--provider-ref ref]"); process.exit(1); }
  try {
    const out = refundPurchase(r.purchase_id, { note, credits: arg("credits") ? Number(arg("credits")) : undefined, providerRef: arg("provider-ref") });
    console.log(out.removed ? `Purchase ${r.purchase_id} refunded; ${out.removed} credit(s) removed from the balance.` : `Purchase ${r.purchase_id} was already refunded; nothing changed.`);
  } catch (e) {
    console.log((e as any).code === "credits_in_use"
      ? "Some of this purchase's credits are spent or reserved by a video in progress. Re-run with --credits <unused number>."
      : `Not refunded: ${(e as Error).message}`);
    process.exit(1);
  }
} else if (arg("decline")) {
  const note = arg("note");
  if (!note) { console.log("Give a --note explaining the decision."); process.exit(1); }
  console.log(declineRefund(Number(arg("decline")), note) ? "Declined." : "No open request with that id.");
} else {
  const rows = db.prepare(`SELECT r.*, p.credits, p.price_sar, p.created_at AS bought_at, u.email FROM refund_requests r
    JOIN purchases p ON p.id = r.purchase_id LEFT JOIN users u ON u.id = r.user_id WHERE r.status = 'open' ORDER BY r.id`).all() as any[];
  if (!rows.length) console.log("No open refund requests.");
  for (const r of rows) {
    const c = r.user_id ? creditSummary(r.user_id) : null;
    console.log(`#${r.id}  ${r.created_at}  ${r.reason}  purchase ${r.purchase_id}: ${r.credits} credits, SAR ${r.price_sar}, bought ${r.bought_at}`);
    console.log(`    account: ${r.email ?? "deleted"}${c ? `  available ${c.available}, reserved ${c.reserved}, used ${c.used}` : ""}`);
    if (r.details) console.log(`    ${String(r.details).replace(/\n/g, "\n    ")}`);
  }
}
