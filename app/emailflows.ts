// Email verification, password reset and email change.
// Each link carries a random 32-byte token. Only its SHA-256 hash is stored, it expires, and it
// works once. Tokens never appear in logs. Messages are handed to the mail provider after the
// request has answered, so response times don't reveal whether an account exists.
import { createHash, randomBytes } from "node:crypto";
import { UserError, ValidationError, endAllSessions, hashPassword, userById, type User } from "./auth.ts";
import { site } from "./config.ts";
import { db, tx } from "./db.ts";
import { limit } from "./guard.ts";
import { appUrl, mailReady, messages, send, type Mail } from "./mail.ts";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const HOURS = { verify: 24, reset: 1, email_change: 24 } as const;
type Kind = keyof typeof HOURS;

function issue(userId: number, kind: Kind, email: string): string {
  const token = randomBytes(32).toString("base64url");
  // A new link replaces any earlier unused link of the same kind.
  db.prepare("UPDATE email_tokens SET used_at = datetime('now') WHERE user_id = ? AND kind = ? AND used_at IS NULL").run(userId, kind);
  db.prepare("INSERT INTO email_tokens (user_id, kind, token_hash, email, expires_at) VALUES (?, ?, ?, ?, datetime('now', ?))")
    .run(userId, kind, sha(token), email, `+${HOURS[kind]} hours`);
  return token;
}

type TokenRow = { id: number; user_id: number; kind: Kind; email: string; expired: number; used_at: string | null };
function find(token: unknown, kind: Kind): TokenRow | "invalid" | "expired" | "used" {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return "invalid";
  const row = db.prepare(`SELECT id, user_id, kind, email, used_at, expires_at <= datetime('now') AS expired
    FROM email_tokens WHERE token_hash = ? AND kind = ?`).get(sha(token), kind) as TokenRow | undefined;
  if (!row) return "invalid";
  if (row.used_at) return "used";
  if (row.expired) return "expired";
  return row;
}

/** Deliver after the response; a failure is logged without the message body or link. */
function deliver(m: Mail, what: string): void {
  setImmediate(() => { send(m).catch((e) => console.error(`email (${what}) not sent: ${String(e?.message ?? e).slice(0, 200)}`)); });
}

const link = (path: string, token: string) => `${appUrl()}${path}?token=${token}`;

// ---------------------------------------------------------------------------------------------
// Verification

/** Sends (or re-sends) the confirmation link for the account's current email. */
export function sendVerification(u: User): void {
  if (u.emailVerified) return;
  if (!mailReady()) throw new UserError("mail_not_configured", 503);
  limit(`verify-send:${u.id}`, 5, 3600_000);
  deliver(messages.verify(u.email, site.brandName, link("/verify-email", issue(u.id, "verify", u.email))), "verify");
}

/** Uses a verification or email-change link. Returns the account it belonged to. */
export function confirmEmail(token: unknown): { userId: number; email: string; changed: boolean } {
  for (const kind of ["verify", "email_change"] as const) {
    const t = find(token, kind);
    if (t === "invalid") continue;
    if (t === "expired" || t === "used") throw new UserError(`link_${t}`, 410);
    return tx(() => {
      const u = db.prepare("SELECT email, deleted_at FROM users WHERE id = ?").get(t.user_id) as any;
      if (!u || u.deleted_at) throw new UserError("link_invalid", 410);
      db.prepare("UPDATE email_tokens SET used_at = datetime('now') WHERE id = ?").run(t.id);
      if (kind === "verify") {
        // Only the address the link was sent to can be confirmed by it.
        if (u.email !== t.email) throw new UserError("link_invalid", 410);
        db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?").run(t.user_id);
        return { userId: t.user_id, email: t.email, changed: false };
      }
      if (db.prepare("SELECT 1 FROM users WHERE email = ? AND id != ?").get(t.email, t.user_id)) throw new UserError("email_taken", 409);
      db.prepare("UPDATE users SET email = ?, pending_email = NULL, email_verified_at = datetime('now') WHERE id = ?").run(t.email, t.user_id);
      db.prepare("UPDATE email_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL AND kind IN ('verify', 'reset')").run(t.user_id);
      return { userId: t.user_id, email: t.email, changed: true };
    });
  }
  throw new UserError("link_invalid", 410);
}

// ---------------------------------------------------------------------------------------------
// Email change: the new address must confirm; the old one is told.

export function requestEmailChange(u: User, newEmail: string): void {
  if (!mailReady()) throw new UserError("mail_not_configured", 503);
  limit(`email-change:${u.id}`, 5, 3600_000);
  db.prepare("UPDATE users SET pending_email = ? WHERE id = ?").run(newEmail, u.id);
  deliver(messages.emailChange(newEmail, site.brandName, link("/verify-email", issue(u.id, "email_change", newEmail))), "email change");
  deliver(messages.emailChangeNotice(u.email, site.brandName, newEmail), "email change notice");
}

export function cancelEmailChange(u: User): void {
  db.prepare("UPDATE users SET pending_email = NULL WHERE id = ?").run(u.id);
  db.prepare("UPDATE email_tokens SET used_at = datetime('now') WHERE user_id = ? AND kind = 'email_change' AND used_at IS NULL").run(u.id);
}

// ---------------------------------------------------------------------------------------------
// Password reset

/**
 * Always answers the same way. A link is only sent to an existing, active account, and at most three
 * times an hour per address; extra requests are silently dropped.
 */
export function requestReset(emailRaw: unknown): void {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new ValidationError({ email: "Write an email address with an @, such as name@example.com." });
  if (!mailReady()) throw new UserError("mail_not_configured", 503);
  const row = db.prepare("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL AND suspended_at IS NULL AND password_hash != ''").get(email) as any;
  if (!row) return;
  try { limit(`reset-send:${email}`, 3, 3600_000); } catch { return; }
  deliver(messages.reset(email, site.brandName, link("/reset-password", issue(row.id, "reset", email))), "reset");
}

/** Whether a reset link can still be used, and for which address (shown so password managers save it). */
export function checkReset(token: unknown): { ok: true; email: string } | { ok: false; reason: "invalid" | "expired" | "used" } {
  const t = find(token, "reset");
  if (typeof t === "string") return { ok: false, reason: t };
  const u = db.prepare("SELECT email FROM users WHERE id = ? AND deleted_at IS NULL").get(t.user_id) as any;
  if (!u || u.email !== t.email) return { ok: false, reason: "invalid" };
  return { ok: true, email: u.email };
}

/** Sets the new password, uses up the link and signs the account out everywhere. */
export function resetPassword(token: unknown, password: unknown, confirm: unknown): void {
  const errors: Record<string, string> = {};
  if (typeof password !== "string" || password.length < 8 || password.length > 200) errors.password = "Use a password of at least 8 characters.";
  else if (password !== confirm) errors.confirm = "The two passwords don't match.";
  const t = find(token, "reset");
  if (typeof t === "string") throw new UserError(`link_${t}`, 410);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const email = tx(() => {
    const u = db.prepare("SELECT email FROM users WHERE id = ? AND deleted_at IS NULL").get(t.user_id) as any;
    if (!u || u.email !== t.email) throw new UserError("link_invalid", 410);
    db.prepare("UPDATE email_tokens SET used_at = datetime('now') WHERE user_id = ? AND kind = 'reset' AND used_at IS NULL").run(t.user_id);
    // Receiving the link proves control of the address, so it also counts as confirming it.
    db.prepare("UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?")
      .run(hashPassword(password as string), t.user_id);
    endAllSessions(t.user_id);
    return u.email as string;
  });
  if (mailReady()) deliver(messages.passwordChanged(email, site.brandName), "password changed");
}

/**
 * Someone tried to sign up with an email that already has an account. The owner is told how to log in
 * or reset their password (with a fresh confirmation link if they never confirmed). At most three an
 * hour per account; extra attempts are dropped silently, so the public reply never changes.
 */
export function notifyExistingAccount(userId: number): void {
  if (!mailReady()) return;
  const u = userById(userId);
  if (!u) return;
  try { limit(`existing-notice:${userId}`, 3, 3600_000); } catch { return; }
  const confirm = u.emailVerified ? null : link("/verify-email", issue(u.id, "verify", u.email));
  deliver(messages.existingAccount(u.email, site.brandName, `${appUrl()}/signin`, `${appUrl()}/forgot-password`, confirm), "existing account");
}

export function notifyPasswordChanged(u: User): void {
  if (mailReady()) deliver(messages.passwordChanged(u.email, site.brandName), "password changed");
}

export { userById };
