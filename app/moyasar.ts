// Moyasar payments through hosted invoices (docs.moyasar.com, Invoices API).
// The buyer pays on Moyasar's page, so card details never reach this service.
//
// Needs: MOYASAR_SECRET_KEY (sk_test_... or sk_live_...) and APP_URL (this site's public https address).
import { UserError } from "./auth.ts";
import type { Pack, PaymentProvider } from "./credits.ts";

const API = "https://api.moyasar.com/v1";

/** Replaceable in tests so no real request is made. */
export const http = { fetch: (url: string, init?: RequestInit) => fetch(url, init) };

function config() {
  const key = process.env.MOYASAR_SECRET_KEY;
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!key || !appUrl) throw new UserError("payments_not_configured", 503);
  if (process.env.NODE_ENV === "production" && !key.startsWith("sk_live_")) {
    throw new Error("Production needs a live Moyasar key (sk_live_...)");
  }
  return { auth: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, appUrl };
}

async function call(method: string, path: string, body?: unknown): Promise<any> {
  const { auth } = config();
  const res = await http.fetch(`${API}${path}`, {
    method,
    headers: { Authorization: auth, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Moyasar ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    throw new UserError("payment_failed", 502);
  }
  return JSON.parse(text);
}

export const moyasar: PaymentProvider = {
  name: "moyasar",

  async start(purchaseId: number, pack: Pack) {
    const { appUrl } = config();
    const invoice = await call("POST", "/invoices", {
      amount: pack.priceSar * 100, // halalas
      currency: "SAR",
      description: `${pack.credits} video credits`,
      success_url: `${appUrl}/api/purchases/${purchaseId}/return`,
      back_url: `${appUrl}/`,
      callback_url: `${appUrl}/api/webhooks/moyasar`,
      metadata: { purchase_id: String(purchaseId) },
    });
    if (!invoice.id || !invoice.url) throw new UserError("payment_failed", 502);
    return { status: "redirect", url: invoice.url, ref: invoice.id };
  },

  async verify(ref: string) {
    const invoice = await call("GET", `/invoices/${encodeURIComponent(ref)}`);
    return {
      paid: invoice.status === "paid",
      amountHalalas: Number(invoice.amount),
      currency: String(invoice.currency),
      purchaseId: invoice.metadata?.purchase_id,
    };
  },
};
