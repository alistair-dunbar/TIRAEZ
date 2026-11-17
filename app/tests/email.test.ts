// Email verification, password reset and email change, end to end through the real HTTP server.
// Mail goes to the in-memory outbox (MAIL=outbox, test-only); links are taken from the messages
// exactly as a person would receive them. Nothing is sent to anyone.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "mail-"));
process.env.PAYMENTS = "test";
process.env.ENGINE = "mock";
process.env.MAIL = "outbox";
process.env.APP_URL = "https://app.example.com";

const { server } = await import("../server.ts");
const { db } = await import("../db.ts");
const { outbox } = await import("../mail.ts");
const { termsVersion } = await import("../legal.ts");
const { resetLimits } = await import("../guard.ts");
const { runRetention } = await import("../account.ts");

let base = "";
before(() => new Promise<void>((r) => server.listen(0, () => { base = `http://localhost:${(server.address() as any).port}`; r(); })));
after(() => new Promise<void>((r) => { server.close(() => r()); }));
beforeEach(() => resetLimits());

function client() {
  let cookie = "";
  return async (method: string, path: string, body?: unknown, opts: { raw?: Buffer } = {}) => {
    const res = await fetch(base + path, {
      method, redirect: "manual",
      headers: { "X-Requested-With": "app", ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : opts.raw ? { "Content-Type": "application/octet-stream" } : {}) },
      body: opts.raw ? new Uint8Array(opts.raw) : body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, headers: res.headers, data: await res.json().catch(() => ({})) as any };
  };
}

const PHOTO = (() => {
  const f = join(mkdtempSync(join(tmpdir(), "img-")), "p.jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1200x1600", "-frames:v", "1", f]);
  return readFileSync(f);
})();

let n = 0;
const nextEmail = () => `mail${++n}@example.com`;
const settle = () => new Promise((r) => setTimeout(r, 20)); // messages are handed over after the response
/** The newest message to an address, and the token in its link. */
async function lastMail(to: string, path: string) {
  await settle();
  const m = [...outbox].reverse().find((x) => x.to === to && x.text.includes(path));
  assert.ok(m, `a message to ${to} with a ${path} link`);
  const url = new URL(/https:\/\/\S+/.exec(m.text.slice(m.text.indexOf(path) - 40))![0]);
  assert.equal(url.origin, "https://app.example.com", "links use APP_URL, never the request's Host header");
  assert.equal(url.pathname, path);
  return { m, token: url.searchParams.get("token")! };
}
const sentTo = (to: string) => outbox.filter((x) => x.to === to).length;

async function signUp(email = nextEmail()) {
  const c = client();
  const r = await c("POST", "/api/signup", { name: "Layla", email, password: "password123", age: "29", agreeTerms: true, confirmAdult: true, termsVersion: termsVersion() });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const login = await c("POST", "/api/login", { email, password: "password123" });
  assert.equal(login.status, 200);
  return { c, email, r, login };
}

// ---------------------------------------------------------------------------------------------

test("signup sends a confirmation link; unconfirmed accounts can sign in but not upload, generate or buy", async () => {
  const { c, email, r, login } = await signUp();
  assert.deepEqual(r.data, { ok: true });
  assert.equal(login.data.emailVerified, false);
  assert.equal(login.data.needs.email, true);
  const { m } = await lastMail(email, "/verify-email");
  assert.match(m.subject, /Confirm your email/);
  assert.doesNotMatch(m.html, /<img|<script/i, "no tracking pixels or scripts");
  for (const [method, path, body] of [["POST", "/api/photos", undefined], ["POST", "/api/jobs", {}], ["POST", "/api/purchases", { packId: "launch" }]] as const) {
    const res = path === "/api/photos" ? await c(method, path, undefined, { raw: PHOTO }) : await c(method, path, body);
    assert.equal(res.status, 403, path); assert.equal(res.data.error, "email_unverified", path);
  }
  assert.equal((await c("GET", "/api/account")).status, 200, "own account still reachable");
});

test("verification link: confirms once, unlocks uploads, then can't be reused; bad and expired links are refused", async () => {
  const { c, email } = await signUp();
  const { token } = await lastMail(email, "/verify-email");
  let r = await client()("POST", "/api/email/verify", { token }); // works from any browser: it is the link that proves control
  assert.equal(r.status, 200); assert.equal(r.data.email, email);
  assert.equal((await c("GET", "/api/site")).data.user.emailVerified, true);
  assert.equal((await c("POST", "/api/photos", undefined, { raw: PHOTO })).status, 200);
  r = await c("POST", "/api/email/verify", { token });
  assert.equal(r.status, 410); assert.equal(r.data.error, "link_used");
  assert.equal((await c("POST", "/api/email/verify", { token: "x".repeat(43) })).data.error, "link_invalid");
  assert.equal((await c("POST", "/api/email/verify", { token: "<script>" })).data.error, "link_invalid");

  const late = await signUp();
  const t2 = (await lastMail(late.email, "/verify-email")).token;
  db.prepare("UPDATE email_tokens SET expires_at = datetime('now', '-1 minute') WHERE email = ? AND kind = 'verify'").run(late.email);
  r = await late.c("POST", "/api/email/verify", { token: t2 });
  assert.equal(r.data.error, "link_expired");
  assert.equal((await late.c("GET", "/api/site")).data.user.emailVerified, false);
});

test("re-sending replaces the earlier link", async () => {
  const { c, email } = await signUp();
  const first = (await lastMail(email, "/verify-email")).token;
  assert.equal((await c("POST", "/api/email/resend")).status, 200);
  const second = (await lastMail(email, "/verify-email")).token;
  assert.notEqual(first, second);
  assert.equal((await c("POST", "/api/email/verify", { token: first })).data.error, "link_used");
  assert.equal((await c("POST", "/api/email/verify", { token: second })).status, 200);
});

test("tokens are stored only as hashes and never logged", async () => {
  const logs: string[] = [];
  const orig = { log: console.log, error: console.error };
  console.log = (...a) => { logs.push(a.join(" ")); }; console.error = (...a) => { logs.push(a.join(" ")); };
  try {
    const { email } = await signUp();
    const { token } = await lastMail(email, "/verify-email");
    const rows = db.prepare("SELECT token_hash FROM email_tokens WHERE email = ?").all(email) as any[];
    assert.ok(rows.length && rows.every((r) => r.token_hash !== token && r.token_hash.length === 64));
    await client()("POST", "/api/password/forgot", { email });
    await settle();
    assert.ok(!logs.some((l) => l.includes(token) || l.includes("password123")));
  } finally { Object.assign(console, orig); }
});

// ---------------------------------------------------------------------------------------------
// Password reset

test("password reset: neutral reply, single-use link, new password works, old one doesn't, sessions end", async () => {
  const { c, email } = await signUp();
  const other = client();
  await other("POST", "/api/login", { email, password: "password123" });

  const before = outbox.length;
  const unknown = await client()("POST", "/api/password/forgot", { email: "nobody-here@example.com" });
  const known = await client()("POST", "/api/password/forgot", { email: email.toUpperCase() });
  assert.deepEqual(unknown.data, known.data, "same answer whether or not the account exists");
  assert.equal(unknown.status, 200);
  await settle();
  assert.equal(outbox.length, before + 1, "only the real account gets an email");

  const { token, m } = await lastMail(email, "/reset-password");
  assert.match(m.text, /expires in 1 hour/);
  const check = await client()("GET", `/api/password/reset?token=${token}`);
  assert.deepEqual(check.data, { ok: true, email });

  let r = await client()("POST", "/api/password/reset", { token, password: "short", confirm: "short" });
  assert.equal(r.status, 422); assert.ok(r.data.fields.password);
  r = await client()("POST", "/api/password/reset", { token, password: "a-new-password", confirm: "different-one" });
  assert.equal(r.status, 422); assert.ok(r.data.fields.confirm);
  r = await client()("POST", "/api/password/reset", { token, password: "a-new-password", confirm: "a-new-password" });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie") ?? "", /Max-Age=0/);

  assert.equal((await c("GET", "/api/site")).data.user, null, "existing sessions ended");
  assert.equal((await other("GET", "/api/site")).data.user, null);
  assert.equal((await client()("POST", "/api/login", { email, password: "password123" })).status, 401, "old password refused");
  assert.equal((await client()("POST", "/api/login", { email, password: "a-new-password" })).status, 200, "new password works");
  r = await client()("POST", "/api/password/reset", { token, password: "third-password", confirm: "third-password" });
  assert.equal(r.status, 410); assert.equal(r.data.error, "link_used");
  assert.deepEqual((await client()("GET", `/api/password/reset?token=${token}`)).data, { ok: false, reason: "used" });
  await settle();
  assert.ok(outbox.some((x) => x.to === email && /password was changed/.test(x.subject)), "the account is told its password changed");
});

test("password reset: expired and invalid links, and a newer link replaces an older one", async () => {
  const { email } = await signUp();
  await client()("POST", "/api/password/forgot", { email });
  const old = (await lastMail(email, "/reset-password")).token;
  await client()("POST", "/api/password/forgot", { email });
  const fresh = (await lastMail(email, "/reset-password")).token;
  assert.deepEqual((await client()("GET", `/api/password/reset?token=${old}`)).data, { ok: false, reason: "used" });
  db.prepare("UPDATE email_tokens SET expires_at = datetime('now', '-1 second') WHERE email = ? AND kind = 'reset' AND used_at IS NULL").run(email);
  assert.deepEqual((await client()("GET", `/api/password/reset?token=${fresh}`)).data, { ok: false, reason: "expired" });
  const r = await client()("POST", "/api/password/reset", { token: fresh, password: "a-new-password", confirm: "a-new-password" });
  assert.equal(r.data.error, "link_expired");
  assert.deepEqual((await client()("GET", "/api/password/reset?token=nonsense")).data, { ok: false, reason: "invalid" });
  assert.equal((await client()("POST", "/api/login", { email, password: "password123" })).status, 200, "password unchanged");
});

test("password reset is rate-limited without changing the reply", async () => {
  const { email } = await signUp();
  await settle();
  const before = sentTo(email);
  for (let i = 0; i < 5; i++) assert.equal((await client()("POST", "/api/password/forgot", { email })).status, 200);
  await settle();
  assert.equal(sentTo(email) - before, 3, "at most 3 links an hour per address");
  for (let i = 0; i < 10; i++) await client()("POST", "/api/password/forgot", { email: nextEmail() });
  assert.equal((await client()("POST", "/api/password/forgot", { email })).status, 429, "and at most 10 requests an hour per visitor");
});

test("password reset works for an account that never confirmed its email, and confirms it", async () => {
  const { email } = await signUp();
  await client()("POST", "/api/password/forgot", { email });
  const { token } = await lastMail(email, "/reset-password");
  await client()("POST", "/api/password/reset", { token, password: "a-new-password", confirm: "a-new-password" });
  const c = client();
  assert.equal((await c("POST", "/api/login", { email, password: "a-new-password" })).data.emailVerified, true);
});

// ---------------------------------------------------------------------------------------------
// Email change

test("email change: needs the password, confirms at the new address, tells the old one, then switches", async () => {
  const { c, email } = await signUp();
  await c("POST", "/api/email/verify", { token: (await lastMail(email, "/verify-email")).token });
  const newEmail = nextEmail();
  assert.equal((await c("POST", "/api/account/profile", { email: newEmail })).status, 422, "password required");
  const r = await c("POST", "/api/account/profile", { email: newEmail, password: "password123" });
  assert.equal(r.data.pendingEmail, newEmail);
  assert.equal(r.data.user.email, email, "not changed yet");
  await settle();
  assert.ok(outbox.some((m) => m.to === email && /email is changing/.test(m.subject)), "old address told");
  const { token } = await lastMail(newEmail, "/verify-email");
  const v = await c("POST", "/api/email/verify", { token });
  assert.equal(v.data.changed, true);
  assert.equal((await c("GET", "/api/site")).data.user.email, newEmail);
  assert.equal((await client()("POST", "/api/login", { email: newEmail, password: "password123" })).status, 200);
  assert.equal((await client()("POST", "/api/login", { email, password: "password123" })).status, 401);
});

test("email change: cancelling voids the link, and a taken address is refused", async () => {
  const { c, email } = await signUp();
  const target = nextEmail();
  await c("POST", "/api/account/profile", { email: target, password: "password123" });
  const { token } = await lastMail(target, "/verify-email");
  await c("POST", "/api/account/email/cancel");
  assert.equal((await c("POST", "/api/email/verify", { token })).data.error, "link_used");
  assert.equal((await c("GET", "/api/site")).data.user.email, email);
  const taken = await signUp();
  assert.equal((await c("POST", "/api/account/profile", { email: taken.email, password: "password123" })).status, 409);
});

// ---------------------------------------------------------------------------------------------

test("abandoned sign-ups that never confirmed are deleted after the retention period", async () => {
  const { email } = await signUp();
  const id = (db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any).id;
  db.prepare("UPDATE users SET created_at = datetime('now', '-31 days') WHERE id = ?").run(id);
  const r = runRetention();
  assert.ok(r.unverified >= 1);
  assert.equal(db.prepare("SELECT 1 FROM users WHERE id = ?").get(id), undefined);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM email_tokens WHERE user_id = ?").get(id) as any).n, 0);
});

test("pages for the email flows are served", async () => {
  for (const p of ["/verify-email", "/forgot-password", "/reset-password"]) assert.equal((await fetch(base + p)).status, 200, p);
  const site = await (await fetch(base + "/api/site")).json();
  assert.equal(site.mailOn, true);
});

test("signing up with an email that already has an account: same reply, nothing created, the owner is emailed", async () => {
  const { email } = await signUp();
  await settle();
  const before = sentTo(email);
  const users = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as any).n;
  const fresh = await client()("POST", "/api/signup", { name: "New", email: nextEmail(), password: "password123", age: "40", agreeTerms: true, confirmAdult: true, termsVersion: termsVersion() });
  const dup = await client()("POST", "/api/signup", { name: "Someone", email: email.toUpperCase(), password: "different-pass", age: "40", agreeTerms: true, confirmAdult: true, termsVersion: termsVersion() });
  assert.equal(dup.status, fresh.status);
  assert.deepEqual(dup.data, fresh.data);
  assert.equal(dup.headers.get("set-cookie"), fresh.headers.get("set-cookie"));
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM users").get() as any).n, users + 1, "only the new address created an account");
  await settle();
  const notice = [...outbox].reverse().find((m) => m.to === email);
  assert.ok(sentTo(email) === before + 1 && /already have/.test(notice!.subject), "the owner is told, with log-in and reset links");
  assert.match(notice!.text, /\/forgot-password/);
  assert.equal((await client()("POST", "/api/login", { email, password: "different-pass" })).status, 401, "the existing password is unchanged");
});
