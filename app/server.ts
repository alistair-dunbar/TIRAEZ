// The web service: accounts, credits, template catalogue, photo upload, video orders.
// Node's built-in http server; no framework.
//   npm start            -> http://localhost:3000  (ENGINE=mock, PAYMENTS=test for local use)
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, statSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { SESSION_MAX_AGE, UserError, createSession, endSession, login, signup, userFromSession, type User } from "./auth.ts";
import { balance, buy, packs } from "./credits.ts";
import { db } from "./db.ts";
import { engine } from "./engine/index.ts";
import { DATA_DIR, catalog, createVideo, listVideos, recoverInterrupted, videoFile } from "./videos.ts";

const PUBLIC = join(import.meta.dirname, "public");
const MAX_UPLOAD = 10 * 1024 * 1024;
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".mp4": "video/mp4",
};

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(data);
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
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

/** Works out the real image type from the file's first bytes; the browser's claim is not trusted. */
function imageType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

function sendFile(req: IncomingMessage, res: ServerResponse, file: string, extra: Record<string, string> = {}): void {
  if (!existsSync(file) || !statSync(file).isFile()) { send(res, 404, { error: "not_found" }); return; }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
    "Content-Length": String(statSync(file).size), ...extra });
  if (req.method === "HEAD") { res.end(); return; }
  createReadStream(file).pipe(res);
}

async function api(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const method = req.method ?? "GET";
  // Browsers can't add this header on a cross-site form post, which blocks request forgery.
  if (method !== "GET" && req.headers["x-requested-with"] !== "app") throw new UserError("forbidden", 403);

  const token = cookie(req, "sid");
  const user = userFromSession(token);
  const need = (): User => { if (!user) throw new UserError("login_required", 401); return user; };

  if (method === "POST" && (path === "/api/signup" || path === "/api/login")) {
    const { email, password } = await json(req);
    const u = path === "/api/signup" ? signup(email, password) : login(email, password);
    send(res, 200, { email: u.email, credits: u.credits }, { "Set-Cookie": sessionCookie(createSession(u.id), SESSION_MAX_AGE) });
  } else if (method === "POST" && path === "/api/logout") {
    endSession(token);
    send(res, 200, {}, { "Set-Cookie": sessionCookie("", 0) });
  } else if (method === "GET" && path === "/api/me") {
    send(res, 200, user ? { email: user.email, credits: user.credits } : null);
  } else if (method === "GET" && path === "/api/templates") {
    send(res, 200, catalog.map((t) => ({ id: t.id, niche: t.niche, name: t.name, description: t.description, preview: `/previews/${t.id}.jpg` })));
  } else if (method === "GET" && path === "/api/packs") {
    send(res, 200, packs);
  } else if (method === "POST" && path === "/api/purchases") {
    const u = need();
    const { packId } = await json(req);
    const result = await buy(u.id, u.email, packId);
    send(res, 200, { ...result, credits: balance(u.id) });
  } else if (method === "PUT" && path === "/api/uploads") {
    const u = need();
    const buf = await readBody(req, MAX_UPLOAD);
    const type = imageType(buf);
    if (!type) throw new UserError("not_an_image", 415);
    const id = randomBytes(12).toString("hex");
    const file = `${DATA_DIR}/uploads/${id}.${type.ext}`;
    writeFileSync(file, buf);
    db.prepare("INSERT INTO uploads (id, user_id, file, mime) VALUES (?, ?, ?, ?)").run(id, u.id, file, type.mime);
    send(res, 200, { uploadId: id });
  } else if (method === "POST" && path === "/api/videos") {
    const u = need();
    const { templateId, uploadId } = await json(req);
    const id = createVideo(u.id, String(templateId), uploadId ? String(uploadId) : undefined);
    send(res, 200, { id, credits: balance(u.id) });
  } else if (method === "GET" && path === "/api/videos") {
    const u = need();
    send(res, 200, { credits: balance(u.id), videos: listVideos(u.id) });
  } else if (method === "GET" && /^\/api\/videos\/\d+\/file$/.test(path)) {
    const u = need();
    const id = Number(path.split("/")[3]);
    const file = videoFile(u.id, id);
    if (!file) throw new UserError("not_found", 404);
    sendFile(req, res, file, { "Content-Disposition": `inline; filename="video-${id}.mp4"`, "Cache-Control": "private, no-store" });
  } else {
    send(res, 404, { error: "not_found" });
  }
}

export const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://x").pathname;
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  try {
    if (path.startsWith("/api/")) { await api(req, res, path); return; }
    if (req.method !== "GET" && req.method !== "HEAD") { send(res, 405, { error: "method_not_allowed" }); return; }
    const preview = path.match(/^\/previews\/([a-z0-9-]+)\.jpg$/);
    if (preview) {
      const t = catalog.find((c) => c.id === preview[1]);
      if (!t) { send(res, 404, { error: "not_found" }); return; }
      sendFile(req, res, t.preview, { "Cache-Control": "public, max-age=3600" });
      return;
    }
    // Static files, confined to the public folder.
    const file = normalize(join(PUBLIC, path === "/" ? "index.html" : path));
    if (!file.startsWith(PUBLIC)) { send(res, 404, { error: "not_found" }); return; }
    sendFile(req, res, file);
  } catch (e) {
    if (e instanceof UserError) { send(res, e.status, { error: e.code }); return; }
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: "server_error" });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const refunded = recoverInterrupted();
  if (refunded) console.log(`Refunded ${refunded} order(s) interrupted by the last shutdown`);
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () =>
    console.log(`Listening on http://localhost:${port}  (engine: ${engine().name}, payments: ${process.env.PAYMENTS ?? "none"})`));
}
