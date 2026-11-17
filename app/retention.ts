// Time-based deletion, run on the server (hourly, so every rule runs at least daily). Never triggered by
// a browser. Each rule has its own clock, uses server timestamps, works in batches, is safe to run
// again (a row is only marked done after its files are really gone), and never touches credit or
// payment records.
//
// Rules (config/retention.json, approved 17 Nov 2026):
//   videos        completed videos and thumbnails: expires_at = completion + videoDays
//   sources       per-job cropped source copies: sourcePhotoDays after that job's final state
//   photos        uploaded photos used by jobs: sourcePhotoDays after the LAST job using it ended
//                 (never while any job using it is still running)
//   abandoned     uploaded photos never used by any job: abandonedUploadDays after upload
//   unverified    accounts never confirmed: unverifiedAccountDays after creation (resends don't extend it),
//                 unless something was bought
//   restricted    accounts restricted after an under-18 declaration: ageRestrictedDays after restriction
//   sessions      expired sessions; email links emailLinkRecordDays after expiry
//   stale         jobs stuck in progress for staleJobHours: failed with credits returned
//   notices       one email per customer when videos are within expiryNoticeDays of expiry
//
// "videos", "sources" and "photos" (the media rules introduced on 17 Nov 2026) only report, and delete
// nothing, unless RETENTION_MEDIA=enforce, so existing data can be reviewed first (docs/RETENTION.md).
// Expiry emails are only sent when the media rules are enforced and email is configured.
//
//   npm run retention -- --inventory     what exists and when it falls due (no changes)
//   npm run retention -- --dry-run       one run, reporting what would be deleted (no changes)
//   npm run retention -- --enforce       one run with the media rules enforced
import { createHash } from "node:crypto";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { site } from "./config.ts";
import { db } from "./db.ts";
import { eraseAccount } from "./account.ts";
import { failStaleJobs } from "./jobs.ts";
import { retention } from "./legal.ts";
import { appUrl, mailReady, messages, send } from "./mail.ts";
import { DATA_DIR } from "./photos.ts";

type Row = Record<string, any>;
const ACTIVE = ["queued", "uploading", "submitting", "in_queue", "in_progress", "saving"];
const ACTIVE_SQL = ACTIVE.map((s) => `'${s}'`).join(",");
const BATCH = 200, MAX_BATCHES = 25;

export type Mode = "enforce" | "dry-run";
export const mediaMode = (): Mode => (process.env.RETENTION_MEDIA === "enforce" ? "enforce" : "dry-run");

export interface RunReport {
  mode: Mode;
  videos: number; sources: number; photos: number; abandoned: number;
  unverified: number; restricted: number; sessions: number; emailLinks: number; strays: number;
  stale: number; notices: number; noticesFailed: number;
  failures: number;            // files that couldn't be deleted (left for the next run)
}

/** Removes files; true only if every one is gone afterwards. Missing files count as gone. */
function removeAll(files: (string | null | undefined)[]): boolean {
  let ok = true;
  for (const f of files) {
    if (!f) continue;
    try { rmSync(f, { force: true }); } catch { ok = false; }
    if (existsSync(f)) ok = false;
  }
  return ok;
}

/** Runs `pick` until it returns nothing or the batch limit is reached; `act` handles each row. */
function batched(pick: () => Row[], act: (r: Row) => void): void {
  const seen = new Set<string>(); // an item that failed is tried once per run, then left for the next run
  for (let i = 0; i < MAX_BATCHES; i++) {
    const rows = pick().filter((r) => !seen.has(String(r.id)));
    if (!rows.length) return;
    for (const r of rows) { seen.add(String(r.id)); act(r); }
  }
}

/**
 * Gives completed videos made before retention existed an expiry date. Non-destructive: never earlier
 * than migrationGraceDays from now, so their owners get notice and time to download.
 */
export function migrateExpiryDates(): number {
  return Number(db.prepare(`UPDATE jobs SET
      expires_at = MAX(datetime(COALESCE(finished_at, created_at), ?), datetime('now', ?)),
      expiry_grace = CASE WHEN datetime(COALESCE(finished_at, created_at), ?) < datetime('now', ?) THEN 1 ELSE 0 END
    WHERE status = 'completed' AND expires_at IS NULL AND media_deleted_at IS NULL`)
    .run(`+${retention.videoDays} days`, `+${retention.migrationGraceDays} days`, `+${retention.videoDays} days`, `+${retention.migrationGraceDays} days`).changes);
}

let inFlight = false;

export async function runRetention(opts: { media?: Mode; now?: number } = {}): Promise<RunReport> {
  const media = opts.media ?? mediaMode();
  const now = opts.now ?? Date.now();
  const enforce = media === "enforce";
  const r: RunReport = { mode: media, videos: 0, sources: 0, photos: 0, abandoned: 0, unverified: 0, restricted: 0,
    sessions: 0, emailLinks: 0, strays: 0, stale: 0, notices: 0, noticesFailed: 0, failures: 0 };
  if (inFlight) return r; // never two runs at once
  inFlight = true;
  try {
    migrateExpiryDates();

    // Stuck jobs first, so they stop protecting photos and credits.
    r.stale = failStaleJobs(retention.staleJobHours).length;

    // 1. Expired videos: delete the video and thumbnail, clear the details; keep the minimal record
    //    (template, dates, credits) so My videos can say the file has expired.
    if (enforce) {
      batched(() => db.prepare(`SELECT id, output_file, poster_file FROM jobs WHERE status = 'completed'
          AND media_deleted_at IS NULL AND expires_at <= datetime('now') ORDER BY id LIMIT ${BATCH}`).all() as Row[], (j) => {
        if (!removeAll([j.output_file, j.poster_file, `${DATA_DIR}/jobs/${j.id}.mp4.part`])) { r.failures++; return; }
        r.videos += Number(db.prepare(`UPDATE jobs SET media_deleted_at = datetime('now'), output_file = NULL, poster_file = NULL,
            inputs = '{}', prompt = '', crop = '{}', provider_input_url = NULL, provider_output_url = NULL,
            provider_status_url = NULL, provider_response_url = NULL, failure_detail = NULL
          WHERE id = ? AND media_deleted_at IS NULL`).run(j.id).changes);
      });
    } else r.videos = (db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE status = 'completed' AND media_deleted_at IS NULL AND expires_at <= datetime('now')`).get() as Row).n;

    // 2. Per-job cropped source copies, sourcePhotoDays after the job's final state. Failed jobs' details
    //    go too: without the photo they only explain the failure and the returned credits.
    const sourcesSql = `FROM jobs WHERE status IN ('completed', 'failed') AND source_deleted_at IS NULL
        AND COALESCE(finished_at, created_at) <= datetime('now', '-${retention.sourcePhotoDays} days')`;
    if (enforce) {
      batched(() => db.prepare(`SELECT id, status, source_file ${sourcesSql} ORDER BY id LIMIT ${BATCH}`).all() as Row[], (j) => {
        if (!removeAll([j.source_file])) { r.failures++; return; }
        const clear = j.status === "failed" ? ", inputs = '{}', prompt = '', crop = '{}', failure_detail = NULL, provider_input_url = NULL" : "";
        r.sources += Number(db.prepare(`UPDATE jobs SET source_deleted_at = datetime('now'), source_file = NULL${clear}
          WHERE id = ? AND source_deleted_at IS NULL`).run(j.id).changes);
      });
    } else r.sources = (db.prepare(`SELECT COUNT(*) AS n ${sourcesSql}`).get() as Row).n;

    // 3. Uploaded photos used by jobs: only once no job using them is still running, and the last one
    //    ended sourcePhotoDays ago. The row stays (jobs refer to it) with deleted_at set; the file goes.
    const photosSql = `FROM photos p WHERE p.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM jobs j WHERE j.photo_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.photo_id = p.id AND j.status IN (${ACTIVE_SQL}))
        AND (SELECT MAX(COALESCE(j.finished_at, j.created_at)) FROM jobs j WHERE j.photo_id = p.id) <= datetime('now', '-${retention.sourcePhotoDays} days')`;
    if (enforce) {
      batched(() => db.prepare(`SELECT p.id, p.file ${photosSql} LIMIT ${BATCH}`).all() as Row[], (p) => {
        if (!removeAll([p.file])) { r.failures++; return; }
        // Re-checked at write time: a job started meanwhile keeps the photo.
        r.photos += Number(db.prepare(`UPDATE photos SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.photo_id = photos.id AND j.status IN (${ACTIVE_SQL}))`).run(p.id).changes);
      });
    } else r.photos = (db.prepare(`SELECT COUNT(*) AS n ${photosSql}`).get() as Row).n;

    // 4. Abandoned uploads (never used by any job): abandonedUploadDays after upload. Always enforced
    //    (this rule existed before 17 Nov 2026).
    batched(() => db.prepare(`SELECT id, file FROM photos p WHERE created_at <= datetime('now', ?)
        AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.photo_id = p.id) LIMIT ${BATCH}`).all(`-${retention.abandonedUploadDays} days`) as Row[], (p) => {
      if (!removeAll([p.file])) { r.failures++; return; }
      r.abandoned += Number(db.prepare("DELETE FROM photos WHERE id = ? AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.photo_id = photos.id)").run(p.id).changes);
    });

    // 5. Accounts never confirmed, from creation (resending a link doesn't move the clock), unless something was bought.
    const unverified = db.prepare(`SELECT id FROM users u WHERE email_verified_at IS NULL AND deleted_at IS NULL
        AND created_at <= datetime('now', ?) AND NOT EXISTS (SELECT 1 FROM purchases p WHERE p.user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.user_id = u.id AND j.status IN (${ACTIVE_SQL}))`).all(`-${retention.unverifiedAccountDays} days`) as Row[];
    for (const a of unverified) { eraseAccount(a.id); r.unverified++; }

    // 6. Restricted (declared under 18) and not corrected within the review period. Purchases stay only
    //    as anonymous records for the refund obligation; photos and videos go.
    const restricted = db.prepare(`SELECT id FROM users u WHERE age_restricted_at <= datetime('now', ?) AND deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.user_id = u.id AND j.status IN (${ACTIVE_SQL}))`).all(`-${retention.ageRestrictedDays} days`) as Row[];
    for (const a of restricted) { eraseAccount(a.id); r.restricted++; }

    // 7. Sessions and email links. Links stop working at expiry (checked on use); the record is removed later.
    r.sessions = Number(db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run().changes);
    r.emailLinks = Number(db.prepare("DELETE FROM email_tokens WHERE expires_at <= datetime('now', ?)").run(`-${retention.emailLinkRecordDays} days`).changes);

    // 8. Half-written uploads left by a crash.
    const dir = `${DATA_DIR}/photos`;
    if (existsSync(dir)) for (const f of readdirSync(dir)) {
      if (!f.endsWith(".upload")) continue;
      const path = `${dir}/${f}`;
      try { if (now - statSync(path).mtimeMs > 3600_000) { rmSync(path, { force: true }); r.strays++; } } catch { r.failures++; }
    }

    // 9. Expiry emails (only when expiry is enforced, so the email never announces a deletion that won't happen).
    if (enforce && mailReady()) {
      const n = await sendExpiryNotices();
      r.notices = n.sent; r.noticesFailed = n.failed;
    }
  } finally {
    inFlight = false;
  }
  db.prepare("INSERT INTO retention_runs (mode, results, failures) VALUES (?, ?, ?)").run(media, JSON.stringify(r), r.failures);
  return r;
}

/**
 * One email per customer listing their videos that expire within expiryNoticeDays. Each video is
 * claimed before sending (so two runs can't both send), marked "sent" only after the provider accepted
 * the message, and retried up to three times. The provider idempotency key stops a retry after an
 * unknown outcome from producing a second email.
 */
export async function sendExpiryNotices(): Promise<{ sent: number; failed: number }> {
  // Runs never overlap, so a claim still marked "sending" was left by a run that crashed. Releasing it
  // is safe: the provider's idempotency key stops the retry from producing a second email.
  db.prepare("UPDATE jobs SET expiry_notice_status = NULL WHERE expiry_notice_status = 'sending'").run();
  const due = db.prepare(`SELECT j.id, j.user_id, j.template_name, j.expires_at, j.expiry_notice_attempts, u.email
      FROM jobs j JOIN users u ON u.id = j.user_id
      WHERE j.status = 'completed' AND j.media_deleted_at IS NULL AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL
        AND j.expires_at > datetime('now') AND j.expires_at <= datetime('now', ?)
        AND j.expiry_notice_status IS NULL AND j.expiry_notice_attempts < 3
      ORDER BY j.user_id, j.expires_at`).all(`+${retention.expiryNoticeDays} days`) as Row[];
  const byUser = new Map<number, Row[]>();
  for (const j of due) byUser.set(j.user_id, [...(byUser.get(j.user_id) ?? []), j]);
  let sent = 0, failed = 0;
  for (const [, jobs] of byUser) {
    const ids = jobs.map((j) => j.id);
    const claimed = Number(db.prepare(`UPDATE jobs SET expiry_notice_status = 'sending', expiry_notice_attempts = expiry_notice_attempts + 1
      WHERE id IN (${ids.map(() => "?").join(",")}) AND expiry_notice_status IS NULL`).run(...ids).changes);
    if (claimed !== ids.length) continue; // another run has them
    const key = `expiry-${createHash("sha256").update(ids.join(",")).digest("hex").slice(0, 40)}`;
    const list = jobs.map((j) => ({ name: j.template_name, until: j.expires_at, url: `${appUrl()}/videos/${j.id}` }));
    try {
      await send(messages.videosExpiring(jobs[0].email, site.brandName, list), key);
      db.prepare(`UPDATE jobs SET expiry_notice_status = 'sent', expiry_notice_sent_at = datetime('now') WHERE id IN (${ids.map(() => "?").join(",")})`).run(...ids);
      sent += ids.length;
    } catch (e) {
      db.prepare(`UPDATE jobs SET expiry_notice_status = CASE WHEN expiry_notice_attempts >= 3 THEN 'failed' ELSE NULL END
        WHERE id IN (${ids.map(() => "?").join(",")})`).run(...ids);
      failed += ids.length;
      console.error(`retention: expiry email for ${ids.length} video(s) not sent: ${String((e as Error).message).slice(0, 160)}`);
    }
  }
  return { sent, failed };
}

/** What exists and when it falls due. Changes nothing (except giving old videos their grace-period dates). */
export function inventory() {
  const migrated = migrateExpiryDates();
  const c = (sql: string, ...a: unknown[]) => (db.prepare(sql).get(...(a as any[])) as Row).n as number;
  return {
    migratedExpiryDates: migrated,
    videosStored: c("SELECT COUNT(*) AS n FROM jobs WHERE status = 'completed' AND media_deleted_at IS NULL"),
    videosWithGraceDate: c("SELECT COUNT(*) AS n FROM jobs WHERE expiry_grace = 1 AND media_deleted_at IS NULL"),
    videosDueNow: c("SELECT COUNT(*) AS n FROM jobs WHERE status = 'completed' AND media_deleted_at IS NULL AND expires_at <= datetime('now')"),
    videosDueIn30Days: c("SELECT COUNT(*) AS n FROM jobs WHERE status = 'completed' AND media_deleted_at IS NULL AND expires_at <= datetime('now', '+30 days')"),
    accountsWithVideos: c("SELECT COUNT(DISTINCT user_id) AS n FROM jobs WHERE status = 'completed' AND media_deleted_at IS NULL"),
    sourceCopiesDue: c(`SELECT COUNT(*) AS n FROM jobs WHERE status IN ('completed','failed') AND source_deleted_at IS NULL AND COALESCE(finished_at, created_at) <= datetime('now', '-${retention.sourcePhotoDays} days')`),
    activeJobs: c(`SELECT COUNT(*) AS n FROM jobs WHERE status IN (${ACTIVE_SQL})`),
    unverifiedAccounts: c("SELECT COUNT(*) AS n FROM users WHERE email_verified_at IS NULL AND deleted_at IS NULL"),
    restrictedAccounts: c("SELECT COUNT(*) AS n FROM users WHERE age_restricted_at IS NOT NULL AND deleted_at IS NULL"),
    mediaMode: mediaMode(),
  };
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startRetention(): void {
  const run = () => runRetention().then((r) => {
    const changed = Object.entries(r).filter(([k, v]) => k !== "mode" && v);
    if (changed.length) console.log(`retention (${r.mode} for media): ${changed.map(([k, v]) => `${k} ${v}`).join(", ")}`);
    if (r.failures) console.error(`retention: ${r.failures} item(s) could not be deleted and will be retried`);
  }).catch((e) => console.error(`retention run failed: ${String(e?.message ?? e).slice(0, 200)}`));
  void run();
  timer ??= setInterval(run, 3600_000);
  timer.unref();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (arg === "--inventory") console.log(JSON.stringify(inventory(), null, 2));
  else if (arg === "--dry-run" || arg === "--enforce") {
    runRetention({ media: arg === "--enforce" ? "enforce" : "dry-run" }).then((r) => console.log(JSON.stringify(r, null, 2)));
  } else console.log("Usage: npm run retention -- --inventory | --dry-run | --enforce");
}
