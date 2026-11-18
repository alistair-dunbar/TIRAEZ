// The web service: accounts, credits, template catalogue, photo upload, generation jobs.
// Node's built-in http server; no framework, no npm dependencies.
//   npm start  -> http://localhost:3000   (see .env.example for settings)
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { accountSummary, deleteAccount, deleteVideo, exportData, restrictForAge } from "./account.ts";
import { startRetention } from "./retention.ts";
import {
  SESSION_MAX_AGE, UserError, ValidationError, changePassword, completeOnboarding, createSession, endOtherSessions, endSession,
  login, onboardingNeeds, requireEligible, signup, updateProfile, userById, userFromSession, type User,
} from "./auth.ts";
import { niches, publicTemplate, servablePreviewFiles, templateBySlug, templates } from "./catalog.ts";
import { generation, pricing, site } from "./config.ts";
import { balance, buy, confirmPurchase, packs, paymentProvider, purchaseByRef, purchaseOwner, requestRefund } from "./credits.ts";
import { cancelEmailChange, checkReset, confirmEmail, notifyExistingAccount, notifyPasswordChanged, requestEmailChange, requestReset, resetPassword, sendVerification } from "./emailflows.ts";
import { clientIp, limitBy, redact } from "./guard.ts";
import { mailName, mailReady } from "./mail.ts";
import { createJob, jobFor, listJobs, publicJob, recoverJobs } from "./jobs.ts";
import { accountsOpen, docPublished, generationAllowed, legalEnforced, legalPage, legalStatus, paymentTermsMissing, privacyVersion, retention, termsVersion } from "./legal.ts";
import { photoFor, savePhoto } from "./photos.ts";
import { REPORT_KINDS, createReport } from "./reports.ts";
import { engineName } from "./providers/index.ts";

const PUBLIC = join(import.meta.dirname, "public");
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".woff2": "font/woff2",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};
// Routes the single-page app renders; anything else gets the shell with a 404 status.
const APP_ROUTES = [/^\/$/, /^\/templates$/, /^\/templates\/[a-z0-9-]+$/, /^\/create\/[a-z0-9-]+$/, /^\/videos$/, /^\/videos\/\d+$/,
  /^\/signin$/, /^\/signup$/, /^\/welcome$/, /^\/account$/, /^\/report$/, /^\/verify-email$/, /^\/forgot-password$/, /^\/reset-password$/];
const CSP = "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; font-src 'self'; " +
  "connect-src 'self'; manifest-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"]);
    if (declared > limit) { req.resume(); reject(new UserError("too_large", 413)); return; }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) { reject(new UserError("too_large", 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function json(req: IncomingMessage): Promise<any> {
  try { return JSON.parse((await readBody(req, 100_000)).toString("utf8") || "{}"); }
  catch (e) { if (e instanceof UserError) throw e; throw new UserError("bad_json"); }
}

function cookie(req: IncomingMessage, name: string): string | undefined {
  return req.headers.cookie?.split(";").map((c) => c.trim().split("=")).find(([k]) => k === name)?.[1];
}

function sessionCookie(token: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

/** Serves a file, honouring Range requests (Safari and iOS need them to play video). */
function sendFile(req: IncomingMessage, res: ServerResponse, file: string, extra: Record<string, string> = {}): void {
  if (!existsSync(file) || !statSync(file).isFile()) { send(res, 404, { error: "not_found" }); return; }
  const size = statSync(file).size;
  const type = MIME[extname(file)] ?? "application/octet-stream";
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start); end = Math.min(end, size - 1);
    if (start > end || start >= size) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, { "Content-Type": type, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", ...extra });
    if (req.method === "HEAD") { res.end(); return; }
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes", ...extra });
  if (req.method === "HEAD") { res.end(); return; }
  createReadStream(file).pipe(res);
}

/** What the front end may know about the logged-in person. */
function userPayload(u: User) {
  return { name: u.name, email: u.email, credits: balance(u.id), needs: onboardingNeeds(u), emailVerified: u.emailVerified, pendingEmail: u.pendingEmail, ageRestricted: u.ageRestricted };
}

/** Public facts the front end needs: brand, pricing, which services are switched on. */
function siteInfo(user: User | null) {
  const pack = packs[0] ?? null;
  let paymentsOn = false;
  try { paymentProvider(); paymentsOn = true; } catch { paymentsOn = false; }
  return {
    brandName: site.brandName,
    contactEmail: site.contactEmail,
    pricing: site.showPricing && pack ? { currency: pricing.currency, creditsByDuration: pricing.creditsByDuration, pack } : null,
    paymentsOn,
    generationOn: engineName() !== "none" && generationAllowed(),
    // Accounts only open when there are published terms to agree to and email can confirm the address.
    signupsOpen: accountsOpen() && mailReady(),
    mailOn: mailReady(),
    legal: { termsVersion: termsVersion(), privacyVersion: privacyVersion(), draft: !legalStatus().published, live: legalStatus().live },
    upload: { maxBytes: generation.upload.maxBytes, minShortSide: generation.upload.minShortSide },
    ageRestrictedDays: retention.ageRestrictedDays,
    reportKinds: REPORT_KINDS,
    user: user ? userPayload(user) : null,
  };
}

const clearCookie = () => ({ "Set-Cookie": sessionCookie("", 0) });

async function api(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const method = req.method ?? "GET";

  // Payment provider's server-to-server notice. Its content is not trusted: it only tells us
  // which invoice to go and check with the provider ourselves.
  if (method === "POST" && path === "/api/webhooks/moyasar") {
    const body = await json(req);
    const purchaseId = typeof body?.id === "string" ? purchaseByRef(body.id) : undefined;
    send(res, 200, {});
    if (purchaseId) confirmPurchase(purchaseId).catch((e) => console.error(`webhook verify failed: ${redact(e?.message ?? e)}`));
    return;
  }

  // Browsers can't add this header on a cross-site form post, which blocks request forgery.
  if (method !== "GET" && method !== "HEAD" && req.headers["x-requested-with"] !== "app") throw new UserError("forbidden", 403);

  const ip = clientIp(req);
  const token = cookie(req, "sid");
  const user = userFromSession(token);
  const need = (): User => { if (!user) throw new UserError("login_required", 401); return user; };
  /** Logged in, 18 or over, current terms accepted, not suspended. */
  const eligible = (): User => { const u = need(); requireEligible(u); return u; };
  let m: RegExpExecArray | null;

  if (method === "POST" && path === "/api/signup") {
    limitBy("signup", ip);
    if (!mailReady()) throw new UserError("signups_closed", 503);
    // One reply for a new account and for an email that already has one. Nobody is logged in here:
    // a new account logs in after confirming its email; an existing owner gets an email instead.
    const r = signup(await json(req));
    if ("created" in r) { try { sendVerification(r.created); } catch (e) { console.error(`signup: verification not queued: ${redact((e as Error).message)}`); } }
    else notifyExistingAccount(r.existingId);
    send(res, 200, { ok: true });
  } else if (method === "POST" && path === "/api/email/verify") {
    limitBy("token", ip);
    const { token } = await json(req);
    const r = confirmEmail(token);
    const current = user && user.id === r.userId ? userPayload(userFromSession(cookie(req, "sid"))!) : null;
    send(res, 200, { email: r.email, changed: r.changed, user: current });
  } else if (method === "POST" && path === "/api/email/resend") {
    const u = need();
    sendVerification(u);
    send(res, 200, { sentTo: u.email });
  } else if (method === "POST" && path === "/api/password/forgot") {
    limitBy("forgot", ip);
    const { email } = await json(req);
    requestReset(email);
    send(res, 200, { ok: true });
  } else if (method === "GET" && path === "/api/password/reset") {
    limitBy("token", ip);
    send(res, 200, checkReset(new URL(req.url ?? "/", "http://x").searchParams.get("token")));
  } else if (method === "POST" && path === "/api/password/reset") {
    limitBy("token", ip);
    const { token, password, confirm } = await json(req);
    resetPassword(token, password, confirm);
    send(res, 200, { ok: true }, clearCookie());
  } else if (method === "POST" && path === "/api/login") {
    limitBy("login", ip);
    const { email, password } = await json(req);
    const u = login(email, password);
    send(res, 200, userPayload(u), { "Set-Cookie": sessionCookie(createSession(u.id), SESSION_MAX_AGE) });
  } else if (method === "POST" && path === "/api/logout") {
    endSession(token);
    send(res, 200, {}, clearCookie());
  } else if (method === "GET" && path === "/api/site") {
    send(res, 200, siteInfo(user));
  } else if (method === "POST" && path === "/api/onboarding") {
    const u = need();
    limitBy("onboarding", u.id);
    try {
      send(res, 200, userPayload(completeOnboarding(u, await json(req))));
    } catch (e) {
      // An existing account that declares an age under 18 is restricted at once, not deleted on the spot.
      if (e instanceof UserError && e.code === "age_ineligible") { restrictForAge(u.id); send(res, 403, { error: "age_restricted", user: userPayload(userById(u.id)!) }); return; }
      throw e;
    }
  } else if (method === "GET" && path === "/api/templates") {
    send(res, 200, { niches, templates: templates.map(publicTemplate) });
  } else if (method === "GET" && (m = /^\/api\/templates\/([a-z0-9-]+)$/.exec(path))) {
    const t = templateBySlug(m[1]);
    if (!t) throw new UserError("not_found", 404);
    send(res, 200, publicTemplate(t));
  } else if (method === "POST" && path === "/api/reports") {
    limitBy("report", ip);
    const id = createReport(user, await json(req));
    send(res, 200, { id });

  // ---- Account controls (work for every logged-in account, eligible or not)
  } else if (method === "GET" && path === "/api/account") {
    const u = need();
    send(res, 200, { ...accountSummary(u), user: userPayload(u) });
  } else if (method === "POST" && path === "/api/account/profile") {
    const u = need();
    limitBy("sensitive", u.id);
    const r = updateProfile(u, await json(req));
    if (r.newEmail) requestEmailChange(r.user, r.newEmail);
    send(res, 200, { user: userPayload(userFromSession(token)!), pendingEmail: r.newEmail });
  } else if (method === "POST" && path === "/api/account/email/cancel") {
    const u = need();
    cancelEmailChange(u);
    send(res, 200, { user: userPayload(userFromSession(token)!) });
  } else if (method === "POST" && path === "/api/account/password") {
    const u = need();
    limitBy("sensitive", u.id);
    const { currentPassword, newPassword } = await json(req);
    changePassword(u, currentPassword, newPassword, token);
    notifyPasswordChanged(u);
    send(res, 200, {});
  } else if (method === "POST" && path === "/api/account/sessions/revoke") {
    const u = need();
    send(res, 200, { ended: endOtherSessions(u.id, token) });
  } else if (method === "GET" && path === "/api/account/export") {
    const u = need();
    limitBy("export", u.id);
    const date = new Date().toISOString().slice(0, 10);
    send(res, 200, exportData(u), { "Content-Disposition": `attachment; filename="${site.brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-data-${date}.json"` });
  } else if (method === "POST" && path === "/api/account/refund-requests") {
    const u = need();
    limitBy("sensitive", u.id);
    const { purchaseId, details } = await json(req);
    send(res, 200, { id: requestRefund(u.id, purchaseId, details) });
  } else if (method === "POST" && path === "/api/account/delete") {
    const u = need();
    limitBy("sensitive", u.id);
    const { password, confirm } = await json(req);
    const result = deleteAccount(u, password, confirm);
    send(res, 200, result, clearCookie());

  // ---- Paid and photo-processing actions: eligible accounts only
  } else if (method === "POST" && path === "/api/purchases") {
    const u = eligible();
    limitBy("purchase", u.id);
    const { packId } = await json(req);
    const result = await buy(u.id, u.email, packId);
    send(res, 200, { ...result, credits: balance(u.id) });
  } else if (method === "GET" && (m = /^\/api\/purchases\/(\d+)\/return$/.exec(path))) {
    const u = need();
    const id = Number(m[1]);
    const paid = purchaseOwner(id) === u.id && (await confirmPurchase(id).catch(() => false));
    res.writeHead(303, { Location: paid ? "/?paid=1" : "/?paid=0", "Cache-Control": "no-store" });
    res.end();
  } else if (method === "POST" && path === "/api/photos") {
    const u = eligible();
    limitBy("photo", u.id);
    const photo = await savePhoto(u.id, await readBody(req, generation.upload.maxBytes));
    send(res, 200, photo);
  } else if (method === "GET" && (m = /^\/api\/photos\/([a-f0-9]{24})\.jpg$/.exec(path))) {
    const u = need();
    const p = photoFor(u.id, m[1]);
    if (!p) throw new UserError("not_found", 404);
    sendFile(req, res, p.file, { "Cache-Control": "private, max-age=3600" });
  } else if (method === "POST" && path === "/api/jobs") {
    const u = eligible();
    if (!generationAllowed()) throw new UserError("generation_not_configured", 503);
    const id = createJob(u.id, await json(req));
    send(res, 200, { job: publicJob(jobFor(u.id, id)!), credits: balance(u.id) });
  } else if (method === "GET" && path === "/api/jobs") {
    const u = need();
    send(res, 200, { credits: balance(u.id), jobs: listJobs(u.id) });
  } else if (method === "GET" && (m = /^\/api\/jobs\/(\d+)$/.exec(path))) {
    const u = need();
    const job = jobFor(u.id, Number(m[1]));
    if (!job) throw new UserError("not_found", 404);
    send(res, 200, { job: publicJob(job), credits: balance(u.id) });
  } else if (method === "DELETE" && (m = /^\/api\/jobs\/(\d+)$/.exec(path))) {
    const u = need();
    deleteVideo(u, Number(m[1]));
    send(res, 200, {});
  } else if ((method === "GET" || method === "HEAD") && (m = /^\/api\/jobs\/(\d+)\/(video\.mp4|poster\.jpg|source\.jpg)$/.exec(path))) {
    const u = need();
    const job = jobFor(u.id, Number(m[1]));
    if (!job) throw new UserError("not_found", 404);
    const file = m[2] === "video.mp4" ? job.output_file : m[2] === "poster.jpg" ? job.poster_file : job.source_file;
    if (!file || !existsSync(file)) throw new UserError("file_unavailable", 410);
    const name = `${job.template_id}-${job.id}.mp4`;
    const download = new URL(req.url ?? "/", "http://x").searchParams.get("download") === "1";
    sendFile(req, res, file, {
      "Cache-Control": "private, no-store",
      ...(m[2] === "video.mp4" ? { "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"` } : {}),
    });
  } else {
    send(res, 404, { error: "not_found" });
  }
}

let shell: string | null = null;
const brandText = () => site.brandName.replace(/[<>&"]/g, "");
function appShell(): string {
  if (!shell || process.env.NODE_ENV !== "production") {
    shell = readFileSync(join(PUBLIC, "index.html"), "utf8").replaceAll("{{BRAND}}", brandText());
  }
  return shell;
}

/** The shell with server-rendered content in <main>, for pages that must work without JavaScript. */
function staticPage(path: string, title: string, mainHtml: string): string {
  const t = `${title.replace(/[<>&"]/g, "")} · ${brandText()}`;
  return appShell()
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${t}"`)
    .replace(`<main id="main" tabindex="-1"></main>`, `<main id="main" tabindex="-1" data-static="${path}">${mainHtml}</main>`);
}

export const server = createServer(async (req, res) => {
  let path: string;
  try { path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname); }
  catch { send(res, 400, { error: "bad_request" }); return; }
  if (process.env.NODE_ENV === "production") {
    // Behind Railway's proxy: send plain-http visits to https, and tell browsers to stay on https.
    if (req.headers["x-forwarded-proto"] === "http" && req.headers.host) {
      res.writeHead(301, { Location: `https://${req.headers.host}${req.url ?? "/"}` });
      res.end();
      return;
    }
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  try {
    if (path === "/healthz") { send(res, 200, { ok: true }); return; }
    if (path.startsWith("/api/")) { await api(req, res, path); return; }
    if (req.method !== "GET" && req.method !== "HEAD") { send(res, 405, { error: "method_not_allowed" }); return; }
    if (path.startsWith("/media/previews/")) {
      // Only explicitly approved preview media is ever served.
      if (!servablePreviewFiles().has(path)) { send(res, 404, { error: "not_found" }); return; }
      sendFile(req, res, join(import.meta.dirname, "..", path), { "Cache-Control": "public, max-age=86400" });
      return;
    }
    if (path === "/legal" || path === "/legal/") { res.writeHead(301, { Location: "/legal/contact" }); res.end(); return; }
    const legalMatch = /^\/legal\/([a-z-]+)$/.exec(path);
    if (legalMatch) {
      const doc = legalPage(legalMatch[1]);
      if (doc) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache",
          ...(docPublished(legalMatch[1]) ? {} : { "X-Robots-Tag": "noindex" }) });
        res.end(req.method === "HEAD" ? undefined : staticPage(path, doc.title, doc.html));
        return;
      }
    }
    if (APP_ROUTES.some((r) => r.test(path)) || !extname(path)) {
      const known = APP_ROUTES.some((r) => r.test(path)) && (!path.startsWith("/templates/") && !path.startsWith("/create/") || templateBySlug(path.split("/")[2]));
      res.writeHead(known ? 200 : 404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(req.method === "HEAD" ? undefined : appShell());
      return;
    }
    // Static files, confined to the public folder.
    const file = normalize(join(PUBLIC, path));
    if (!file.startsWith(PUBLIC + "/")) { send(res, 404, { error: "not_found" }); return; }
    sendFile(req, res, file, { "Cache-Control": path.startsWith("/fonts/") ? "public, max-age=31536000, immutable" : "no-cache" });
  } catch (e) {
    if (e instanceof ValidationError) { send(res, 422, { error: e.code, fields: e.fields }); return; }
    if (e instanceof UserError) { send(res, e.status, { error: e.code }); return; }
    console.error(redact(e instanceof Error ? e.stack ?? e.message : e));
    if (!res.headersSent) send(res, 500, { error: "server_error" });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.NODE_ENV === "production") {
    // Test stand-ins must never run on a live site.
    if (process.env.PAYMENTS === "test") throw new Error("PAYMENTS=test is not allowed in production");
    if (process.env.ENGINE === "mock") throw new Error("ENGINE=mock is not allowed in production");
    if (process.env.PAYMENTS === "moyasar" && !process.env.APP_URL) throw new Error("APP_URL must be set for Moyasar payments");
    // Email misconfiguration must not take the site down: report it, and email (and so sign-up) stays off.
    try { mailName(); } catch (e) { console.error(`EMAIL OFF: ${(e as Error).message}`); delete process.env.MAIL; }
    const missing = ["RESEND_API_KEY", "MAIL_FROM", "APP_URL"].filter((k) => !process.env[k]);
    if (process.env.MAIL === "resend" && missing.length) console.error(`EMAIL OFF: MAIL=resend but missing ${missing.join(", ")} (Railway > Variables)`);
    else if (process.env.MAIL && process.env.MAIL !== "resend") console.error(`EMAIL OFF: MAIL must be "resend" (got "${process.env.MAIL}")`);
  }
  startRetention();
  const resumed = recoverJobs();
  if (resumed) console.log(`Resuming ${resumed} unfinished job(s)`);
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () =>
    console.log(`Listening on http://localhost:${port}  (generation: ${engineName()}, payments: ${process.env.PAYMENTS ?? "off"}, email: ${mailReady() ? mailName() : "off"})`));
}
