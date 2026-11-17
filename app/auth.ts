// Accounts: email + password with cookie sessions, plus the eligibility rules every account must meet
// (18 or over, current Terms of Service accepted, not suspended). Passwords are hashed with scrypt;
// only a hash of each session token is stored. The age a person enters is checked and then discarded:
// we keep only that they confirmed they are 18 or over, when, and how.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db, tx } from "./db.ts";
import { privacyVersion, termsAvailable, termsVersion } from "./legal.ts";

export class UserError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; }
}

/** Per-field problems, with the sentence to show under each field. */
export class ValidationError extends UserError {
  fields: Record<string, string>;
  constructor(fields: Record<string, string>) { super("invalid_request", 422); this.fields = fields; }
}

export const MIN_AGE = 18;
const SESSION_DAYS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Passwords: scrypt from node:crypto (a standard memory-hard KDF), with a random 16-byte salt and the
// parameters stored alongside, so they can be raised later. Hashes made with the older, lighter
// parameters ("salt:hash") still verify and are upgraded the next time the person signs in.
const SCRYPT = { N: 65536, r: 8, p: 1 };
const scryptOpts = (N: number, r: number, p: number) => ({ N, r, p, maxmem: 256 * N * r });

export function hashPassword(password: string, salt = randomBytes(16)): string {
  const { N, r, p } = SCRYPT;
  return ["scrypt", N, r, p, salt.toString("hex"), scryptSync(password, salt, 64, scryptOpts(N, r, p)).toString("hex")].join("$");
}

function verifyPassword(password: string, stored: string): boolean {
  let salt: string, hash: string, N = 16384, r = 8, p = 1;
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 6) return false;
    [N, r, p] = parts.slice(1, 4).map(Number);
    [salt, hash] = parts.slice(4);
  } else [salt, hash] = stored.split(":");
  if (!salt || !hash) return false; // deleted accounts have no usable hash
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 64, scryptOpts(N, r, p));
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const needsRehash = (stored: string) => !stored.startsWith(["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, ""].join("$"));

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface User {
  id: number;
  email: string;
  name: string | null;
  credits: number;
  ageConfirmed: boolean;
  termsVersion: string | null;
  suspended: boolean;
  emailVerified: boolean;
  pendingEmail: string | null;
}

const USER_COLUMNS = "u.id, u.email, u.name, u.credits, u.age_confirmed_at, u.terms_version, u.suspended_at, u.email_verified_at, u.pending_email";
const toUser = (r: any): User => ({
  id: r.id, email: r.email, name: r.name ?? null, credits: r.credits,
  ageConfirmed: Boolean(r.age_confirmed_at), termsVersion: r.terms_version ?? null, suspended: Boolean(r.suspended_at),
  emailVerified: Boolean(r.email_verified_at), pendingEmail: r.pending_email ?? null,
});

/** What a signed-in person still has to do before they can upload, generate or buy. */
export function onboardingNeeds(u: User): { name: boolean; age: boolean; terms: boolean; email: boolean } {
  return { name: !u.name, age: !u.ageConfirmed, terms: u.termsVersion !== termsVersion(), email: !u.emailVerified };
}

/** Throws unless this account may use the parts of the service that process photos or take payment. */
export function requireEligible(u: User): void {
  if (u.suspended) throw new UserError("account_suspended", 403);
  const n = onboardingNeeds(u);
  if (n.name || n.age || n.terms) throw new UserError("onboarding_required", 403);
  if (n.email) throw new UserError("email_unverified", 403);
}

// ---------------------------------------------------------------------------------------------
// Field rules, shared by sign-up and onboarding

/** Age in completed years: a whole number, as a JSON number or digits. Anything else is invalid. */
export function parseAge(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 && v <= 120 ? v : null;
  if (typeof v === "string" && /^\s*\d{1,3}\s*$/.test(v)) { const n = Number(v); return n <= 120 ? n : null; }
  return null;
}

/** Names from any language: trimmed, single-spaced, no control or formatting characters. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFC").replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, "").replace(/\s+/g, " ").trim();
  return s.length >= 1 && s.length <= 100 && /\p{L}/u.test(s) ? s : null;
}

const fieldText = {
  name: "Write your name, as you'd like us to use it.",
  email: "Write an email address with an @, such as name@example.com.",
  password: "Use a password of at least 8 characters.",
  age: "Write your age in years, as a whole number.",
  agreeTerms: "To create an account, you need to agree to the Terms of Service.",
  confirmAdult: "Confirm that you are 18 or over.",
};

interface EligibilityInput { name?: unknown; age?: unknown; agreeTerms?: unknown; confirmAdult?: unknown; termsVersion?: unknown }

/**
 * Checks the eligibility answers. A valid age under 18 ends the request straight away with the same
 * reply whatever else was sent, and nothing about the attempt is stored.
 */
function checkEligibility(body: EligibilityInput, ask: { name: boolean; age: boolean; terms: boolean }, errors: Record<string, string>) {
  if (ask.age) {
    const age = parseAge(body.age);
    if (age !== null && age < MIN_AGE) throw new UserError("age_ineligible", 403);
    if (age === null) errors.age = fieldText.age;
    if (body.confirmAdult !== true) errors.confirmAdult = fieldText.confirmAdult;
  }
  if (ask.name && !cleanName(body.name)) errors.name = fieldText.name;
  if (ask.terms) {
    if (body.agreeTerms !== true) errors.agreeTerms = fieldText.agreeTerms;
    // The terms changed after the page was opened: they must see the current version first.
    else if (body.termsVersion !== termsVersion()) throw new UserError("terms_changed", 409);
  }
}

function recordEligibility(userId: number, ask: { name: boolean; age: boolean; terms: boolean }, name: string | null, source: string): void {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (ask.name && name) { sets.push("name = ?"); args.push(name); }
  if (ask.age) {
    sets.push("age_confirmed_at = datetime('now')", "age_method = 'self_declared'");
    db.prepare("INSERT INTO consent_events (user_id, kind, source) VALUES (?, 'age_confirmed', ?)").run(userId, source);
  }
  if (ask.terms) {
    sets.push("terms_version = ?", "terms_accepted_at = datetime('now')", "privacy_version_seen = ?");
    args.push(termsVersion(), privacyVersion());
    db.prepare("INSERT INTO consent_events (user_id, kind, version, source) VALUES (?, 'terms_accepted', ?, ?)").run(userId, termsVersion(), source);
    db.prepare("INSERT INTO consent_events (user_id, kind, version, source) VALUES (?, 'privacy_notice_shown', ?, ?)").run(userId, privacyVersion(), source);
  }
  if (sets.length) db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...args, userId);
}

// ---------------------------------------------------------------------------------------------

export function signup(body: any): User {
  if (!termsAvailable()) throw new UserError("signups_closed", 503);
  body = body && typeof body === "object" ? body : {};
  const errors: Record<string, string> = {};
  const all = { name: true, age: true, terms: true };
  checkEligibility(body, all, errors);
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) errors.email = fieldText.email;
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 200) errors.password = fieldText.password;
  if (Object.keys(errors).length) throw new ValidationError(errors);
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw new UserError("email_taken", 409);
  const name = cleanName(body.name)!;
  return tx(() => {
    const id = Number(db.prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)").run(email, hashPassword(body.password), name).lastInsertRowid);
    recordEligibility(id, all, name, "signup");
    return userById(id)!;
  });
}

/**
 * For accounts made before these checks existed, or when the terms change. Someone who now tells us
 * they are under 18 can't keep an account: the caller deletes it.
 */
export function completeOnboarding(u: User, body: any): User {
  body = body && typeof body === "object" ? body : {};
  const ask = onboardingNeeds(u);
  if (ask.terms && !termsAvailable()) throw new UserError("terms_unavailable", 503);
  const errors: Record<string, string> = {};
  checkEligibility(body, ask, errors);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  tx(() => recordEligibility(u.id, ask, cleanName(body.name), "onboarding"));
  return userById(u.id)!;
}

export function userById(id: number): User | null {
  const r = db.prepare(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ? AND u.deleted_at IS NULL`).get(id);
  return r ? toUser(r) : null;
}

// Slows password guessing: after 8 wrong passwords for one email, logins for it pause for 15 minutes.
// In memory, so it resets on restart; good enough for one server.
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60_000;
const fails = new Map<string, { n: number; until: number }>();

export function login(emailRaw: unknown, password: unknown): User {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  const f = fails.get(email);
  if (f && f.n >= MAX_FAILS && Date.now() < f.until) throw new UserError("too_many_attempts", 429);
  const row = db.prepare("SELECT id, password_hash, suspended_at FROM users WHERE email = ? AND deleted_at IS NULL").get(email) as any;
  // Same error for unknown email and wrong password, so accounts can't be enumerated.
  if (!row || typeof password !== "string" || !verifyPassword(password, row.password_hash)) {
    const cur = f && Date.now() < f.until ? f.n : 0;
    if (fails.size > 10_000) fails.clear();
    fails.set(email, { n: cur + 1, until: Date.now() + LOCK_MS });
    throw new UserError("bad_login", 401);
  }
  fails.delete(email);
  if (row.suspended_at) throw new UserError("account_suspended", 403);
  if (needsRehash(row.password_hash)) db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), row.id);
  return userById(row.id)!;
}

/** Checks the password of a signed-in person before a sensitive change. */
export function checkPassword(userId: number, password: unknown): void {
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as any;
  if (!row || typeof password !== "string" || !verifyPassword(password, row.password_hash)) throw new ValidationError({ password: "That password isn't right." });
}

/**
 * Saves the name straight away. A new email is only checked here: it takes effect when the link sent to
 * it is used (see emailflows.ts), so the caller gets it back as `newEmail`.
 */
export function updateProfile(u: User, body: any): { user: User; newEmail: string | null } {
  body = body && typeof body === "object" ? body : {};
  const errors: Record<string, string> = {};
  const name = body.name === undefined ? u.name : cleanName(body.name);
  if (!name) errors.name = fieldText.name;
  const email = body.email === undefined ? u.email : String(body.email).trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) errors.email = fieldText.email;
  if (Object.keys(errors).length) throw new ValidationError(errors);
  if (email !== u.email) {
    checkPassword(u.id, body.password); // changing the sign-in email needs the password
    if (db.prepare("SELECT 1 FROM users WHERE email = ? AND id != ?").get(email, u.id)) throw new UserError("email_taken", 409);
  }
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, u.id);
  return { user: userById(u.id)!, newEmail: email !== u.email ? email : null };
}

export function changePassword(u: User, current: unknown, next: unknown, keepToken: string | undefined): void {
  checkPassword(u.id, current);
  if (typeof next !== "string" || next.length < 8 || next.length > 200) throw new ValidationError({ newPassword: fieldText.password });
  tx(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), u.id);
    endOtherSessions(u.id, keepToken); // anyone else signed in with the old password is signed out
  });
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))")
    .run(sha(token), userId, `+${SESSION_DAYS} days`);
  return token;
}

export function userFromSession(token: string | undefined): User | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db.prepare(
    `SELECT ${USER_COLUMNS} FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.deleted_at IS NULL AND u.suspended_at IS NULL`).get(sha(token));
  return row ? toUser(row) : null;
}

export function endSession(token: string | undefined): void {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

/** Signs out every other browser or device. Returns how many sessions ended. */
export function endAllSessions(userId: number): number {
  return Number(db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId).changes);
}

export function endOtherSessions(userId: number, keepToken: string | undefined): number {
  const keep = keepToken ? sha(keepToken) : "";
  return Number(db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(userId, keep).changes);
}

export function sessionCount(userId: number): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > datetime('now')").get(userId) as any).n;
}

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 3600;
