// Account controls: download your data, delete a video, delete your account, and the retention job.
// Deleting means deleting: rows are removed and files are unlinked. The only things kept after an
// account is deleted are purchase records (with the account reduced to an id), because payments
// may have to be accounted for; config/legal.json says how long once the founders confirm it.
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { UserError, checkPassword, type User } from "./auth.ts";
import { db, tx } from "./db.ts";
import { retention } from "./legal.ts";
import { DATA_DIR } from "./photos.ts";
import { requestRefund, creditSummary, purchasesFor } from "./credits.ts";
import { cancelQueuedJobs } from "./jobs.ts";

const ACTIVE = ["queued", "uploading", "submitting", "in_queue", "in_progress", "saving"];
type Row = Record<string, any>;

function removeFiles(files: (string | null | undefined)[]): void {
  for (const f of files) if (f) rmSync(f, { force: true });
}

const jobFiles = (j: Row) => [j.source_file, j.output_file, j.poster_file, `${DATA_DIR}/jobs/${j.id}.mp4.part`];

/** The facts the account page shows. */
export function accountSummary(u: User) {
  const r = db.prepare("SELECT created_at, age_confirmed_at, terms_version, terms_accepted_at FROM users WHERE id = ?").get(u.id) as Row;
  const count = (sql: string, ...a: unknown[]) => (db.prepare(sql).get(u.id, ...(a as any[])) as Row).n as number;
  return {
    createdAt: r.created_at,
    ageConfirmedAt: r.age_confirmed_at,
    termsVersion: r.terms_version,
    termsAcceptedAt: r.terms_accepted_at,
    sessions: count("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > datetime('now')"),
    videos: count("SELECT COUNT(*) AS n FROM jobs WHERE user_id = ?"),
    activeVideos: count(`SELECT COUNT(*) AS n FROM jobs WHERE user_id = ? AND status IN (${ACTIVE.map(() => "?").join(",")})`, ...ACTIVE),
    purchases: count("SELECT COUNT(*) AS n FROM purchases WHERE user_id = ? AND status = 'paid'"),
    ageRestrictedAt: (db.prepare("SELECT age_restricted_at FROM users WHERE id = ?").get(u.id) as Row).age_restricted_at,
    credits: creditSummary(u.id),
    purchaseList: purchasesFor(u.id),
  };
}

// ---------------------------------------------------------------------------------------------
// Download your data

export function exportData(u: User) {
  const user = db.prepare(`SELECT id, email, name, credits, created_at, age_confirmed_at, age_method,
      terms_version, terms_accepted_at, privacy_version_seen, email_verified_at, pending_email FROM users WHERE id = ?`).get(u.id) as Row;
  const jobs = db.prepare("SELECT * FROM jobs WHERE user_id = ? ORDER BY id").all(u.id) as Row[];
  return {
    exportedAt: new Date().toISOString(),
    notes: [
      "This file holds the personal data your account has with us. Your photos and videos are listed with links; open the links while logged in to download them.",
      "Your age is not included because we never stored it: we only keep that you confirmed you are 18 or over, and when.",
      "The full instructions we build for the video model are not included; your own inputs to them are.",
    ],
    account: {
      email: user.email, name: user.name, createdAt: user.created_at, credits: user.credits,
      emailConfirmedAt: user.email_verified_at, pendingEmail: user.pending_email,
      eligibility: { confirmedAdultAt: user.age_confirmed_at, method: user.age_method },
      terms: { version: user.terms_version, acceptedAt: user.terms_accepted_at, privacyPolicyVersionShown: user.privacy_version_seen },
    },
    agreements: db.prepare("SELECT kind, version, source, created_at AS at FROM consent_events WHERE user_id = ? ORDER BY id").all(u.id),
    credits: db.prepare("SELECT delta, reason, ref, created_at AS at FROM credit_events WHERE user_id = ? ORDER BY id").all(u.id),
    purchases: db.prepare("SELECT id, pack_id AS pack, credits, price_sar AS priceSar, provider, provider_ref AS providerRef, status, created_at AS at FROM purchases WHERE user_id = ? ORDER BY id").all(u.id),
    photos: (db.prepare("SELECT id, width, height, bytes, created_at FROM photos WHERE user_id = ? ORDER BY created_at").all(u.id) as Row[])
      .map((p) => ({ id: p.id, width: p.width, height: p.height, bytes: p.bytes, uploadedAt: p.created_at, link: `/api/photos/${p.id}.jpg` })),
    videos: jobs.map((j) => ({
      id: j.id, template: j.template_name, templateVersion: j.template_version, photo: j.photo_id,
      framing: JSON.parse(j.crop), details: JSON.parse(j.inputs), settings: JSON.parse(j.settings),
      credits: j.credits, status: j.status, failure: j.failure_code, createdAt: j.created_at, finishedAt: j.finished_at,
      link: j.output_file && existsSync(j.output_file) ? `/api/jobs/${j.id}/video.mp4` : null,
    })),
    reports: db.prepare("SELECT kind, target, details, status, created_at AS at FROM reports WHERE user_id = ? ORDER BY id").all(u.id),
    creditSummary: creditSummary(u.id),
    refundRequests: db.prepare("SELECT purchase_id AS purchase, reason, details, status, decision_note AS decision, created_at AS at, decided_at AS decidedAt FROM refund_requests WHERE user_id = ? ORDER BY id").all(u.id),
  };
}

// ---------------------------------------------------------------------------------------------
// Delete one video

/** Deletes a finished or failed video: its files, its record, and its photo if nothing else uses it. */
export function deleteVideo(u: User, jobId: number): void {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?").get(jobId, u.id) as Row | undefined;
  if (!job) throw new UserError("not_found", 404);
  if (ACTIVE.includes(job.status)) throw new UserError("job_active", 409);
  const photo = tx(() => {
    db.prepare("DELETE FROM jobs WHERE id = ?").run(job.id);
    const stillUsed = db.prepare("SELECT 1 FROM jobs WHERE photo_id = ?").get(job.photo_id);
    if (stillUsed) return null;
    const p = db.prepare("SELECT file FROM photos WHERE id = ?").get(job.photo_id) as Row | undefined;
    db.prepare("DELETE FROM photos WHERE id = ?").run(job.photo_id);
    return p?.file ?? null;
  });
  removeFiles([...jobFiles(job), photo]);
}

// ---------------------------------------------------------------------------------------------
// Delete the account

/**
 * An existing account declared an age under 18. Nothing is deleted on the spot (a typing mistake
 * shouldn't destroy someone's work): uploads, generation and purchases stop at once, videos not yet
 * sent to the model are cancelled with their credits returned, any paid purchase gets a refund request
 * for review, and the account is deleted after the retention period unless a reviewed correction lifts
 * the restriction first.
 */
export function restrictForAge(userId: number): void {
  tx(() => {
    db.prepare("UPDATE users SET age_restricted_at = datetime('now'), age_confirmed_at = NULL, age_method = NULL WHERE id = ? AND age_restricted_at IS NULL").run(userId);
    db.prepare("INSERT INTO consent_events (user_id, kind, source) VALUES (?, 'declared_under_18', 'onboarding')").run(userId);
    const paid = db.prepare("SELECT id FROM purchases WHERE user_id = ? AND status = 'paid'").all(userId) as Row[];
    for (const p of paid) requestRefund(userId, p.id, "Account restricted: declared under 18.", "age_restriction");
  });
  cancelQueuedJobs(userId, "cancelled");
}

/** Lifts an age restriction after review. The person must then confirm their age again. */
export function liftAgeRestriction(userId: number, note: string): boolean {
  return tx(() => {
    const r = db.prepare("UPDATE users SET age_restricted_at = NULL, age_restriction_lifted_at = datetime('now') WHERE id = ? AND age_restricted_at IS NOT NULL").run(userId);
    if (!r.changes) return false;
    db.prepare("INSERT INTO consent_events (user_id, kind, version, source) VALUES (?, 'age_restriction_lifted', ?, 'review')").run(userId, note.slice(0, 200));
    return true;
  });
}

export interface DeletionResult { purchaseRecordsKept: number }

/**
 * Removes everything personal now. With no purchases the account row is deleted outright; with
 * purchases, those rows stay attached to an anonymous account id with no name, email or password.
 */
export function eraseAccount(userId: number): DeletionResult {
  const jobs = db.prepare("SELECT * FROM jobs WHERE user_id = ?").all(userId) as Row[];
  const photos = db.prepare("SELECT file FROM photos WHERE user_id = ?").all(userId) as Row[];
  const kept = tx(() => {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM jobs WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM photos WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM consent_events WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM email_tokens WHERE user_id = ?").run(userId);
    db.prepare("UPDATE refund_requests SET details = NULL WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM credit_events WHERE user_id = ? AND reason != 'purchase'").run(userId);
    db.prepare("UPDATE reports SET user_id = NULL, contact_email = NULL WHERE user_id = ?").run(userId);
    db.prepare(`UPDATE users SET email = ?, password_hash = '', name = NULL, credits = 0, age_confirmed_at = NULL,
        age_method = NULL, terms_version = NULL, terms_accepted_at = NULL, privacy_version_seen = NULL,
        suspended_at = NULL, suspended_reason = NULL, email_verified_at = NULL, pending_email = NULL, age_restricted_at = NULL,
        deleted_at = datetime('now') WHERE id = ?`)
      .run(`deleted-${userId}@deleted.invalid`, userId);
    const purchases = (db.prepare("SELECT COUNT(*) AS n FROM purchases WHERE user_id = ?").get(userId) as Row).n as number;
    if (purchases === 0) {
      db.prepare("DELETE FROM credit_events WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM refund_requests WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
    return purchases;
  });
  removeFiles([...jobs.flatMap(jobFiles), ...photos.map((p) => p.file)]);
  return { purchaseRecordsKept: kept };
}

export function deleteAccount(u: User, password: unknown, confirm: unknown): DeletionResult {
  checkPassword(u.id, password);
  if (confirm !== "delete") throw new UserError("bad_request");
  // Videos not yet sent to the model are cancelled (credits returned). A video already with the model
  // can't be recalled and would come back after deletion, so deletion waits for it to finish.
  cancelQueuedJobs(u.id, "cancelled");
  const active = db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE user_id = ? AND status IN (${ACTIVE.map(() => "?").join(",")})`).get(u.id, ...ACTIVE) as Row;
  if (active.n > 0) throw new UserError("jobs_active", 409);
  return eraseAccount(u.id);
}

// Retention (time-based deletion) lives in app/retention.ts.
