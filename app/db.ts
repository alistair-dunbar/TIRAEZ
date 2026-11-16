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
