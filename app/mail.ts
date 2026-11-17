// Account emails: verification, password reset and email-change messages.
//   MAIL=resend   real delivery through Resend's HTTP API (needs RESEND_API_KEY and MAIL_FROM)
//   MAIL=outbox   development and tests only: messages are kept in memory and written to
//                 DATA_DIR/outbox as .eml files instead of being sent. Refused in production.
//   unset         outbox outside production; in production, email is off and the site says so
// Checked against Resend's docs on 17 Nov 2026 (POST /emails, Bearer key, Idempotency-Key, User-Agent required).
// Links in emails are always built from APP_URL, never from the request's Host header.
import { mkdirSync, writeFileSync } from "node:fs";
import { redact } from "./guard.ts";

export interface Mail { to: string; subject: string; text: string; html: string }
export interface SentMail extends Mail { at: string }

export function mailName(): "resend" | "outbox" | "none" {
  const m = process.env.MAIL;
  if (m === "outbox") {
    if (process.env.NODE_ENV === "production") throw new Error("MAIL=outbox is not allowed in production");
    return "outbox";
  }
  if (m === "resend") return "resend";
  return process.env.NODE_ENV === "production" ? "none" : "outbox";
}

/** True when account emails can actually be delivered. */
export function mailReady(): boolean {
  const m = mailName();
  if (m === "outbox") return true;
  if (m === "resend") return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM && appUrl());
  return false;
}

export function appUrl(): string {
  const u = process.env.APP_URL;
  if (u) return u.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? "" : `http://localhost:${process.env.PORT ?? 3000}`;
}

// ---------------------------------------------------------------------------------------------
// Outbox (sandbox)

export const outbox: SentMail[] = [];
function toOutbox(m: Mail): void {
  const sent = { ...m, at: new Date().toISOString() };
  outbox.push(sent);
  if (outbox.length > 200) outbox.shift();
  try {
    const dir = `${process.env.DATA_DIR ?? "data"}/outbox`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${Date.now()}-${m.to.replace(/[^a-z0-9@.]/gi, "_")}.eml`,
      `To: ${m.to}\nSubject: ${m.subject}\nDate: ${sent.at}\nContent-Type: text/plain; charset=utf-8\n\n${m.text}\n`);
  } catch { /* the in-memory copy is enough for tests */ }
}

// ---------------------------------------------------------------------------------------------
// Resend

async function viaResend(m: Mail, idempotencyKey?: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "tiraez-server/1.0",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html,
      ...(process.env.MAIL_REPLY_TO ? { reply_to: process.env.MAIL_REPLY_TO } : {}) }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${redact(await res.text().catch(() => ""))}`.slice(0, 300));
}

/** Sends one message. Throws if it couldn't be handed to the provider. Never logs the body (it holds links). */
export async function send(m: Mail, idempotencyKey?: string): Promise<void> {
  const name = mailName();
  if (name === "outbox") { toOutbox(m); return; }
  if (name === "resend" && mailReady()) { await viaResend(m, idempotencyKey); return; }
  throw new Error("mail_not_configured");
}

// ---------------------------------------------------------------------------------------------
// Messages. Plain wording, one link each, no tracking pixels or tracked links.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function message(to: string, brand: string, subject: string, lines: string[], link?: { url: string; label: string }, after: string[] = []): Mail {
  const text = [...lines, ...(link ? ["", `${link.label}: ${link.url}`, ""] : []), ...after, "", brand].join("\n");
  const p = (s: string) => `<p style="margin:0 0 16px">${esc(s)}</p>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#20221F;max-width:560px">` +
    lines.map(p).join("") +
    (link ? `<p style="margin:0 0 16px"><a href="${esc(link.url)}" style="display:inline-block;background:#244638;color:#F3F0E8;padding:12px 20px;text-decoration:none;border-radius:2px">${esc(link.label)}</a></p>` +
      `<p style="margin:0 0 16px;font-size:14px;color:#5F615B">If the button doesn't work, copy this address into your browser:<br>${esc(link.url)}</p>` : "") +
    after.map(p).join("") + `<p style="margin:24px 0 0;font-size:14px;color:#5F615B">${esc(brand)}</p></div>`;
  return { to, subject, text, html };
}

export const messages = {
  verify: (to: string, brand: string, url: string) => message(to, brand, `Confirm your email for ${brand}`,
    [`Confirm this email address to finish setting up your ${brand} account.`],
    { url, label: "Confirm email address" },
    ["The link works once and expires in 24 hours. If you didn't create an account, you can ignore this email."]),
  reset: (to: string, brand: string, url: string) => message(to, brand, `Reset your ${brand} password`,
    [`Someone asked to reset the password for the ${brand} account with this email address.`],
    { url, label: "Choose a new password" },
    ["The link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email: your password hasn't changed."]),
  emailChange: (to: string, brand: string, url: string) => message(to, brand, `Confirm your new email for ${brand}`,
    [`Confirm this address to make it the email you log in to ${brand} with.`],
    { url, label: "Confirm new email address" },
    ["The link works once and expires in 24 hours. Until you confirm, your account keeps its current email address."]),
  emailChangeNotice: (to: string, brand: string, newEmail: string) => message(to, brand, `Your ${brand} email is changing`,
    [`Someone logged in to your ${brand} account asked to change its email address to ${newEmail}.`,
      "Nothing changes until the new address is confirmed. If this wasn't you, log in and change your password straight away."]),
  existingAccount: (to: string, brand: string, loginUrl: string, resetUrl: string, confirmUrl: string | null) => message(to, brand,
    `You already have a ${brand} account`,
    [`Someone tried to create a ${brand} account with this email address, but it already has one, so nothing new was created.`,
      `To log in: ${loginUrl}`, `Forgotten your password? Reset it here: ${resetUrl}`],
    confirmUrl ? { url: confirmUrl, label: "Confirm your email address" } : undefined,
    ["If this wasn't you, you can ignore this email. Your account hasn't changed."]),
  passwordChanged: (to: string, brand: string) => message(to, brand, `Your ${brand} password was changed`,
    [`The password for your ${brand} account was just changed, and every device was logged out.`,
      "If this wasn't you, reset your password from the login page and contact us."]),
};
