// SQLite storage using Node's built-in node:sqlite (no dependency).
// DB_PATH can point tests at a throwaway file or ":memory:".
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const path = process.env.DB_PATH ?? "data/app.db";
if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

export const db = new DatabaseSync(path);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL
  );

  -- Every change to a credit balance, so balances can always be explained.
  CREATE TABLE IF NOT EXISTS credit_events (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,          -- purchase | video | refund
    ref TEXT,                      -- purchase id or video id
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    pack_id TEXT NOT NULL,
    credits INTEGER NOT NULL,
    price_sar INTEGER NOT NULL,
    provider TEXT NOT NULL,
    provider_ref TEXT,
    status TEXT NOT NULL,          -- pending | paid | failed
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- A customer's photo after upload: re-encoded upright, metadata (including location) removed.
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    file TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- One generation request. Everything needed to explain, retry or recover it is stored here.
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    client_key TEXT NOT NULL,
    template_id TEXT NOT NULL,
    template_version INTEGER NOT NULL,
    template_name TEXT NOT NULL,
    photo_id TEXT NOT NULL REFERENCES photos(id),
    crop TEXT NOT NULL,                 -- JSON {x,y,w,h} in photo pixels
    inputs TEXT NOT NULL,               -- JSON, validated customer inputs
    settings TEXT NOT NULL,             -- JSON {aspectRatio,duration,resolution}
    prompt TEXT NOT NULL,               -- assembled server-side, never sent to the browser
    model TEXT NOT NULL,
    credits INTEGER NOT NULL,
    status TEXT NOT NULL,               -- queued | uploading | submitting | in_queue | in_progress | saving | completed | failed
    provider TEXT NOT NULL,
    provider_request_id TEXT,
    provider_status_url TEXT,
    provider_response_url TEXT,
    provider_input_url TEXT,
    provider_output_url TEXT,
    submit_attempts INTEGER NOT NULL DEFAULT 0,
    source_file TEXT,                   -- the cropped image actually sent
    output_file TEXT,
    poster_file TEXT,
    output_meta TEXT,                   -- JSON {width,height,duration,bytes}
    check_failures INTEGER NOT NULL DEFAULT 0,
    last_check_ok_at TEXT,
    failure_code TEXT,
    failure_detail TEXT,                -- internal only
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    submitted_at TEXT,
    finished_at TEXT,
    UNIQUE (user_id, client_key)
  );

  -- Estimated provider spend, for the optional GENERATION_BUDGET_USD safety cap.
  CREATE TABLE IF NOT EXISTS provider_spend (
    id INTEGER PRIMARY KEY,
    job_id INTEGER NOT NULL,
    usd REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Columns added after launch. Existing databases get them on start-up; nothing is renamed or dropped.
const ADDED_USER_COLUMNS: Record<string, string> = {
  name: "TEXT",
  age_confirmed_at: "TEXT",        // when the person told us they are 18 or over (the age itself is never stored)
  age_method: "TEXT",              // how: 'self_declared'
  terms_version: "TEXT",           // the Terms of Service version they agreed to
  terms_accepted_at: "TEXT",
  privacy_version_seen: "TEXT",    // the Privacy Policy version shown when they agreed (a notice, not a consent)
  suspended_at: "TEXT",
  suspended_reason: "TEXT",
  deleted_at: "TEXT",              // set when an account is deleted; personal fields are cleared at the same time
  email_verified_at: "TEXT",       // when the person proved they control the email address
  age_restricted_at: "TEXT",       // an existing account declared an age under 18: uploads and generation stop
  age_restriction_lifted_at: "TEXT", // a reviewed correction (see reports.ts), with the note in consent_events
  pending_email: "TEXT",           // a requested new email, until its confirmation link is used
};
const have = new Set((db.prepare("PRAGMA table_info(users)").all() as any[]).map((c) => c.name));
for (const [col, type] of Object.entries(ADDED_USER_COLUMNS)) {
  if (!have.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
}

db.exec(`
  -- What each person agreed to or confirmed, and when (server time). Deleted with the account.
  CREATE TABLE IF NOT EXISTS consent_events (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,            -- terms_accepted | age_confirmed | privacy_notice_shown
    version TEXT,                  -- document version, for terms and privacy
    source TEXT NOT NULL,          -- signup | onboarding
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS consent_events_user ON consent_events(user_id);

  -- Reports of misuse or problems, from the report form. Reviewed with npm run reports.
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    contact_email TEXT,
    kind TEXT NOT NULL,
    target TEXT,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',   -- open | closed
    outcome TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT
  );

  -- Single-use links sent by email. Only a hash of each token is stored.
  CREATE TABLE IF NOT EXISTS email_tokens (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,            -- verify | reset | email_change
    token_hash TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,           -- the address the link was sent to
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS email_tokens_user ON email_tokens(user_id);

  -- Requests to refund a purchase, reviewed by the founders (npm run refunds).
  CREATE TABLE IF NOT EXISTS refund_requests (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    purchase_id INTEGER NOT NULL REFERENCES purchases(id),
    reason TEXT NOT NULL,          -- customer | age_restriction
    details TEXT,
    status TEXT NOT NULL DEFAULT 'open',   -- open | approved | declined
    decision_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_one_open ON refund_requests(purchase_id) WHERE status = 'open';

  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS jobs_user ON jobs(user_id);
  CREATE INDEX IF NOT EXISTS photos_user ON photos(user_id);
`);

// Purchases gain refund fields; the ledger gets a guard so no balance change can be recorded twice.
const purchaseCols = new Set((db.prepare("PRAGMA table_info(purchases)").all() as any[]).map((c) => c.name));
for (const [col, type] of Object.entries({ refunded_at: "TEXT", refunded_credits: "INTEGER", refund_note: "TEXT", refund_provider_ref: "TEXT" })) {
  if (!purchaseCols.has(col)) db.exec(`ALTER TABLE purchases ADD COLUMN ${col} ${type}`);
}
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS credit_events_once ON credit_events(reason, ref)
    WHERE reason IN ('purchase', 'video', 'refund', 'consume', 'purchase_refund')`);
} catch (e) {
  console.error(`credit_events_once index not created (existing duplicate rows?): ${(e as Error).message}`);
}

/** Runs fn inside a transaction; rolls back if it throws. */
export function tx<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
