// Email + password accounts with cookie sessions. Passwords are hashed with scrypt;
// only a hash of each session token is stored.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db.ts";

export class UserError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; }
}

const SESSION_DAYS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashPassword(password: string, salt = randomBytes(16)): string {
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface User { id: number; email: string; credits: number }

export function signup(email: string, password: string): User {
  email = String(email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) throw new UserError("invalid_email");
  if (typeof password !== "string" || password.length < 8 || password.length > 200) throw new UserError("weak_password");
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw new UserError("email_taken", 409);
  const r = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, hashPassword(password));
  return { id: Number(r.lastInsertRowid), email, credits: 0 };
}

// Slows password guessing: after 8 wrong passwords for one email, logins for it pause for 15 minutes.
// In memory, so it resets on restart; good enough for one server.
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60_000;
const fails = new Map<string, { n: number; until: number }>();

export function login(email: string, password: string): User {
  email = String(email ?? "").trim().toLowerCase();
  const f = fails.get(email);
  if (f && f.n >= MAX_FAILS && Date.now() < f.until) throw new UserError("too_many_attempts", 429);
  const row = db.prepare("SELECT id, email, credits, password_hash FROM users WHERE email = ?").get(email) as any;
  // Same error for unknown email and wrong password, so accounts can't be enumerated.
  if (!row || typeof password !== "string" || !verifyPassword(password, row.password_hash)) {
    const cur = f && Date.now() < f.until ? f.n : 0;
    if (fails.size > 10_000) fails.clear();
    fails.set(email, { n: cur + 1, until: Date.now() + LOCK_MS });
    throw new UserError("bad_login", 401);
  }
  fails.delete(email);
  return { id: row.id, email: row.email, credits: row.credits };
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))")
    .run(sha(token), userId, `+${SESSION_DAYS} days`);
  return token;
}

export function userFromSession(token: string | undefined): User | null {
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.id, u.email, u.credits FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`).get(sha(token)) as any;
  return row ? { id: row.id, email: row.email, credits: row.credits } : null;
}

export function endSession(token: string | undefined): void {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 3600;
