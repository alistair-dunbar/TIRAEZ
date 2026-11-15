// End-to-end tests against the real HTTP server with the free mock engine and test payments.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

process.env.DB_PATH = ":memory:";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "svc-"));
process.env.PAYMENTS = "test";
process.env.ENGINE = "mock";
process.env.MOCK_DELAY_MS = "5";
process.env.MOCK_VIDEO = "ads/coffee-machine-phone.mp4";

const { server } = await import("../server.ts");
const { idle, recoverInterrupted } = await import("../videos.ts");
const { db } = await import("../db.ts");

let base = "";
before(() => new Promise<void>((r) => server.listen(0, () => { base = `http://localhost:${(server.address() as any).port}`; r(); })));
after(() => new Promise<void>((r) => { server.close(() => r()); }));

/** A tiny browser: keeps the session cookie between calls. */
function client() {
  let cookie = "";
  return async (method: string, path: string, body?: unknown, opts: { raw?: Buffer; noHeader?: boolean } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(opts.noHeader ? {} : { "X-Requested-With": "app" }), ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}) },
      body: opts.raw ? new Uint8Array(opts.raw) : body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const type = res.headers.get("content-type") ?? "";
    return { status: res.status, type, data: type.includes("json") ? await res.json() : await res.arrayBuffer() };
  };
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
let n = 0;
async function newUser() {
  const c = client();
  const email = `user${++n}@example.com`;
  assert.equal((await c("POST", "/api/signup", { email, password: "password123" })).status, 200);
  return { c, email };
}

test("signup, session, duplicate email, wrong password", async () => {
  const { c, email } = await newUser();
  assert.deepEqual((await c("GET", "/api/me")).data, { email, credits: 0 });
  assert.equal((await client()("POST", "/api/signup", { email, password: "password123" })).status, 409);
  assert.equal((await client()("POST", "/api/login", { email, password: "wrong-password" })).status, 401);
  assert.equal((await client()("POST", "/api/signup", { email: "nope", password: "password123" })).data.error, "invalid_email");
  assert.equal((await client()("POST", "/api/signup", { email: "a@example.com", password: "short" })).data.error, "weak_password");
  await c("POST", "/api/logout");
  assert.equal((await c("GET", "/api/me")).data, null);
});

test("state-changing requests without the app header are refused", async () => {
  const r = await client()("POST", "/api/signup", { email: "x@example.com", password: "password123" }, { noHeader: true });
  assert.equal(r.status, 403);
});

test("orders need a login and a credit", async () => {
  assert.equal((await client()("POST", "/api/videos", { templateId: "coffee-bright" })).status, 401);
  const { c } = await newUser();
  const r = await c("POST", "/api/videos", { templateId: "coffee-bright" });
  assert.equal(r.status, 402);
  assert.equal(r.data.error, "no_credits");
  assert.equal((await c("GET", "/api/videos")).data.videos.length, 0, "a refused order leaves no video behind");
});

test("buy a pack, order a video, download it; other users can't", async () => {
  const { c } = await newUser();
  const bought = await c("POST", "/api/purchases", { packId: "launch" });
  assert.equal(bought.data.credits, 15);

  const order = await c("POST", "/api/videos", { templateId: "coffee-warm" });
  assert.equal(order.data.credits, 14);
  await idle();
  const list = (await c("GET", "/api/videos")).data;
  assert.equal(list.videos[0].status, "done");
  assert.equal(list.credits, 14);

  const file = await c("GET", `/api/videos/${order.data.id}/file`);
  assert.equal(file.status, 200);
  assert.equal(file.type, "video/mp4");
  assert.ok((file.data as ArrayBuffer).byteLength > 100_000);

  const { c: other } = await newUser();
  assert.equal((await other("GET", `/api/videos/${order.data.id}/file`)).status, 404);
  assert.equal((await client()("GET", `/api/videos/${order.data.id}/file`)).status, 401);
});

test("a failed video refunds the credit, once", async () => {
  const { c } = await newUser();
  await c("POST", "/api/purchases", { packId: "launch" });
  process.env.MOCK_FAIL = "1";
  const order = await c("POST", "/api/videos", { templateId: "coffee-bright" });
  await idle();
  delete process.env.MOCK_FAIL;
  const list = (await c("GET", "/api/videos")).data;
  assert.equal(list.videos[0].status, "failed");
  assert.equal(list.credits, 15);
  const refunds = db.prepare("SELECT COUNT(*) AS n FROM credit_events WHERE reason = 'refund' AND ref = ?").get(String(order.data.id)) as any;
  assert.equal(refunds.n, 1);
});

test("uploads: real images only, and only your own can be used", async () => {
  const { c } = await newUser();
  await c("POST", "/api/purchases", { packId: "launch" });
  assert.equal((await c("PUT", "/api/uploads", undefined, { raw: Buffer.from("<html>not an image</html>") })).status, 415);
  const up = await c("PUT", "/api/uploads", undefined, { raw: PNG });
  assert.equal(up.status, 200);
  assert.equal((await c("POST", "/api/videos", { templateId: "coffee-bright", uploadId: up.data.uploadId })).status, 200);
  await idle();

  const { c: other } = await newUser();
  await other("POST", "/api/purchases", { packId: "launch" });
  assert.equal((await other("POST", "/api/videos", { templateId: "coffee-bright", uploadId: up.data.uploadId })).status, 404);
});

test("unknown template and unknown pack are rejected without charging", async () => {
  const { c } = await newUser();
  assert.equal((await c("POST", "/api/purchases", { packId: "nope" })).status, 404);
  await c("POST", "/api/purchases", { packId: "launch" });
  assert.equal((await c("POST", "/api/videos", { templateId: "nope" })).status, 404);
  assert.equal((await c("GET", "/api/videos")).data.credits, 15);
});

test("orders interrupted by a restart are failed and refunded", async () => {
  const { c, email } = await newUser();
  await c("POST", "/api/purchases", { packId: "launch" });
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
  // Simulate an order that was paid for and still running when the server stopped.
  db.prepare("UPDATE users SET credits = credits - 1 WHERE id = ?").run(user.id);
  db.prepare("INSERT INTO videos (user_id, template_id, status) VALUES (?, 'coffee-bright', 'processing')").run(user.id);
  assert.equal(recoverInterrupted(), 1);
  const list = (await c("GET", "/api/videos")).data;
  assert.equal(list.videos[0].status, "failed");
  assert.equal(list.credits, 15);
});

test("static files are served, and paths can't escape the public folder", async () => {
  const home = await fetch(base + "/");
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Reel-in-60/);
  assert.equal((await fetch(base + "/previews/coffee-bright.jpg")).headers.get("content-type"), "image/jpeg");
  assert.equal((await fetch(base + "/..%2f..%2fpackage.json")).status, 404);
  assert.equal((await fetch(base + "/%2e%2e/server.ts")).status, 404);
});
