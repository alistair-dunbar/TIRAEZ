// Retention rules (app/retention.ts) with synthetic data and controlled timestamps: boundaries, active-job
// protection, shared photos, expiry notices without duplicates, storage failures and retries, dry-run,
// the existing-data migration, and that credits and payment records are never touched.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ret-"));
process.env.PAYMENTS = "test";
process.env.ENGINE = "mock";
process.env.JOB_POLL_MS = "5";
process.env.MAIL = "outbox";
process.env.RATE_LIMITS = "off";

const { server } = await import("../server.ts");
const { db } = await import("../db.ts");
const { idle } = await import("../jobs.ts");
const { grantCredits, creditSummary } = await import("../credits.ts");
const { termsVersion, retention } = await import("../legal.ts");
const { runRetention, inventory, migrateExpiryDates } = await import("../retention.ts");
const { outbox } = await import("../mail.ts");

let base = "";
before(() => new Promise<void>((r) => server.listen(0, () => { base = `http://localhost:${(server.address() as any).port}`; r(); })));
after(() => new Promise<void>((r) => { server.close(() => r()); }));
beforeEach(() => { delete process.env.RETENTION_MEDIA; });

function client() {
  let cookie = "";
  return async (method: string, path: string, body?: unknown, raw?: Buffer) => {
    const res = await fetch(base + path, {
      method, headers: { "X-Requested-With": "app", ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : raw ? { "Content-Type": "application/octet-stream" } : {}) },
      body: raw ? new Uint8Array(raw) : body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, data: await res.json().catch(() => ({})) as any };
  };
}
const PHOTO = (() => {
  const f = join(mkdtempSync(join(tmpdir(), "img-")), "p.jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1200x1600", "-frames:v", "1", f]);
  return readFileSync(f);
})();
const order = (photoId: string) => {
  const w = 0.75, h = (1200 * 0.75) / (9 / 16) / 1600;
  return { templateId: "coffee-morning-bar", clientKey: `k-${Math.random().toString(36).slice(2)}`, photoId,
    crop: { x: 0.1, y: 0, w, h }, inputs: { subject: "Espresso machine on an oak counter", motion: "push" },
    settings: { aspectRatio: "9:16", duration: 5, resolution: "1080p" } };
};
let n = 0;
async function user(credits = 5) {
  const c = client();
  const email = `ret${++n}@example.com`;
  await c("POST", "/api/signup", { name: "R", email, password: "password123", age: "30", agreeTerms: true, confirmAdult: true, termsVersion: termsVersion() });
  db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE email = ?").run(email);
  await c("POST", "/api/login", { email, password: "password123" });
  if (credits) grantCredits(email, credits, "test");
  const id = (db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any).id as number;
  return { c, email, id };
}
async function video(c: ReturnType<typeof client>, photoId?: string) {
  const pid = photoId ?? (await c("POST", "/api/photos", undefined, PHOTO)).data.id;
  const job = (await c("POST", "/api/jobs", order(pid))).data.job;
  await idle();
  return { jobId: job.id as number, photoId: pid as string };
}
const job = (id: number) => db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as any;
// "-6 days -23 hours" -> datetime('now', '-6 days', '-23 hours')
const ago = (spec: string) => `datetime('now', ${(spec.match(/[+-]?\d+ \w+/g) ?? []).map((m) => `'${m}'`).join(", ")})`;
const setJob = (id: number, sql: string) => db.prepare(`UPDATE jobs SET ${sql} WHERE id = ?`).run(id);

// ---------------------------------------------------------------------------------------------

test("expiry is set by the server at successful completion: completion + 90 days", async () => {
  const { c } = await user();
  const { jobId } = await video(c);
  const j = job(jobId);
  const diff = (Date.parse(j.expires_at.replace(" ", "T") + "Z") - Date.parse(j.finished_at.replace(" ", "T") + "Z")) / 86_400_000;
  assert.ok(Math.abs(diff - retention.videoDays) < 0.01, `expires ${diff} days after completion`);
  const pub = (await c("GET", `/api/jobs/${jobId}`)).data.job;
  assert.equal(pub.expiresAt, j.expires_at);
  assert.equal(pub.expired, false);
  // A client can't set or move it: nothing in the API accepts it.
  const forged = (await c("POST", "/api/jobs", { ...order((await c("POST", "/api/photos", undefined, PHOTO)).data.id), expires_at: "2099-01-01 00:00:00" })).data.job;
  await idle();
  assert.notEqual(job(forged.id).expires_at, "2099-01-01 00:00:00");
});

test("video boundary: kept one minute before expiry, deleted one minute after; record, credits and ledger untouched", async () => {
  const { c, id } = await user();
  const keep = await video(c), gone = await video(c);
  setJob(keep.jobId, `expires_at = ${ago("+1 minute")}`);
  setJob(gone.jobId, `expires_at = ${ago("-1 minute")}`);
  const files = [job(gone.jobId).output_file, job(gone.jobId).poster_file];
  const before = creditSummary(id);
  const events = (db.prepare("SELECT COUNT(*) AS n FROM credit_events WHERE user_id = ?").get(id) as any).n;
  const r = await runRetention({ media: "enforce" });
  assert.ok(r.videos >= 1);
  for (const f of files) assert.ok(!existsSync(f), "video and thumbnail deleted");
  assert.ok(existsSync(job(keep.jobId).output_file), "not yet due: kept");
  const g = job(gone.jobId);
  assert.ok(g.media_deleted_at); assert.equal(g.inputs, "{}"); assert.equal(g.prompt, "");
  assert.equal(g.credits, 1, "minimal record kept");
  assert.deepEqual(creditSummary(id), before, "balances unchanged");
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM credit_events WHERE user_id = ?").get(id) as any).n, events, "ledger unchanged");
  const pub = (await c("GET", `/api/jobs/${gone.jobId}`)).data.job;
  assert.equal(pub.expired, true);
  assert.equal((await c("GET", `/api/jobs/${gone.jobId}/video.mp4`)).status, 410);
  const again = await runRetention({ media: "enforce" });
  assert.equal(again.videos, 0, "idempotent");
});

test("dry-run reports and deletes nothing; each run is recorded with counts only", async () => {
  const { c } = await user();
  const v = await video(c);
  setJob(v.jobId, `expires_at = ${ago("-1 day")}`);
  const r = await runRetention({ media: "dry-run" });
  assert.equal(r.mode, "dry-run");
  assert.ok(r.videos >= 1, "reported as due");
  assert.ok(existsSync(job(v.jobId).output_file), "nothing deleted");
  const run = db.prepare("SELECT * FROM retention_runs ORDER BY id DESC LIMIT 1").get() as any;
  assert.equal(run.mode, "dry-run");
  assert.doesNotMatch(run.results, /@|Espresso/, "no personal content in the audit record");
  setJob(v.jobId, `expires_at = ${ago("+1 day")}`);
});

test("source photos: 7 days after the job's final state; shared photos wait for the last job; active jobs protect them", async () => {
  const { c } = await user(10);
  const a = await video(c);
  const b = await video(c, a.photoId);             // same uploaded photo used twice
  const photoFile = (db.prepare("SELECT file FROM photos WHERE id = ?").get(a.photoId) as any).file;
  setJob(a.jobId, `finished_at = ${ago("-8 days")}`);
  setJob(b.jobId, `finished_at = ${ago("-6 days 23 hours")}`);
  const srcA = job(a.jobId).source_file, srcB = job(b.jobId).source_file;
  await runRetention({ media: "enforce" });
  assert.ok(!existsSync(srcA), "job A's own source copy: due");
  assert.ok(existsSync(srcB), "job B's source copy: not yet");
  assert.ok(existsSync(photoFile), "shared photo kept while its last job ended less than 7 days ago");
  // A job still running keeps the photo, however old the others are.
  setJob(b.jobId, `finished_at = ${ago("-9 days")}`);
  setJob(a.jobId, "status = 'in_progress'");
  await runRetention({ media: "enforce" });
  assert.ok(existsSync(photoFile), "active job protects the photo");
  setJob(a.jobId, "status = 'completed'");
  await runRetention({ media: "enforce" });
  assert.ok(!existsSync(photoFile), "deleted once nothing needs it");
  assert.ok((db.prepare("SELECT deleted_at FROM photos WHERE id = ?").get(a.photoId) as any).deleted_at, "row kept, marked deleted");
  const pub = (await c("GET", `/api/jobs/${a.jobId}`)).data.job;
  assert.equal(pub.photo, null, "'Create another version' will ask for a new upload");
  assert.equal((await c("POST", "/api/jobs", order(a.photoId))).status, 422, "an expired photo can't be reused");
});

test("abandoned uploads: deleted 7 days after upload, not a minute before", async () => {
  const { c } = await user();
  const young = (await c("POST", "/api/photos", undefined, PHOTO)).data.id;
  const old = (await c("POST", "/api/photos", undefined, PHOTO)).data.id;
  db.prepare(`UPDATE photos SET created_at = ${ago("-6 days -23 hours")} WHERE id = ?`).run(young);
  db.prepare(`UPDATE photos SET created_at = ${ago("-7 days -1 minute")} WHERE id = ?`).run(old);
  await runRetention({ media: "dry-run" }); // this rule applies in both modes
  assert.ok(db.prepare("SELECT 1 FROM photos WHERE id = ?").get(young));
  assert.equal(db.prepare("SELECT 1 FROM photos WHERE id = ?").get(old), undefined);
});

test("unverified accounts: 30 days from creation; resending the link doesn't extend it", async () => {
  const c = client();
  const email = `unv${++n}@example.com`;
  await c("POST", "/api/signup", { name: "U", email, password: "password123", age: "30", agreeTerms: true, confirmAdult: true, termsVersion: termsVersion() });
  const id = (db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any).id;
  db.prepare(`UPDATE users SET created_at = ${ago("-29 days")} WHERE id = ?`).run(id);
  await c("POST", "/api/login", { email, password: "password123" });
  await c("POST", "/api/email/resend"); // a fresh link on day 29
  await runRetention();
  assert.ok(db.prepare("SELECT 1 FROM users WHERE id = ?").get(id), "kept on day 29");
  db.prepare(`UPDATE users SET created_at = ${ago("-30 days -1 minute")} WHERE id = ?`).run(id);
  await runRetention();
  assert.equal(db.prepare("SELECT 1 FROM users WHERE id = ?").get(id), undefined, "deleted after 30 days despite the recent resend");
});

test("stale jobs are failed with credits returned, then stop protecting their photo", async () => {
  const { c, id } = await user();
  const v = await video(c);
  setJob(v.jobId, `status = 'in_progress', finished_at = NULL, created_at = ${ago("-25 hours")}`);
  db.prepare("DELETE FROM credit_events WHERE reason IN ('consume', 'refund') AND ref = ?").run(String(v.jobId));
  const before = creditSummary(id).available;
  const r = await runRetention({ media: "dry-run" });
  assert.ok(r.stale >= 1);
  assert.equal(job(v.jobId).status, "failed");
  assert.equal(creditSummary(id).available, before + 1, "credit returned once");
});

test("storage failure: the item is left for the next run, reported, then deleted", async () => {
  const { c } = await user();
  const v = await video(c);
  const out = job(v.jobId).output_file;
  rmSync(out, { force: true });
  mkdirSync(out); writeFileSync(join(out, "x"), "x"); // a non-empty directory can't be removed without recursion
  setJob(v.jobId, `expires_at = ${ago("-1 minute")}`);
  const r1 = await runRetention({ media: "enforce" });
  assert.ok(r1.failures >= 1);
  assert.equal(job(v.jobId).media_deleted_at, null, "not marked deleted while the file remains");
  rmSync(out, { recursive: true, force: true });
  const r2 = await runRetention({ media: "enforce" });
  assert.ok(r2.videos >= 1);
  assert.ok(job(v.jobId).media_deleted_at);
});

test("runs never overlap", async () => {
  const [a, b] = await Promise.all([runRetention({ media: "dry-run" }), runRetention({ media: "dry-run" })]);
  assert.ok([a, b].some((r) => Object.entries(r).every(([k, v]) => k === "mode" || v === 0)), "the second call does nothing while the first runs");
});

test("expiry email: one per customer 7 days before, never twice, retried after a provider failure", async () => {
  const { c, email } = await user();
  const v1 = await video(c), v2 = await video(c);
  setJob(v1.jobId, `expires_at = ${ago("+5 days")}`);
  setJob(v2.jobId, `expires_at = ${ago("+6 days")}`);
  const pub = (await c("GET", `/api/jobs/${v1.jobId}`)).data.job;
  assert.equal(pub.expiringSoon, true, "in-app notice flag");
  // Dry-run: no email (it would announce a deletion that isn't happening).
  await runRetention({ media: "dry-run" });
  assert.equal(outbox.filter((m) => m.to === email && /deleted soon/.test(m.subject)).length, 0);

  // Real provider path with a failing then working provider.
  const env = { MAIL: process.env.MAIL, RESEND_API_KEY: process.env.RESEND_API_KEY, MAIL_FROM: process.env.MAIL_FROM, APP_URL: process.env.APP_URL };
  Object.assign(process.env, { MAIL: "resend", RESEND_API_KEY: "re_test", MAIL_FROM: "Tiraez <support@tiraez.com>", APP_URL: "https://www.example.com" });
  const realFetch = globalThis.fetch;
  const calls: any[] = [];
  let fail = true;
  globalThis.fetch = (async (url: any, init: any) => {
    if (String(url).startsWith("https://api.resend.com")) {
      calls.push({ headers: init.headers, body: JSON.parse(init.body) });
      return new Response(fail ? "{\"message\":\"down\"}" : "{\"id\":\"x\"}", { status: fail ? 500 : 200 });
    }
    return realFetch(url, init);
  }) as typeof fetch;
  try {
    const r1 = await runRetention({ media: "enforce" });
    assert.equal(r1.noticesFailed, 2);
    assert.equal(job(v1.jobId).expiry_notice_status, null, "not marked sent after a failure");
    fail = false;
    const r2 = await runRetention({ media: "enforce" });
    assert.equal(r2.notices, 2);
    assert.equal(job(v1.jobId).expiry_notice_status, "sent");
    const mine = calls.filter((x) => x.body.to[0] === email);
    assert.equal(mine.length, 2, "one failed attempt, one successful send, both videos in one email");
    assert.equal(mine[0].headers["Idempotency-Key"], mine[1].headers["Idempotency-Key"], "same key, so a retry can't duplicate");
    assert.match(mine[1].body.text, /available to download until/);
    await runRetention({ media: "enforce" });
    assert.equal(calls.filter((x) => x.body.to[0] === email).length, 2, "no duplicate on later runs");
  } finally {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

test("user deletion before 90 days: immediate, files gone, credits untouched", async () => {
  const { c, id } = await user();
  const v = await video(c);
  const files = [job(v.jobId).output_file, job(v.jobId).poster_file];
  const bal = creditSummary(id).available;
  assert.equal((await c("DELETE", `/api/jobs/${v.jobId}`)).status, 200);
  assert.equal((await c("GET", `/api/jobs/${v.jobId}`)).status, 404, "access removed at once");
  for (const f of files) assert.ok(!existsSync(f));
  assert.equal(creditSummary(id).available, bal);
  assert.ok(db.prepare("SELECT 1 FROM credit_events WHERE reason = 'video' AND ref = ?").get(String(v.jobId)), "transaction reference kept");
});

test("account deletion cancels queued videos and keeps only purchase records", async () => {
  const { c, id } = await user();
  await c("POST", "/api/purchases", { packId: "launch" });
  const pid = (await c("POST", "/api/photos", undefined, PHOTO)).data.id;
  const done = (await c("POST", "/api/jobs", order(pid))).data.job;
  await idle();
  // A job still waiting to be sent to the model (fixture row; nothing is scheduled for it).
  db.prepare(`INSERT INTO jobs (id, user_id, client_key, template_id, template_version, template_name, photo_id, crop, inputs, settings,
      prompt, model, credits, status, provider)
    SELECT (SELECT MAX(id) + 1000 FROM jobs), user_id, 'queued-fixture', template_id, template_version, template_name, photo_id, crop, inputs,
      settings, prompt, model, credits, 'queued', provider FROM jobs WHERE id = ?`).run(done.id);
  const r = await c("POST", "/api/account/delete", { password: "password123", confirm: "delete" });
  await idle();
  assert.equal(r.status, 200);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE user_id = ?").get(id) as any).n, 0);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM purchases WHERE user_id = ?").get(id) as any).n, 1, "purchase record kept");
});

test("existing data: old videos get a grace date, not immediate deletion; dry-run inventory shows it", async () => {
  const { c } = await user();
  const v = await video(c);
  setJob(v.jobId, `expires_at = NULL, finished_at = ${ago("-200 days")}`);
  const inv = inventory();
  assert.ok(inv.migratedExpiryDates >= 1);
  const j = job(v.jobId);
  assert.equal(j.expiry_grace, 1);
  const days = (Date.parse(j.expires_at.replace(" ", "T") + "Z") - Date.now()) / 86_400_000;
  assert.ok(days > retention.migrationGraceDays - 0.01, `at least ${retention.migrationGraceDays} days to download (${days.toFixed(1)})`);
  await runRetention({ media: "enforce" });
  assert.ok(existsSync(j.output_file), "not deleted: still within the grace period");
  assert.equal(migrateExpiryDates(), 0, "migration is idempotent");
});
