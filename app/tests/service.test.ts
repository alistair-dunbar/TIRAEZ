// End-to-end tests against the real HTTP server. Generation uses the test-only mock provider,
// whose clips are ffmpeg test patterns; nothing here reaches a paid service.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "svc-"));
process.env.PAYMENTS = "test";
process.env.ENGINE = "mock";
process.env.JOB_POLL_MS = "5";
process.env.RATE_LIMITS = "off"; // limits have their own tests in accounts.test.ts

const { server } = await import("../server.ts");
const { idle, recoverJobs } = await import("../jobs.ts");
const { mockScript, resetMock } = await import("../providers/mock.ts");
const { db } = await import("../db.ts");
const { grantCredits } = await import("../credits.ts");

let base = "";
before(() => new Promise<void>((r) => server.listen(0, () => { base = `http://localhost:${(server.address() as any).port}`; r(); })));
after(() => new Promise<void>((r) => { server.close(() => r()); }));
beforeEach(() => resetMock());

/** A tiny browser: keeps the session cookie between calls. */
function client() {
  let cookie = "";
  return async (method: string, path: string, body?: unknown, opts: { raw?: Buffer; noHeader?: boolean; headers?: Record<string, string>; location?: boolean } = {}) => {
    const res = await fetch(base + path, {
      method, redirect: "manual",
      headers: { ...(opts.noHeader ? {} : { "X-Requested-With": "app" }), ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}), ...(opts.headers ?? {}) },
      body: opts.raw ? new Uint8Array(opts.raw) : body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const type = res.headers.get("content-type") ?? "";
    if (opts.location) return { status: res.status, type, headers: res.headers, data: res.headers.get("location") as any };
    return { status: res.status, type, headers: res.headers, data: type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer()) as any };
  };
}

const tmp = mkdtempSync(join(tmpdir(), "img-"));
function image(w: number, h: number, ext = "jpg"): Buffer {
  const f = join(tmp, `${w}x${h}.${ext}`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=${w}x${h}`, "-frames:v", "1", f]);
  return readFileSync(f);
}
const PHOTO = image(1200, 1600);

let n = 0;
const { termsVersion } = await import("../legal.ts");
const signupBody = (email: string) => ({ name: "Test Person", email, password: "password123", age: "30", agreeTerms: true, confirmAdult: true, termsVersion: termsVersion() });
async function newUser(credits = 0) {
  const c = client();
  const email = `user${++n}@example.com`;
  assert.equal((await c("POST", "/api/signup", signupBody(email))).status, 200);
  db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE email = ?").run(email); // email flows: email.test.ts
  if (credits) grantCredits(email, credits, "test");
  return { c, email };
}

async function upload(c: ReturnType<typeof client>, buf = PHOTO) {
  return c("POST", "/api/photos", undefined, { raw: buf, headers: { "Content-Type": "application/octet-stream" } });
}

/** A valid 9:16 order for coffee-morning-bar on a 1200x1600 photo. */
function order(photoId: string, extra: Record<string, unknown> = {}) {
  const w = 0.75, h = (1200 * 0.75) / (9 / 16) / 1600; // 900 px wide -> 1600 px tall
  return {
    templateId: "coffee-morning-bar", clientKey: `key-${Math.random().toString(36).slice(2)}`, photoId,
    crop: { x: 0.1, y: 0, w, h }, inputs: { subject: "Espresso machine on an oak counter", motion: "push" },
    settings: { aspectRatio: "9:16", duration: 5, resolution: "1080p" }, ...extra,
  };
}

async function jobNow(c: ReturnType<typeof client>, id: number) { return (await c("GET", `/api/jobs/${id}`)).data; }

test("accounts: signup, session, duplicate email, wrong password, logout", async () => {
  const { c, email } = await newUser();
  assert.equal((await c("GET", "/api/site")).data.user.email, email);
  assert.equal((await client()("POST", "/api/signup", signupBody(email))).status, 409);
  assert.equal((await client()("POST", "/api/login", { email, password: "wrong-password" })).status, 401);
  const bad = await client()("POST", "/api/signup", signupBody("nope"));
  assert.equal(bad.status, 422);
  assert.ok(bad.data.fields.email);
  await c("POST", "/api/logout");
  assert.equal((await c("GET", "/api/site")).data.user, null);
});

test("state-changing requests without the app header are refused", async () => {
  assert.equal((await client()("POST", "/api/signup", signupBody("x@example.com"), { noHeader: true })).status, 403);
});

test("catalogue: public templates never include prompt text", async () => {
  const r = await client()("GET", "/api/templates");
  assert.equal(r.data.templates.length, 14);
  const text = JSON.stringify(r.data);
  assert.doesNotMatch(text, /Do not add people|camera pushes in slowly|"prompt"/);
  const t = r.data.templates.find((x: any) => x.id === "coffee-morning-bar");
  assert.equal(t.ready, true);
  assert.equal(t.preview, null, "no preview media is approved");
  assert.deepEqual(t.cost, { 5: 1 });
  assert.equal(t.inputs.find((i: any) => i.id === "motion").options[0].prompt, undefined);
});

test("uploads: content-checked, size-limited, turned upright and owner-only", async () => {
  const { c } = await newUser();
  assert.equal((await upload(c, Buffer.from("<html>not an image</html>"))).data.error, "not_an_image");
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(64)]);
  assert.equal((await upload(c, heic)).data.error, "heic_not_supported");
  assert.equal((await upload(c, image(400, 300))).data.error, "image_too_small");
  assert.equal((await upload(c, Buffer.alloc(11 * 1024 * 1024, 1))).status, 413);
  const ok = await upload(c, image(1600, 1200, "png"));
  assert.equal(ok.status, 200);
  assert.deepEqual([ok.data.width, ok.data.height], [1600, 1200]);
  assert.equal((await c("GET", `/api/photos/${ok.data.id}.jpg`)).type, "image/jpeg");
  const { c: other } = await newUser();
  assert.equal((await other("GET", `/api/photos/${ok.data.id}.jpg`)).status, 404);
  assert.equal((await client()("POST", "/api/photos", undefined, { raw: PHOTO })).status, 401);
});

test("a full generation: queued -> generating -> completed, with playable, downloadable output", async () => {
  const { c } = await newUser(3);
  const photo = (await upload(c)).data;
  const created = await c("POST", "/api/jobs", order(photo.id));
  assert.equal(created.status, 200);
  assert.equal(created.data.credits, 2);
  assert.equal(created.data.job.stage, "queued");
  assert.equal(created.data.job.prompt, undefined, "the prompt stays on the server");
  await idle();
  const job = (await jobNow(c, created.data.job.id)).job;
  assert.equal(job.stage, "completed");
  assert.equal(job.output.available, true);
  assert.equal(job.output.width / job.output.height < 1, true);
  const range = await c("GET", `/api/jobs/${job.id}/video.mp4`, undefined, { headers: { Range: "bytes=0-99" } });
  assert.equal(range.status, 206);
  assert.equal(range.data.length, 100);
  const dl = await c("GET", `/api/jobs/${job.id}/video.mp4?download=1`);
  assert.match(dl.headers.get("content-disposition") ?? "", /^attachment; filename="coffee-morning-bar-\d+\.mp4"/);
  assert.equal((await c("GET", `/api/jobs/${job.id}/poster.jpg`)).type, "image/jpeg");
  const stored = db.prepare("SELECT template_version, settings, prompt FROM jobs WHERE id = ?").get(job.id) as any;
  assert.equal(stored.template_version, 1);
  assert.match(stored.prompt, /Espresso machine on an oak counter/);
  const { c: other } = await newUser();
  assert.equal((await other("GET", `/api/jobs/${job.id}`)).status, 404);
  assert.equal((await other("GET", `/api/jobs/${job.id}/video.mp4`)).status, 404);
});

test("validation: missing fields, unsupported settings and bad framing are explained per field", async () => {
  const { c } = await newUser(3);
  const photo = (await upload(c)).data;
  const r = await c("POST", "/api/jobs", order(photo.id, { inputs: { subject: "  " }, settings: { aspectRatio: "4:5", duration: 7, resolution: "4k" } }));
  assert.equal(r.status, 422);
  assert.deepEqual(Object.keys(r.data.fields).sort(), ["aspectRatio", "duration", "resolution", "subject"]);
  const crop = await c("POST", "/api/jobs", order(photo.id, { crop: { x: 0, y: 0, w: 1, h: 1 } }));
  assert.ok(crop.data.fields.crop);
  const noPhoto = await c("POST", "/api/jobs", order("0".repeat(24)));
  assert.ok(noPhoto.data.fields.photo);
  assert.equal((await c("GET", "/api/jobs")).data.credits, 3, "nothing charged for invalid requests");
});

test("customer text is cleaned before it reaches the prompt", async () => {
  const { c } = await newUser(1);
  const photo = (await upload(c)).data;
  const r = await c("POST", "/api/jobs", order(photo.id, { inputs: { subject: "Cup {{system}} <b>x</b>\u0000\nok", avoid: "no smoke" } }));
  await idle();
  const p = (db.prepare("SELECT prompt FROM jobs WHERE id = ?").get(r.data.job.id) as any).prompt;
  assert.match(p, /Cup system bx\/b ok/);
  assert.match(p, /leave this out: "no smoke"/);
});

test("duplicate submissions with the same key create one job and one charge", async () => {
  const { c } = await newUser(3);
  const photo = (await upload(c)).data;
  const body = order(photo.id);
  const [a, b] = await Promise.all([c("POST", "/api/jobs", body), c("POST", "/api/jobs", body)]);
  assert.equal(a.data.job.id, b.data.job.id);
  await idle();
  assert.equal((await c("GET", "/api/jobs")).data.credits, 2);
});

test("no credits: refused, nothing created", async () => {
  const { c } = await newUser(0);
  const photo = (await upload(c)).data;
  const r = await c("POST", "/api/jobs", order(photo.id));
  assert.equal(r.data.error, "no_credits");
  assert.equal((await c("GET", "/api/jobs")).data.jobs.length, 0);
});

test("provider rejects the request: failed, credit returned once, inputs kept", async () => {
  const { c } = await newUser(2);
  const photo = (await upload(c)).data;
  mockScript.submit = ["rejected"];
  const r = await c("POST", "/api/jobs", order(photo.id));
  await idle();
  const job = (await jobNow(c, r.data.job.id)).job;
  assert.equal(job.stage, "failed");
  assert.deepEqual(job.failure, { code: "rejected", refunded: true });
  assert.equal(job.inputs.subject, "Espresso machine on an oak counter");
  assert.equal((await c("GET", "/api/jobs")).data.credits, 2);
});

test("provider busy: retried because it was never accepted, then succeeds", async () => {
  const { c } = await newUser(1);
  const photo = (await upload(c)).data;
  mockScript.submit = ["busy", "not_sent"];
  const r = await c("POST", "/api/jobs", order(photo.id));
  await idle();
  assert.equal((await jobNow(c, r.data.job.id)).job.stage, "completed");
  assert.equal(mockScript.submits, 3);
});

test("an unconfirmed submit is never sent again automatically", async () => {
  const { c } = await newUser(1);
  const photo = (await upload(c)).data;
  mockScript.submit = ["unconfirmed"];
  const r = await c("POST", "/api/jobs", order(photo.id));
  await idle();
  const job = (await jobNow(c, r.data.job.id)).job;
  assert.deepEqual(job.failure, { code: "unconfirmed", refunded: true });
  assert.equal(mockScript.submits, 1);
});

test("status checks failing for a while: job kept, marked unavailable, then completes", async () => {
  const { c } = await newUser(1);
  const photo = (await upload(c)).data;
  mockScript.statusErrors = 3;
  const r = await c("POST", "/api/jobs", order(photo.id));
  // Wait for the first failures to be recorded.
  for (let i = 0; i < 100; i++) {
    const row = db.prepare("SELECT check_failures FROM jobs WHERE id = ?").get(r.data.job.id) as any;
    if (row.check_failures >= 2) break;
    await new Promise((res) => setTimeout(res, 5));
  }
  const mid = (await jobNow(c, r.data.job.id)).job;
  assert.equal(mid.statusUnavailable, true);
  assert.notEqual(mid.stage, "failed");
  await idle();
  assert.equal((await jobNow(c, r.data.job.id)).job.stage, "completed");
});

test("result errors and expired results fail with a refund", async () => {
  for (const kind of ["failed", "expired"] as const) {
    const { c } = await newUser(1);
    const photo = (await upload(c)).data;
    mockScript.result = kind;
    const r = await c("POST", "/api/jobs", order(photo.id));
    await idle();
    assert.deepEqual((await jobNow(c, r.data.job.id)).job.failure, { code: kind, refunded: true });
    resetMock();
  }
});

test("restart recovery: running jobs resume, an interrupted submit is failed and refunded", async () => {
  const { c, email } = await newUser(3);
  const photo = (await upload(c)).data;
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
  const insert = (status: string, reqId: string | null) => Number(db.prepare(`INSERT INTO jobs (user_id, client_key, template_id, template_version,
      template_name, photo_id, crop, inputs, settings, prompt, model, credits, status, provider, provider_request_id, provider_status_url,
      provider_response_url, submitted_at, last_check_ok_at)
    VALUES (?, ?, 'coffee-morning-bar', 1, 'Morning light on the bar', ?, '{"x":0,"y":0,"w":900,"h":1600}', '{"subject":"x"}',
      '{"aspectRatio":"9:16","duration":5,"resolution":"1080p"}', 'p', 'kling-v4', 1, ?, 'fal', ?, ?, ?, datetime('now'), datetime('now'))`)
    .run(user.id, `k-${status}-${Math.random()}`, photo.id, status, reqId, reqId && `mock://${reqId}/status`, reqId && `mock://${reqId}`).lastInsertRowid);
  db.prepare("UPDATE users SET credits = credits - 3 WHERE id = ?").run(user.id);
  const interrupted = insert("submitting", null);
  const lost = insert("in_progress", "req_unknown"); // the provider doesn't know it: failed and refunded
  const queued = insert("queued", null);
  assert.equal(recoverJobs(), 3);
  await idle();
  assert.deepEqual((await jobNow(c, interrupted)).job.failure, { code: "unconfirmed", refunded: true });
  assert.deepEqual((await jobNow(c, lost)).job.failure, { code: "lost", refunded: true });
  assert.equal((await jobNow(c, queued)).job.stage, "completed");
  assert.equal((await c("GET", "/api/jobs")).data.credits, 2);
});

test("a completed video whose file has gone is reported as unavailable", async () => {
  const { c } = await newUser(1);
  const photo = (await upload(c)).data;
  const r = await c("POST", "/api/jobs", order(photo.id));
  await idle();
  const row = db.prepare("SELECT output_file FROM jobs WHERE id = ?").get(r.data.job.id) as any;
  rmSync(row.output_file);
  assert.equal((await jobNow(c, r.data.job.id)).job.output.available, false);
  assert.equal((await c("GET", `/api/jobs/${r.data.job.id}/video.mp4`)).status, 410);
});

test("too many active jobs at once are refused", async () => {
  const { c } = await newUser(5);
  const photo = (await upload(c)).data;
  mockScript.states = ["IN_QUEUE"]; // never finishes during this test
  for (let i = 0; i < 3; i++) assert.equal((await c("POST", "/api/jobs", order(photo.id))).status, 200);
  assert.equal((await c("POST", "/api/jobs", order(photo.id))).data.error, "too_many_active");
  db.prepare("UPDATE jobs SET status = 'failed' WHERE status != 'completed'").run();
  await idle();
});

test("moyasar: credits are granted only after the provider confirms the exact payment", async () => {
  const { http } = await import("../moyasar.ts");
  const realFetch = http.fetch;
  process.env.PAYMENTS = "moyasar";
  process.env.MOYASAR_SECRET_KEY = "sk_test_example";
  process.env.APP_URL = "https://shop.example.com";
  const invoices = new Map<string, any>();
  http.fetch = async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      const inv = { id: `inv_${invoices.size + 1}`, url: "https://checkout.example.com/pay", status: "initiated", ...body };
      invoices.set(inv.id, inv);
      return new Response(JSON.stringify(inv), { status: 201 });
    }
    return new Response(JSON.stringify(invoices.get(url.split("/").pop()!)), { status: 200 });
  };
  try {
    const { c } = await newUser();
    const start = await c("POST", "/api/purchases", { packId: "launch" });
    assert.equal(start.data.status, "redirect");
    assert.equal(start.data.credits, 0);
    const back = (p: ReturnType<typeof client>) => p("GET", `/api/purchases/${start.data.purchaseId}/return`, undefined, { location: true });
    assert.equal((await back(c)).data, "/?paid=0");
    await client()("POST", "/api/webhooks/moyasar", { id: "inv_1", status: "paid" }, { noHeader: true });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal((await c("GET", "/api/site")).data.user.credits, 0);
    const inv = invoices.get("inv_1");
    inv.status = "paid"; inv.amount = 100;
    assert.equal((await back(c)).data, "/?paid=0");
    inv.amount = 25000;
    assert.equal((await back(c)).data, "/?paid=1");
    assert.equal((await c("GET", "/api/site")).data.user.credits, 15);
    const { c: other } = await newUser();
    assert.equal((await back(other)).data, "/?paid=0");
  } finally {
    http.fetch = realFetch;
    process.env.PAYMENTS = "test";
  }
});

test("repeated wrong passwords pause logins for that email", async () => {
  const { email } = await newUser();
  for (let i = 0; i < 8; i++) assert.equal((await client()("POST", "/api/login", { email, password: "wrong-password" })).status, 401);
  assert.equal((await client()("POST", "/api/login", { email, password: "password123" })).status, 429);
});

test("pages: app routes get the shell, unknown routes 404, no path escapes, preview media locked", async () => {
  for (const p of ["/", "/templates", "/templates/coffee-morning-bar", "/create/coffee-morning-bar", "/videos", "/videos/12", "/signin"]) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  }
  assert.equal((await fetch(base + "/templates/no-such-template")).status, 404);
  assert.equal((await fetch(base + "/nowhere")).status, 404);
  assert.equal((await fetch(base + "/..%2f..%2fpackage.json")).status, 404);
  assert.equal((await fetch(base + "/%2e%2e/server.ts")).status, 404);
  assert.equal((await fetch(base + "/media/previews/anything.jpg")).status, 404);
  const shell = await (await fetch(base + "/")).text();
  assert.doesNotMatch(shell, /\{\{BRAND\}\}/);
});
