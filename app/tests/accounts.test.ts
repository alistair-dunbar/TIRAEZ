// Eligibility, consent records, legal gating, account controls, deletion, reports, limits and headers.
// Runs against the real HTTP server with the test-only mock provider; nothing reaches a paid service.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "acc-"));
process.env.PAYMENTS = "test";
process.env.ENGINE = "mock";
process.env.JOB_POLL_MS = "5";

const { server } = await import("../server.ts");
const { idle } = await import("../jobs.ts");
const { db } = await import("../db.ts");
const { grantCredits } = await import("../credits.ts");
const { legal, business, retention, compliance, termsVersion, LEGAL_DOCS } = await import("../legal.ts");
const { resetLimits, redact } = await import("../guard.ts");
const { liftAgeRestriction } = await import("../account.ts");
const { runRetention } = await import("../retention.ts");
const { refundPurchase, creditSummary } = await import("../credits.ts");
const { suspend } = await import("../reports.ts");

let base = "";
before(() => new Promise<void>((r) => server.listen(0, () => { base = `http://localhost:${(server.address() as any).port}`; r(); })));
after(() => new Promise<void>((r) => { server.close(() => r()); }));
beforeEach(() => resetLimits());

function client() {
  let cookie = "";
  return async (method: string, path: string, body?: unknown, opts: { raw?: Buffer; noHeader?: boolean } = {}) => {
    const res = await fetch(base + path, {
      method, redirect: "manual",
      headers: { ...(opts.noHeader ? {} : { "X-Requested-With": "app" }), ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : opts.raw ? { "Content-Type": "application/octet-stream" } : {}) },
      body: opts.raw ? new Uint8Array(opts.raw) : body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const type = res.headers.get("content-type") ?? "";
    return { status: res.status, headers: res.headers, data: type.includes("json") ? await res.json() : await res.text() as any, cookie: () => cookie };
  };
}

const tmp = mkdtempSync(join(tmpdir(), "img-"));
const PHOTO = (() => {
  const f = join(tmp, "p.jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1200x1600", "-frames:v", "1", f]);
  return readFileSync(f);
})();

let n = 0;
const email = () => `person${++n}@example.com`;
const body = (over: Record<string, unknown> = {}) => ({
  name: "Nour Al-Harbi", email: email(), password: "password123", age: "18", agreeTerms: true, confirmAdult: true, termsVersion: termsVersion(), ...over,
});
const userCount = () => (db.prepare("SELECT COUNT(*) AS n FROM users").get() as any).n as number;

async function eligibleUser(credits = 0) {
  const c = client();
  const b = body();
  const r = await c("POST", "/api/signup", b);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE email = ?").run(b.email); // email flows: email.test.ts
  assert.equal((await c("POST", "/api/login", { email: b.email, password: "password123" })).status, 200);
  if (credits) grantCredits(b.email as string, credits, "test");
  return { c, email: b.email as string };
}

/** An account made before the eligibility checks existed: no name, no age record, no terms. */
async function legacyUser() {
  const c = client();
  const e = email();
  const r = await c("POST", "/api/signup", body({ email: e }));
  assert.equal(r.status, 200);
  assert.equal((await c("POST", "/api/login", { email: e, password: "password123" })).status, 200);
  db.prepare("UPDATE users SET name = NULL, age_confirmed_at = NULL, age_method = NULL, terms_version = NULL, terms_accepted_at = NULL, email_verified_at = datetime('now') WHERE email = ?").run(e);
  return { c, email: e };
}

function order(photoId: string) {
  const w = 0.75, h = (1200 * 0.75) / (9 / 16) / 1600;
  return {
    templateId: "coffee-morning-bar", clientKey: `key-${Math.random().toString(36).slice(2)}`, photoId,
    crop: { x: 0.1, y: 0, w, h }, inputs: { subject: "Espresso machine on an oak counter", motion: "push" },
    settings: { aspectRatio: "9:16", duration: 5, resolution: "1080p" },
  };
}

// ---------------------------------------------------------------------------------------------
// Age

test("signup: age 18 is accepted; only the eligibility record is kept, never the age", async () => {
  const c = client();
  const b = body({ age: "18" });
  const r = await c("POST", "/api/signup", b);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true });
  assert.equal(r.headers.get("set-cookie"), null, "nobody is logged in by signing up");
  const login = await c("POST", "/api/login", { email: b.email, password: "password123" });
  assert.deepEqual(login.data.needs, { name: false, age: false, terms: false, email: true });
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(b.email) as any;
  assert.ok(row.age_confirmed_at);
  assert.equal(row.age_method, "self_declared");
  assert.equal(row.terms_version, termsVersion());
  assert.ok(row.terms_accepted_at);
  assert.equal(row.name, "Nour Al-Harbi");
  assert.ok(!Object.values(row).includes(18) && !Object.values(row).includes("18"), "the age itself is not stored");
  const kinds = (db.prepare("SELECT kind, version FROM consent_events WHERE user_id = ?").all(row.id) as any[]).map((e) => e.kind).sort();
  assert.deepEqual(kinds, ["age_confirmed", "privacy_notice_shown", "terms_accepted"]);
});

test("signup: age 17 is refused with nothing stored, whatever else is sent", async () => {
  const before = userCount();
  for (const over of [{ age: "17" }, { age: 17 }, { age: "0" }, { age: "17", agreeTerms: false, confirmAdult: false, email: "bad" }, { age: " 12 " }]) {
    const r = await client()("POST", "/api/signup", body(over));
    assert.equal(r.status, 403, JSON.stringify(over));
    assert.equal(r.data.error, "age_ineligible");
    assert.equal(r.headers.get("set-cookie"), null);
  }
  assert.equal(userCount(), before);
});

test("signup: missing or invalid age, unticked boxes and stale terms are refused per field", async () => {
  const before = userCount();
  for (const age of [undefined, "", "abc", "18.5", 18.5, "-18", "1e2", "121", "18 years", null, true, [18]]) {
    resetLimits(); // every attempt counts towards the signup limit
    const r = await client()("POST", "/api/signup", body({ age }));
    assert.equal(r.status, 422, `age ${JSON.stringify(age)}`);
    assert.ok(r.data.fields.age);
  }
  resetLimits();
  let r = await client()("POST", "/api/signup", body({ agreeTerms: undefined }));
  assert.equal(r.status, 422); assert.ok(r.data.fields.agreeTerms);
  r = await client()("POST", "/api/signup", body({ agreeTerms: "true" })); // must be a real true, not a truthy string
  assert.equal(r.status, 422); assert.ok(r.data.fields.agreeTerms);
  r = await client()("POST", "/api/signup", body({ confirmAdult: false }));
  assert.equal(r.status, 422); assert.ok(r.data.fields.confirmAdult);
  r = await client()("POST", "/api/signup", body({ name: "   " }));
  assert.equal(r.status, 422); assert.ok(r.data.fields.name);
  r = await client()("POST", "/api/signup", body({ termsVersion: "1999-01-01" }));
  assert.equal(r.status, 409); assert.equal(r.data.error, "terms_changed");
  r = await client()("POST", "/api/signup", { email: email(), password: "password123" }); // the old request shape
  assert.equal(r.status, 422); assert.ok(r.data.fields.age && r.data.fields.agreeTerms && r.data.fields.confirmAdult && r.data.fields.name);
  assert.equal(userCount(), before);
});

test("names from any language are accepted; control characters are removed", async () => {
  const nameOf = (e: string) => (db.prepare("SELECT name FROM users WHERE email = ?").get(e) as any).name;
  for (const name of ["محمد العتيبي", "Zoë O'Brien-Núñez", "李小龍", "A"]) {
    const b = body({ name });
    assert.equal((await client()("POST", "/api/signup", b)).status, 200, name);
    assert.equal(nameOf(b.email as string), name);
  }
  const b = body({ name: "Sara\u0000‮ Ali" });
  await client()("POST", "/api/signup", b);
  assert.equal(nameOf(b.email as string), "Sara Ali");
});

// ---------------------------------------------------------------------------------------------
// Onboarding and the eligibility gate

test("an account without onboarding can't upload, generate or buy, but can see and export its data", async () => {
  const { c } = await legacyUser();
  const site = (await c("GET", "/api/site")).data;
  assert.deepEqual(site.user.needs, { name: true, age: true, terms: true, email: false });
  assert.equal((await c("POST", "/api/photos", undefined, { raw: PHOTO })).data.error, "onboarding_required");
  assert.equal((await c("POST", "/api/jobs", order("0".repeat(24)))).data.error, "onboarding_required");
  assert.equal((await c("POST", "/api/purchases", { packId: "launch" })).data.error, "onboarding_required");
  assert.equal((await c("GET", "/api/jobs")).status, 200);
  assert.equal((await c("GET", "/api/account")).status, 200);
  assert.equal((await c("GET", "/api/account/export")).status, 200);
});

test("onboarding: completing it unlocks uploads; partial answers are refused", async () => {
  const { c } = await legacyUser();
  let r = await c("POST", "/api/onboarding", { name: "Faisal", age: "40", confirmAdult: true });
  assert.equal(r.status, 422); assert.ok(r.data.fields.agreeTerms);
  r = await c("POST", "/api/onboarding", { name: "Faisal", age: "forty", confirmAdult: true, agreeTerms: true, termsVersion: termsVersion() });
  assert.equal(r.status, 422); assert.ok(r.data.fields.age);
  r = await c("POST", "/api/onboarding", { name: "Faisal", age: "40", confirmAdult: true, agreeTerms: true, termsVersion: termsVersion() });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.needs, { name: false, age: false, terms: false, email: false });
  assert.equal((await c("POST", "/api/photos", undefined, { raw: PHOTO })).status, 200);
});

test("onboarding: an existing account declaring under 18 is restricted, not deleted; it can't re-declare; review lifts it", async () => {
  const { c, email: e } = await legacyUser();
  const id = (db.prepare("SELECT id FROM users WHERE email = ?").get(e) as any).id;
  grantCredits(e, 2, "test");
  db.prepare("UPDATE users SET name = 'Kid' WHERE id = ?").run(id);
  // A paid purchase and a queued video, to check both are handled.
  const pid = Number(db.prepare("INSERT INTO purchases (user_id, pack_id, credits, price_sar, provider, status) VALUES (?, 'launch', 15, 250, 'test', 'paid')").run(id).lastInsertRowid);
  const r = await c("POST", "/api/onboarding", { name: "Kid", age: "16", confirmAdult: true, agreeTerms: true, termsVersion: termsVersion() });
  assert.equal(r.status, 403);
  assert.equal(r.data.error, "age_restricted");
  assert.equal(r.data.user.ageRestricted, true);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  assert.ok(row.age_restricted_at && !row.deleted_at, "restricted, not deleted");
  assert.ok((await c("GET", "/api/site")).data.user, "still logged in, to see what happened");
  for (const [path, opts] of [["/api/photos", { raw: PHOTO }], ["/api/jobs", undefined], ["/api/purchases", undefined]] as const) {
    const res = await c("POST", path, path === "/api/photos" ? undefined : path === "/api/jobs" ? order("0".repeat(24)) : { packId: "launch" }, opts ?? {});
    assert.equal(res.data.error, "age_restricted", path);
  }
  const again = await c("POST", "/api/onboarding", { name: "Kid", age: "30", confirmAdult: true, agreeTerms: true, termsVersion: termsVersion() });
  assert.equal(again.data.error, "age_restricted", "re-entering a different age is not a way round it");
  assert.equal((await c("GET", "/api/account/export")).status, 200, "own data still downloadable");
  const req = db.prepare("SELECT * FROM refund_requests WHERE purchase_id = ?").get(pid) as any;
  assert.equal(req.status, "open"); assert.equal(req.reason, "age_restriction");
  // A reviewed correction lifts it, and the age has to be confirmed again.
  assert.ok(liftAgeRestriction(id, "report 1: typo"));
  const site = (await c("GET", "/api/site")).data;
  assert.equal(site.user.ageRestricted, false); assert.equal(site.user.needs.age, true);
  assert.equal((await c("POST", "/api/onboarding", { age: "30", confirmAdult: true, agreeTerms: true, termsVersion: termsVersion() })).status, 200);
});

test("restricted accounts are deleted after the retention period unless corrected", async () => {
  const { c, email: e } = await legacyUser();
  const id = (db.prepare("SELECT id FROM users WHERE email = ?").get(e) as any).id;
  await c("POST", "/api/onboarding", { name: "Kid", age: "15", confirmAdult: true, agreeTerms: true, termsVersion: termsVersion() });
  await runRetention();
  assert.ok(db.prepare("SELECT 1 FROM users WHERE id = ?").get(id), "kept during the period");
  db.prepare("UPDATE users SET age_restricted_at = datetime('now', ?) WHERE id = ?").run(`-${retention.ageRestrictedDays + 1} days`, id);
  await runRetention();
  assert.equal(db.prepare("SELECT 1 FROM users WHERE id = ?").get(id), undefined);
});

test("new terms version: eligible accounts must accept it again before generating", async () => {
  const { c } = await eligibleUser();
  const old = legal.documents.terms.version;
  legal.documents.terms.version = "2099-01-01-test";
  try {
    const site = (await c("GET", "/api/site")).data;
    assert.deepEqual(site.user.needs, { name: false, age: false, terms: true, email: false });
    assert.equal((await c("POST", "/api/photos", undefined, { raw: PHOTO })).data.error, "onboarding_required");
    const r = await c("POST", "/api/onboarding", { agreeTerms: true, termsVersion: "2099-01-01-test" });
    assert.equal(r.status, 200);
    assert.equal((await c("POST", "/api/photos", undefined, { raw: PHOTO })).status, 200);
  } finally { legal.documents.terms.version = old; }
});

test("suspended accounts are signed out and can't sign in", async () => {
  const { c, email: e } = await eligibleUser();
  assert.ok(suspend(e, "test"));
  assert.equal((await c("GET", "/api/site")).data.user, null);
  const r = await client()("POST", "/api/login", { email: e, password: "password123" });
  assert.equal(r.status, 403); assert.equal(r.data.error, "account_suspended");
});

// ---------------------------------------------------------------------------------------------
// Legal pages and production gating

test("legal pages: server-rendered, every footer link works, drafts are marked", async () => {
  const shell = await (await fetch(base + "/")).text();
  for (const href of ["/legal/terms", "/legal/privacy", "/legal/acceptable-use", "/legal/billing", "/legal/cookies", "/legal/contact", "/report"]) {
    assert.match(shell, new RegExp(`href="${href}"`), `footer links to ${href}`);
    const r = await fetch(base + href);
    assert.equal(r.status, 200, href);
  }
  for (const slug of LEGAL_DOCS) {
    const html = await (await fetch(`${base}/legal/${slug}`)).text();
    assert.match(html, /data-static="\/legal\//);
    assert.match(html, /<h1 class="h1">/);
    assert.doesNotMatch(html, /\{\{/, `${slug} has no raw tokens`);
    // Pages still waiting for operator facts are marked as drafts; complete ones aren't.
    if (/mark class="todo"/.test(html)) assert.match(html, /Draft for review, not in force/);
    else assert.doesNotMatch(html, /Draft for review/);
  }
  assert.equal((await fetch(base + "/legal/nothing")).status, 404);
});

test("production: draft policies are withheld and accounts can't open", async () => {
  process.env.LEGAL_ENFORCE = "1";
  const savedStatus = legal.status;
  legal.status = "draft";
  try {
    const html = await (await fetch(`${base}/legal/terms`)).text();
    assert.match(html, /being prepared/);
    assert.doesNotMatch(html, /to confirm/);
    assert.doesNotMatch(html, /Draft for review/);
    assert.equal((await fetch(`${base}/legal/privacy`)).headers.get("x-robots-tag"), "noindex");
    const r = await client()("POST", "/api/signup", body());
    assert.equal(r.status, 503); assert.equal(r.data.error, "signups_closed");
    assert.equal((await client()("GET", "/api/site")).data.signupsOpen, false);
  } finally { delete process.env.LEGAL_ENFORCE; legal.status = savedStatus; }
});

test("production: once every fact is confirmed and the status is published, policies appear and signups open", async () => {
  const saved = { status: legal.status, unresolved: { ...legal.unresolved }, business: { ...business }, confirmed: retention.confirmed,
    effective: Object.fromEntries(Object.entries(legal.documents).map(([k, d]) => [k, d.effective])) };
  process.env.LEGAL_ENFORCE = "1";
  try {
    for (const k of Object.keys(business)) if (!k.startsWith("_")) business[k] = k.endsWith("Email") ? "help@example.com" : `Example ${k}`;
    for (const k of Object.keys(legal.unresolved)) legal.unresolved[k] = `Confirmed text for ${k}.`;
    for (const d of Object.values(legal.documents)) d.effective = "1 January 2027";
    retention.confirmed = true;
    legal.status = "draft";
    assert.equal((await client()("POST", "/api/signup", body())).status, 503, "still draft until status is published");
    legal.status = "published";
    const html0 = await (await fetch(`${base}/legal/billing`)).text();
    assert.doesNotMatch(html0, /mark class="todo"|being prepared/, "policies publish once facts are confirmed");
    assert.equal((await client()("POST", "/api/signup", body())).status, 200, "accounts open once Terms and Privacy are live");
    for (const t of Object.values(compliance.transfers)) { t.mechanism = "SDAIA SCCs signed 2027-01-01"; t.riskAssessment = "transfers-ra.pdf, 2027-01-01"; }
    const html = await (await fetch(`${base}/legal/billing`)).text();
    assert.doesNotMatch(html, /mark class="todo"|being prepared|Draft for review/);
    assert.match(html, /mailto:help@example.com/);
    assert.equal((await client()("POST", "/api/signup", body())).status, 200);
  } finally {
    delete process.env.LEGAL_ENFORCE;
    legal.status = saved.status; Object.assign(legal.unresolved, saved.unresolved); Object.assign(business, saved.business);
    retention.confirmed = saved.confirmed;
    for (const [k, v] of Object.entries(saved.effective)) legal.documents[k].effective = v;
    for (const t of Object.values(compliance.transfers)) { t.mechanism = null; t.riskAssessment = null; }
  }
});

// ---------------------------------------------------------------------------------------------
// Account controls

test("profile: name changes freely; email changes need the password", async () => {
  const { c } = await eligibleUser();
  let r = await c("POST", "/api/account/profile", { name: "New Name" });
  assert.equal(r.status, 200); assert.equal(r.data.user.name, "New Name");
  const e = email();
  r = await c("POST", "/api/account/profile", { email: e });
  assert.equal(r.status, 422); assert.ok(r.data.fields.password);
  r = await c("POST", "/api/account/profile", { email: e, password: "password123" });
  assert.equal(r.status, 200); assert.equal(r.data.pendingEmail, e);
  assert.notEqual(r.data.user.email, e, "the email only changes once the new address confirms (email.test.ts)");
});

test("password change and sign out everywhere end the other sessions only", async () => {
  const { c, email: e } = await eligibleUser();
  const other = client();
  await other("POST", "/api/login", { email: e, password: "password123" });
  assert.ok((await other("GET", "/api/site")).data.user);
  assert.equal((await c("POST", "/api/account/sessions/revoke")).data.ended, 1);
  assert.equal((await other("GET", "/api/site")).data.user, null);
  assert.ok((await c("GET", "/api/site")).data.user, "this session stays");

  await other("POST", "/api/login", { email: e, password: "password123" });
  assert.equal((await c("POST", "/api/account/password", { currentPassword: "wrong-one", newPassword: "another-password" })).status, 422);
  assert.equal((await c("POST", "/api/account/password", { currentPassword: "password123", newPassword: "another-password" })).status, 200);
  assert.equal((await other("GET", "/api/site")).data.user, null);
  assert.equal((await client()("POST", "/api/login", { email: e, password: "another-password" })).status, 200);
});

test("export: the account's own data, never the age, prompts or anyone else's data", async () => {
  const { c, email: e } = await eligibleUser(3);
  const photo = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  await c("POST", "/api/jobs", order(photo.id));
  await idle();
  const someoneElse = await eligibleUser();
  const r = await c("GET", "/api/account/export");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-disposition") ?? "", /attachment; filename=".*-data-\d{4}-\d{2}-\d{2}\.json"/);
  const d = r.data;
  assert.equal(d.account.email, e);
  assert.ok(d.account.eligibility.confirmedAdultAt);
  assert.equal(d.videos.length, 1);
  assert.equal(d.photos.length, 1);
  assert.ok(d.agreements.length >= 3);
  const text = JSON.stringify(d);
  assert.doesNotMatch(text, /"age"\s*:/);
  assert.doesNotMatch(text, /password/i);
  assert.ok(!text.includes(someoneElse.email));
  assert.ok(!text.includes("prompt\":"), "assembled prompts stay server-side");
});

test("deleting a video removes its files and record; other people's videos can't be deleted", async () => {
  const { c } = await eligibleUser(3);
  const photo = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  const job = (await c("POST", "/api/jobs", order(photo.id))).data.job;
  await idle();
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(job.id) as any;
  assert.ok(existsSync(row.output_file));
  const stranger = await eligibleUser();
  assert.equal((await stranger.c("DELETE", `/api/jobs/${job.id}`)).status, 404);
  assert.equal((await c("DELETE", `/api/jobs/${job.id}`, undefined, { noHeader: true })).status, 403);
  assert.equal((await c("DELETE", `/api/jobs/${job.id}`)).status, 200);
  assert.equal(db.prepare("SELECT 1 FROM jobs WHERE id = ?").get(job.id), undefined);
  for (const f of [row.output_file, row.poster_file, row.source_file]) assert.ok(!existsSync(f), `${f} removed`);
  assert.equal(db.prepare("SELECT 1 FROM photos WHERE id = ?").get(photo.id), undefined, "unused photo removed too");
  assert.equal((await c("GET", `/api/jobs/${job.id}`)).status, 404);
});

test("account deletion: needs the password, then really deletes rows and files; purchases are kept anonymously", async () => {
  const { c, email: e } = await eligibleUser();
  await c("POST", "/api/purchases", { packId: "launch" }); // test payments grant straight away
  const id = (db.prepare("SELECT id FROM users WHERE email = ?").get(e) as any).id;
  const photo = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  const job = (await c("POST", "/api/jobs", order(photo.id))).data.job;
  await idle();
  const files = db.prepare("SELECT output_file, poster_file, source_file FROM jobs WHERE id = ?").get(job.id) as any;
  const photoFile = (db.prepare("SELECT file FROM photos WHERE id = ?").get(photo.id) as any).file;

  assert.equal((await c("POST", "/api/account/delete", { password: "wrong", confirm: "delete" })).status, 422);
  assert.equal((await c("POST", "/api/account/delete", { password: "password123" })).status, 400, "needs the explicit confirmation");
  const r = await c("POST", "/api/account/delete", { password: "password123", confirm: "delete" });
  assert.equal(r.status, 200);
  assert.equal(r.data.purchaseRecordsKept, 1);

  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  assert.ok(u.deleted_at); assert.equal(u.name, null); assert.ok(!u.email.includes("example.com")); assert.equal(u.password_hash, "");
  for (const t of ["jobs", "photos", "sessions", "consent_events"]) assert.equal((db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).get(id) as any).n, 0, t);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM purchases WHERE user_id = ?").get(id) as any).n, 1);
  for (const f of [...Object.values(files), photoFile]) assert.ok(!existsSync(f as string), `${f} removed`);
  assert.equal((await c("GET", "/api/site")).data.user, null);
  assert.equal((await client()("POST", "/api/login", { email: e, password: "password123" })).status, 401);
  // The email can be used again for a new account.
  assert.equal((await client()("POST", "/api/signup", body({ email: e }))).status, 200);
});

test("account deletion waits while a video is being made", async () => {
  const { c } = await eligibleUser(3);
  const photo = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  const job = (await c("POST", "/api/jobs", order(photo.id))).data.job;
  db.prepare("UPDATE jobs SET status = 'in_progress' WHERE id = ?").run(job.id);
  await idle();
  db.prepare("UPDATE jobs SET status = 'in_progress' WHERE id = ?").run(job.id);
  const r = await c("POST", "/api/account/delete", { password: "password123", confirm: "delete" });
  assert.equal(r.status, 409); assert.equal(r.data.error, "jobs_active");
  assert.equal((await c("DELETE", `/api/jobs/${job.id}`)).data.error, "job_active");
  db.prepare("UPDATE jobs SET status = 'failed' WHERE id = ?").run(job.id);
});

// ---------------------------------------------------------------------------------------------
// Retention, reports, limits, headers, logs

test("retention: unused photos past the limit, expired sessions and partial uploads are removed", async () => {
  const { c } = await eligibleUser();
  const photo = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  const file = (db.prepare("SELECT file FROM photos WHERE id = ?").get(photo.id) as any).file;
  db.prepare("UPDATE photos SET created_at = datetime('now', ?) WHERE id = ?").run(`-${retention.abandonedUploadDays + 1} days`, photo.id);
  db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 minute') WHERE token_hash = (SELECT token_hash FROM sessions ORDER BY rowid DESC LIMIT 1)").run();
  const stray = join(process.env.DATA_DIR!, "photos", "stray.upload");
  writeFileSync(stray, "x");
  utimesSync(stray, new Date(Date.now() - 2 * 3600_000), new Date(Date.now() - 2 * 3600_000));
  const r = await runRetention();
  assert.ok(r.abandoned >= 1 && r.sessions >= 1 && r.strays >= 1);
  assert.ok(!existsSync(file)); assert.ok(!existsSync(stray));
});

test("reports: stored for review, validated, available signed out", async () => {
  let r = await client()("POST", "/api/reports", { kind: "rights", target: "Video 12", details: "This uses my shop's logo without permission.", email: "owner@example.com" });
  assert.equal(r.status, 200);
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(r.data.id) as any;
  assert.equal(row.status, "open"); assert.equal(row.contact_email, "owner@example.com");
  r = await client()("POST", "/api/reports", { kind: "nonsense", details: "short" });
  assert.equal(r.status, 422); assert.ok(r.data.fields.kind && r.data.fields.details);
});

test("rate limits: repeated signups and reports from one address are slowed down", async () => {
  let last = 0;
  for (let i = 0; i < 12; i++) last = (await client()("POST", "/api/signup", body())).status;
  assert.equal(last, 429);
  resetLimits();
  for (let i = 0; i < 11; i++) last = (await client()("POST", "/api/reports", { kind: "other", details: "Something is wrong here." })).status;
  assert.equal(last, 429);
});

test("security headers and cookie flags", async () => {
  const r = await fetch(base + "/");
  assert.match(r.headers.get("content-security-policy") ?? "", /object-src 'none'/);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.match(r.headers.get("permissions-policy") ?? "", /camera=\(\)/);
  const b = body();
  await client()("POST", "/api/signup", b);
  db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE email = ?").run(b.email);
  const s = await client()("POST", "/api/login", { email: b.email, password: "password123" });
  const cookie = s.headers.get("set-cookie") ?? "";
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
});

test("logs: keys, emails and signed URLs are redacted", () => {
  const out = redact("Authorization: Key abcdef123456:secret9876 user a.b@example.com url https://v3.fal.media/files/x.mp4?token=abc&sig=1 sk_live_abc123");
  assert.doesNotMatch(out, /abcdef123456|a\.b@example\.com|token=abc|sk_live_abc123/);
});

// ---------------------------------------------------------------------------------------------
// Credits ledger and refunds

test("video ids are never reused after a deletion, so ledger entries can't collide", async () => {
  const { c } = await eligibleUser(3);
  const photo = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  const first = (await c("POST", "/api/jobs", order(photo.id))).data.job;
  await idle();
  assert.equal((await c("DELETE", `/api/jobs/${first.id}`)).status, 200);
  const photo2 = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  const second = (await c("POST", "/api/jobs", order(photo2.id))).data.job;
  assert.ok(second.id > first.id, `${second.id} > ${first.id}`);
  await idle();
});

test("ledger: reserved while a video runs, used when it finishes, returned when it fails, never twice", async () => {
  const { c, email: e } = await eligibleUser(3);
  const id = (db.prepare("SELECT id FROM users WHERE email = ?").get(e) as any).id;
  const photo = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  const job = (await c("POST", "/api/jobs", order(photo.id))).data.job;
  let s = creditSummary(id);
  assert.equal(s.available + s.reserved, 3);
  await idle();
  s = creditSummary(id);
  assert.deepEqual([s.available, s.reserved, s.used], [2, 0, 1]);
  const consumed = db.prepare("SELECT COUNT(*) AS n FROM credit_events WHERE reason = 'consume' AND ref = ?").get(String(job.id)) as any;
  assert.equal(consumed.n, 1);
  assert.throws(() => db.prepare("INSERT INTO credit_events (user_id, delta, reason, ref) VALUES (?, 1, 'refund', ?)").run(id, String(job.id) + "x") && db.prepare("INSERT INTO credit_events (user_id, delta, reason, ref) VALUES (?, 1, 'refund', ?)").run(id, String(job.id) + "x"),
    "the same ledger entry can't be written twice");
  const acc = (await c("GET", "/api/account")).data;
  assert.equal(acc.credits.used, 1);
});

test("refunds: request route, unused credits removed so they can't be spent, idempotent, other accounts refused", async () => {
  const { c, email: e } = await eligibleUser();
  const id = (db.prepare("SELECT id FROM users WHERE email = ?").get(e) as any).id;
  const buy = await c("POST", "/api/purchases", { packId: "launch" }); // test payments grant at once
  const pid = buy.data.purchaseId;
  assert.equal(creditSummary(id).available, 15);
  const stranger = await eligibleUser();
  assert.equal((await stranger.c("POST", "/api/account/refund-requests", { purchaseId: pid })).status, 404);
  const r1 = await c("POST", "/api/account/refund-requests", { purchaseId: pid, details: "Changed my mind" });
  const r2 = await c("POST", "/api/account/refund-requests", { purchaseId: pid });
  assert.equal(r1.data.id, r2.data.id, "one open request per purchase");
  assert.deepEqual(refundPurchase(pid, { note: "test" }), { removed: 15 });
  assert.deepEqual(refundPurchase(pid, { note: "again" }), { removed: 0 }, "a second refund changes nothing");
  assert.equal(creditSummary(id).available, 0);
  assert.equal(creditSummary(id).refundedPurchases, 15);
  const photo = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  assert.equal((await c("POST", "/api/jobs", order(photo.id))).data.error, "no_credits", "refunded credits can't be spent");
  assert.equal((db.prepare("SELECT status FROM refund_requests WHERE id = ?").get(r1.data.id) as any).status, "approved");
  assert.equal((await c("POST", "/api/account/refund-requests", { purchaseId: pid })).data.error, "not_refundable");
});

test("refunds: credits already spent or reserved can't be clawed back past zero", async () => {
  const { c, email: e } = await eligibleUser();
  const id = (db.prepare("SELECT id FROM users WHERE email = ?").get(e) as any).id;
  const pid = (await c("POST", "/api/purchases", { packId: "launch" })).data.purchaseId;
  const photo = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  await c("POST", "/api/jobs", order(photo.id));
  await idle();
  assert.throws(() => refundPurchase(pid, { note: "full" }), /credits_in_use/);
  assert.deepEqual(refundPurchase(pid, { note: "unused only", credits: 14 }), { removed: 14 });
  assert.equal(creditSummary(id).available, 0);
});

test("production gates are scoped: generation waits for the video-model transfer, payments for the billing terms", async () => {
  const { c } = await eligibleUser(3);
  const photo = (await c("POST", "/api/photos", undefined, { raw: PHOTO })).data;
  process.env.LEGAL_ENFORCE = "1";
  try {
    assert.equal((await c("GET", "/api/site")).data.generationOn, false);
    assert.equal((await c("POST", "/api/jobs", order(photo.id))).data.error, "generation_not_configured");
    compliance.transfers.fal.mechanism = "SDAIA SCCs"; compliance.transfers.fal.riskAssessment = "ra.pdf";
    compliance.transfers.railway.mechanism = "SDAIA SCCs"; compliance.transfers.railway.riskAssessment = "ra.pdf";
    assert.equal((await c("POST", "/api/jobs", order(photo.id))).status, 200, "generation opens once its own transfers are covered");
    process.env.PAYMENTS = "moyasar";
    const r = await c("POST", "/api/purchases", { packId: "launch" });
    assert.equal(r.data.error, "payments_not_configured", "no payments while VAT, expiry and refund terms are undecided");
  } finally {
    delete process.env.LEGAL_ENFORCE; process.env.PAYMENTS = "test";
    for (const t of Object.values(compliance.transfers)) { t.mechanism = null; t.riskAssessment = null; }
    await idle();
  }
});

test("production as configured: Terms and Privacy are live without placeholders and accounts open, independent of payments, generation and transfer records", async () => {
  process.env.LEGAL_ENFORCE = "1";
  try {
    for (const slug of ["terms", "privacy", "contact"]) {
      const html = await (await fetch(`${base}/legal/${slug}`)).text();
      assert.doesNotMatch(html, /being prepared|mark class="todo"|\[[A-Z ,]{6,}\]|Draft for review/, slug);
    }
    const r = await client()("POST", "/api/signup", body());
    assert.equal(r.status, 200);
    const site = (await client()("GET", "/api/site")).data;
    assert.equal(site.signupsOpen, true, "mail outbox counts as working email in tests");
    assert.equal(site.generationOn, false, "generation keeps its own gate");
  } finally { delete process.env.LEGAL_ENFORCE; }
});
