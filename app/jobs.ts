// The generation lifecycle. Every step is written to the database before the next begins, so a
// restart, a refresh or a dropped connection never loses a job:
//
//   queued -> uploading -> submitting -> in_queue -> in_progress -> saving -> completed
//                                   \-> failed (credits returned)
//
// A request that might have reached the provider is never sent again automatically.
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { UserError, ValidationError } from "./auth.ts";
import { ASPECT_RATIOS, availability, templateById, type Template } from "./catalog.ts";
import { creditsFor, generation, models } from "./config.ts";
import { balance, consumeJob, isRefunded, refundJob, spendForJob } from "./credits.ts";
import { db, tx } from "./db.ts";
import { redact } from "./guard.ts";
import { retention } from "./legal.ts";
import { cropPhoto, posterFrame, probe } from "./media.ts";
import { DATA_DIR, photoFor } from "./photos.ts";
import { assemblePrompt, validateInputs, validateSettings, type FieldErrors } from "./prompt.ts";
import { provider } from "./providers/index.ts";
import { TransientError, type JobRef } from "./providers/types.ts";

mkdirSync(`${DATA_DIR}/jobs`, { recursive: true });

const POLL_MS = Number(process.env.JOB_POLL_MS ?? 4000);
const ACTIVE = ["queued", "uploading", "submitting", "in_queue", "in_progress", "saving"];

export { ValidationError };

type Row = Record<string, any>;
const get = (id: number): Row | undefined => db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Row | undefined;
/** Updates a job, but only while it is still in one of the states it was read in (default: any active state). */
const set = (id: number, fields: Record<string, unknown>, from: string[] = ACTIVE): boolean => {
  const keys = Object.keys(fields);
  const r = db.prepare(`UPDATE jobs SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND status IN (${from.map(() => "?").join(",")})`)
    .run(...(keys.map((k) => fields[k]) as any[]), id, ...from);
  return r.changes === 1;
};

// ---------------------------------------------------------------------------------------------
// Creating a job

export interface CreateRequest {
  templateId: unknown; clientKey: unknown; photoId: unknown;
  crop: unknown; inputs: unknown; settings: unknown;
}

function spentUsd(): number {
  return (db.prepare("SELECT COALESCE(SUM(usd), 0) AS s FROM provider_spend").get() as any).s;
}

/** Converts the customer's framing (fractions of the photo) to exact pixels, or explains the problem. */
function cropPixels(raw: unknown, photo: { width: number; height: number }, aspect: string, t: Template): { x: number; y: number; w: number; h: number } | string {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f = ["x", "y", "w", "h"].map((k) => Number(c[k]));
  if (f.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return "Adjust the framing of your photo again.";
  let [x, y, w, h] = [f[0] * photo.width, f[1] * photo.height, f[2] * photo.width, f[3] * photo.height];
  const ratio = ASPECT_RATIOS[aspect];
  if (Math.abs(w / h - ratio) / ratio > 0.03) return `The framing doesn't match ${aspect}. Adjust the framing again.`;
  w = Math.floor(Math.min(w, photo.width) / 2) * 2;
  h = Math.floor(Math.min(w / ratio, photo.height) / 2) * 2;
  w = Math.floor(Math.min(w, h * ratio) / 2) * 2;
  x = Math.min(Math.max(0, Math.round(x)), photo.width - w);
  y = Math.min(Math.max(0, Math.round(y)), photo.height - h);
  const m = models[t.model].image;
  if (w < m.minWidth || h < m.minHeight) return "This framing uses too small a part of your photo. Zoom out, or use a larger photo.";
  return { x, y, w, h };
}

export function createJob(userId: number, body: CreateRequest): number {
  const t = templateById(String(body.templateId ?? ""));
  if (!t) throw new UserError("unknown_template", 404);
  const a = availability(t);
  if (!a.ready) throw new UserError(a.reason!, 503);

  const clientKey = String(body.clientKey ?? "");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(clientKey)) throw new UserError("bad_request");
  // The same click arriving twice returns the first job instead of charging again.
  const existing = db.prepare("SELECT id FROM jobs WHERE user_id = ? AND client_key = ?").get(userId, clientKey) as Row | undefined;
  if (existing) return existing.id;

  const errors: FieldErrors = {};
  const { inputs, errors: inputErrors } = validateInputs(t, body.inputs);
  const { settings, errors: settingErrors } = validateSettings(t, body.settings);
  Object.assign(errors, inputErrors, settingErrors);
  const photo = photoFor(userId, String(body.photoId ?? ""));
  if (!photo || !existsSync(photo.file)) errors.photo = "Upload a photo to continue.";
  let crop: ReturnType<typeof cropPixels> = "";
  if (photo && !errors.aspectRatio) {
    crop = cropPixels(body.crop, photo, settings.aspectRatio, t);
    if (typeof crop === "string") errors.crop = crop;
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const credits = creditsFor(settings.duration)!;
  const active = (db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE user_id = ? AND status IN (${ACTIVE.map(() => "?").join(",")})`)
    .get(userId, ...ACTIVE) as Row).n;
  if (active >= generation.maxActiveJobsPerUser) throw new UserError("too_many_active", 429);
  const cap = Number(process.env.GENERATION_BUDGET_USD);
  if (cap > 0 && spentUsd() + models[t.model].usdPerSecond * settings.duration > cap) throw new UserError("generation_paused", 503);

  const id = tx(() => {
    // Ids are never reused, even after a video is deleted: the ledger and spend records refer to them.
    const jobId = Number(db.prepare(`INSERT INTO jobs (id, user_id, client_key, template_id, template_version, template_name,
        photo_id, crop, inputs, settings, prompt, model, credits, status, provider)
      VALUES ((SELECT MAX(n) + 1 FROM (SELECT COALESCE(MAX(id), 0) AS n FROM jobs
          UNION ALL SELECT COALESCE(MAX(CAST(ref AS INTEGER)), 0) FROM credit_events WHERE reason IN ('video', 'refund', 'consume')
          UNION ALL SELECT COALESCE(MAX(job_id), 0) FROM provider_spend)),
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`).run(
      userId, clientKey, t.id, t.version, t.name, String(body.photoId), JSON.stringify(crop), JSON.stringify(inputs),
      JSON.stringify(settings), assemblePrompt(t, inputs, settings), t.model, credits, models[t.model].provider,
    ).lastInsertRowid);
    spendForJob(userId, jobId, credits); // throws no_credits, rolling the job back
    return jobId;
  });
  schedule(id, 0);
  return id;
}

// ---------------------------------------------------------------------------------------------
// Running jobs

const timers = new Map<number, ReturnType<typeof setTimeout>>();
const running = new Set<number>();
const waiters = new Set<() => void>();

function schedule(id: number, delay: number): void {
  if (timers.has(id)) return;
  timers.set(id, setTimeout(() => { timers.delete(id); void step(id); }, delay));
}

function settle(): void {
  if (timers.size === 0 && running.size === 0) for (const w of waiters) w();
}

/** Resolves when no job is waiting or running (tests). */
export function idle(): Promise<void> {
  if (timers.size === 0 && running.size === 0) return Promise.resolve();
  return new Promise((resolve) => { const w = () => { waiters.delete(w); resolve(); }; waiters.add(w); });
}

/**
 * Stops a person's videos that haven't been sent to the video model yet, returning their credits.
 * Videos already with the model carry on (they can't be recalled), and stay viewable.
 */
export function cancelQueuedJobs(userId: number, code = "cancelled"): number {
  const queued = db.prepare("SELECT * FROM jobs WHERE user_id = ? AND status = 'queued'").all(userId) as Row[];
  let n = 0;
  for (const j of queued) {
    if (set(j.id, { status: "failed", failure_code: code, failure_detail: "stopped before submission", finished_at: now() }, ["queued"])) {
      refundJob(j.user_id, j.id, j.credits); n++;
      const t = timers.get(j.id); if (t) { clearTimeout(t); timers.delete(j.id); settle(); }
    }
  }
  return n;
}

function fail(job: Row, code: string, detail: string): void {
  // Only an active job can fail, and only then are its credits returned.
  if (!set(job.id, { status: "failed", failure_code: code, failure_detail: detail.slice(0, 1000), finished_at: now() })) return;
  refundJob(job.user_id, job.id, job.credits);
  console.error(`job ${job.id} failed (${code}): ${redact(detail).slice(0, 300)}`);
}

const now = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().replace("T", " ").slice(0, 19);

/**
 * Jobs still marked as in progress long after they should have ended, with nothing in this process
 * working on them (for example after a crash). They're failed and their credits returned, so they
 * stop holding a photo and credits indefinitely.
 */
export function failStaleJobs(hours: number): number[] {
  const rows = db.prepare(`SELECT * FROM jobs WHERE status IN (${ACTIVE.map(() => "?").join(",")}) AND created_at < datetime('now', ?)`)
    .all(...ACTIVE, `-${hours} hours`) as Row[];
  const failed: number[] = [];
  for (const j of rows) {
    if (timers.has(j.id) || running.has(j.id)) continue;
    fail(j, "timeout", "stale: no progress recorded for too long");
    if (get(j.id)?.status === "failed") failed.push(j.id);
  }
  return failed;
}
const ageMinutes = (ts: string | null) => (ts ? (Date.now() - Date.parse(`${ts.replace(" ", "T")}Z`)) / 60_000 : 0);
const backoff = (failures: number) => Math.min(60_000, POLL_MS * 2 ** Math.min(failures, 6));

function ref(job: Row): JobRef {
  return { requestId: job.provider_request_id, statusUrl: job.provider_status_url, responseUrl: job.provider_response_url, settings: JSON.parse(job.settings) };
}

async function step(id: number): Promise<void> {
  if (running.has(id)) return;
  running.add(id);
  try { await advance(id); }
  catch (e) { console.error(`job ${id}: unexpected error: ${redact(e instanceof Error ? e.stack ?? e.message : e)}`); const j = get(id); if (j && ACTIVE.includes(j.status)) schedule(id, backoff(j.check_failures + 1)); }
  finally { running.delete(id); settle(); }
}

async function advance(id: number): Promise<void> {
  const job = get(id);
  if (!job || !ACTIVE.includes(job.status)) return;
  const p = provider(job.provider);
  if (!p) { schedule(id, 30_000); return; } // generation switched off after the order: wait, don't fail

  if (job.status === "queued" || job.status === "uploading") {
    set(id, { status: "uploading" });
    const photo = db.prepare("SELECT file FROM photos WHERE id = ?").get(job.photo_id) as Row | undefined;
    if (!photo || !existsSync(photo.file)) return fail(job, "photo_missing", "source photo file missing");
    const source = `${DATA_DIR}/jobs/${id}-source.jpg`;
    try {
      if (!existsSync(source)) await cropPhoto(photo.file, JSON.parse(job.crop), source, 2048);
    } catch (e) { return fail(job, "prepare_failed", (e as Error).message); }
    let url = job.provider_input_url as string | null;
    if (!url) {
      try { url = await p.uploadImage(readFileSync(source), "image/jpeg", `job-${id}.jpg`); }
      catch (e) {
        if (e instanceof TransientError && job.submit_attempts < 4) {
          set(id, { submit_attempts: job.submit_attempts + 1 });
          return schedule(id, backoff(job.submit_attempts + 1));
        }
        return fail(job, "prepare_failed", (e as Error).message);
      }
      set(id, { provider_input_url: url, source_file: source, submit_attempts: 0 });
    }
    // Recorded before the request goes out: if we stop now, recovery knows it may have been sent.
    set(id, { status: "submitting", submitted_at: now() });
    const s = await p.submit(models[job.model], { imageUrl: url, prompt: job.prompt, ...JSON.parse(job.settings) });
    const fresh = get(id)!;
    if (s.ok) {
      if (!set(id, { status: "in_queue", provider_request_id: s.requestId, provider_status_url: s.statusUrl,
        provider_response_url: s.responseUrl, last_check_ok_at: now(), check_failures: 0 }, ["submitting"])) return;
      recordSpend(fresh);
      return schedule(id, POLL_MS);
    }
    if ((s.kind === "busy" || s.kind === "not_sent") && fresh.submit_attempts < 3) {
      set(id, { status: "queued", submitted_at: null, submit_attempts: fresh.submit_attempts + 1 });
      return schedule(id, backoff(fresh.submit_attempts + 2));
    }
    if (s.kind === "unconfirmed") recordSpend(fresh);
    const code = { rejected: "rejected", config: "unavailable", busy: "busy", not_sent: "busy", unconfirmed: "unconfirmed" }[s.kind];
    return fail(fresh, code, s.detail);
  }

  if (job.status === "submitting") {
    // Only reachable after a restart mid-request: we can't tell whether the provider took it.
    return fail(job, "unconfirmed", "interrupted while submitting; not resent automatically");
  }

  if (job.status === "in_queue" || job.status === "in_progress") {
    if (ageMinutes(job.submitted_at) > generation.giveUpAfterMinutes) return fail(job, "timeout", "gave up waiting");
    let st;
    try { st = await p.status(ref(job)); }
    catch (e) {
      set(id, { check_failures: job.check_failures + 1 });
      return schedule(id, backoff(job.check_failures + 1));
    }
    if ("lost" in st) return fail(job, "lost", "provider no longer knows the request");
    const moved = set(id, { last_check_ok_at: now(), check_failures: 0, status: st.state === "IN_QUEUE" ? "in_queue" : st.state === "IN_PROGRESS" ? "in_progress" : "saving" },
      ["in_queue", "in_progress"]);
    if (!moved) return;
    queuePositions.set(id, st.queuePosition);
    return schedule(id, st.state === "COMPLETED" ? 0 : POLL_MS);
  }

  if (job.status === "saving") {
    let url = job.provider_output_url as string | null;
    if (!url) {
      let r;
      try { r = await p.result(ref(job)); }
      catch (e) {
        if (job.check_failures >= 8) return fail(job, "save_failed", (e as Error).message);
        set(id, { check_failures: job.check_failures + 1 });
        return schedule(id, backoff(job.check_failures + 1));
      }
      if (!r.ok) return fail(job, r.kind, r.detail);
      url = r.videoUrl;
      set(id, { provider_output_url: url, check_failures: 0, last_check_ok_at: now() });
    }
    const out = `${DATA_DIR}/jobs/${id}.mp4`;
    const poster = `${DATA_DIR}/jobs/${id}-poster.jpg`;
    try {
      await p.download(url, out, ref(job));
      const meta = await probe(out);
      await posterFrame(out, poster);
      const bytes = readFileSync(out).length;
      // The storage deadline starts at successful completion, on the server's clock.
      if (set(id, { status: "completed", output_file: out, poster_file: poster, finished_at: now(), expires_at: daysFromNow(retention.videoDays),
        output_meta: JSON.stringify({ width: meta.width, height: meta.height, duration: meta.duration, bytes }) })) consumeJob(job.user_id, id);
    } catch (e) {
      rmSync(out, { force: true });
      const j = get(id)!;
      if (j.check_failures >= 8) return fail(j, "save_failed", (e as Error).message);
      set(id, { check_failures: j.check_failures + 1 });
      return schedule(id, backoff(j.check_failures + 1));
    }
  }
}

const queuePositions = new Map<number, number | null>();

function recordSpend(job: Row): void {
  const s = JSON.parse(job.settings);
  db.prepare("INSERT INTO provider_spend (job_id, usd) VALUES (?, ?)").run(job.id, models[job.model].usdPerSecond * s.duration);
}

/** On start-up: carry on with every unfinished job, failing (and refunding) only what can't be confirmed. */
export function recoverJobs(): number {
  const rows = db.prepare(`SELECT id FROM jobs WHERE status IN (${ACTIVE.map(() => "?").join(",")})`).all(...ACTIVE) as Row[];
  for (const r of rows) schedule(r.id, 0);
  return rows.length;
}

// ---------------------------------------------------------------------------------------------
// What the customer sees

type Stage = "queued" | "generating" | "completed" | "failed";

export function publicJob(job: Row) {
  const settings = JSON.parse(job.settings);
  const stage: Stage = job.status === "completed" ? "completed" : job.status === "failed" ? "failed"
    : job.status === "in_progress" || job.status === "saving" ? "generating" : "queued";
  const active = ACTIVE.includes(job.status);
  const stale = active && job.provider_request_id && (job.check_failures >= 2 ||
    ageMinutes(job.last_check_ok_at) * 60 > generation.statusStaleAfterSeconds);
  const t = templateById(job.template_id);
  const meta = job.output_meta ? JSON.parse(job.output_meta) : null;
  const fileThere = job.status === "completed" && job.output_file && existsSync(job.output_file);
  return {
    id: job.id,
    stage,
    saving: job.status === "saving",
    queuePosition: job.status === "in_queue" ? queuePositions.get(job.id) ?? null : null,
    statusUnavailable: Boolean(stale),
    template: { id: job.template_id, slug: t?.slug ?? null, name: job.template_name, version: job.template_version, current: t?.version === job.template_version },
    photo: photoMeta(job.photo_id),
    crop: JSON.parse(job.crop),
    inputs: JSON.parse(job.inputs),
    settings,
    credits: job.credits,
    createdAt: job.created_at,
    finishedAt: job.finished_at,
    output: job.status === "completed" ? { available: Boolean(fileThere), ...(meta ?? {}) } : null,
    // Storage deadline (set by the server at completion); expired = the files were deleted on that date.
    expiresAt: job.status === "completed" ? job.expires_at ?? null : null,
    expired: Boolean(job.media_deleted_at),
    expiredAt: job.media_deleted_at ?? null,
    expiringSoon: Boolean(job.status === "completed" && !job.media_deleted_at && job.expires_at &&
      Date.parse(`${String(job.expires_at).replace(" ", "T")}Z`) - Date.now() <= retention.expiryNoticeDays * 86_400_000),
    poster: job.poster_file && existsSync(job.poster_file) ? `/api/jobs/${job.id}/poster.jpg` : null,
    failure: job.status === "failed" ? { code: job.failure_code, refunded: isRefunded(job.id) } : null,
  };
}

function photoMeta(id: string): { id: string; width: number; height: number } | null {
  const p = db.prepare("SELECT id, width, height, file, deleted_at FROM photos WHERE id = ?").get(id) as Row | undefined;
  return p && !p.deleted_at && existsSync(p.file) ? { id: p.id, width: p.width, height: p.height } : null;
}

export function jobFor(userId: number, id: number): Row | null {
  return (db.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?").get(id, userId) as Row) ?? null;
}

export function listJobs(userId: number) {
  return (db.prepare("SELECT * FROM jobs WHERE user_id = ? ORDER BY id DESC LIMIT 200").all(userId) as Row[]).map(publicJob);
}

export { balance };
