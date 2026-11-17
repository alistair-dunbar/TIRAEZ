# Data retention: rules, jobs and the switch-over

Approved defaults from 17 November 2026, as set in `config/retention.json` and applied by `app/retention.ts`.

## Rules and their clocks (server time throughout)

| Data | Rule | Clock starts | Mode |
|---|---|---|---|
| Generated videos and thumbnails | deleted 90 days after successful generation | completion (`jobs.expires_at`, set by the server when the video is saved; no client can change it) | dry-run until `RETENTION_MEDIA=enforce` |
| Video details (inputs, framing, built instructions, provider links) | cleared with the video | as above | as above |
| Per-job cropped source copy | deleted 7 days after that job's final state | `finished_at` (completed or failed) | as above |
| Uploaded photo used by jobs | deleted 7 days after the **last** job using it ended. Never while any job using it is active. The row stays with `deleted_at` (jobs refer to it); the file goes | latest `finished_at` among its jobs | as above |
| Failed jobs' details | cleared with their source copy | as above | as above |
| Abandoned uploads (never used) | deleted 7 days after upload | `photos.created_at` | always on (this rule already existed) |
| Unverified accounts | deleted 30 days after creation, unless something was bought. Resending a link doesn't move the clock | `users.created_at` | always on |
| Restricted (declared under 18) | deleted 30 days after restriction unless a review lifts it. Purchase rows stay anonymised for the refund | `users.age_restricted_at` | always on |
| Password reset links | expire 1 hour after issue, or on first use (checked at use). Records deleted 7 days after expiry | `email_tokens.expires_at` | always on |
| Sessions | deleted at expiry | `sessions.expires_at` | always on |
| Stuck jobs (active for over 24 hours with nothing working on them) | failed, with their credits returned | `jobs.created_at` | always on |
| Payment, refund and credit records | **not touched** by any of the above | — | — |

Videos keep a minimal record after expiry: template, format, dates and credits used. My videos then shows "File deleted on [date]".

The credit ledger refers to job ids, which are never reused, so transaction references stay unique.

## The job

- **When it runs:** on server start-up, then every hour, so it runs at least daily. It's never triggered by a browser. Runs never overlap.
- **How it deletes:**
  - It works in batches of 200, up to 25 per category per run.
  - A row is only marked deleted after its files are confirmed gone.
  - A file that can't be deleted is counted under `failures`, logged and retried on the next run.
- **Audit:** each run adds a row to `retention_runs` with the mode and counts per category, and nothing personal.
- **Expiry reminders:**
  - Seven days before expiry, each customer gets one email listing their affected videos. In-app notices appear at the same time.
  - Before sending, the job claims the videos. They're marked "sent" only after the email provider accepts the message.
  - A failed send is retried up to 3 times with the same idempotency key, so a retry can't produce a second email.
  - Emails go out only when `RETENTION_MEDIA=enforce` and email is configured. In dry-run nothing will be deleted, so no deletion is announced.

## Commands (run on Railway with `node app/retention.ts …`, locally with `npm run retention -- …`)

- `--inventory` lists what is stored and when it falls due. It changes nothing, except giving pre-existing videos their grace dates (below).
- `--dry-run` does one run that reports what would be deleted, without deleting media.
- `--enforce` does one run with the media rules applied.

## Switching on the media rules (existing data)

Videos made before 17 Nov 2026 have no expiry date. The first run gives each one this date: **completion + 90 days, but never earlier than 30 days from the migration**. They're flagged `expiry_grace = 1`, so their owners get the 7-day reminder and at least 30 days to download. Nothing is deleted at that point.

1. On Railway, run `node app/retention.ts --inventory` and keep the output. It shows:
   - the videos stored;
   - those given a grace date;
   - those due within 30 days;
   - the accounts affected;
   - the source copies already past 7 days.
2. Run `node app/retention.ts --dry-run`, and compare the counts with what customers were previously told. No policy was published before these rules, so there's no earlier promise to conflict with. Check this against any messages you've sent customers.
3. Make sure account email works. The reminder needs it, as well as the in-app notice.
4. Set `RETENTION_MEDIA=enforce` in Railway Variables and redeploy. From then on, videos past their date are deleted daily, and reminders go out 7 days before.

User-requested deletions (a video, or a whole account) never wait for this switch: they take effect straight away.

## Limits to know about

- **fal.** We ask fal to expire uploaded and generated files after 24 hours, and not to keep requests in its history. We can't verify fal's deletion from our side, and we don't promise fal follows our 90-day schedule.
- **No downstream deletion call.** There's no documented fal API for deleting a file early that we've verified, so none is called.
- **Railway backups.** Railway states it backs up customer data daily, and volume backups (if switched on in the dashboard) are kept for up to 6 days (daily), 27 days (weekly) or 89 days (monthly).
  - If a backup is ever restored, the next run deletes again everything past its date.
  - Videos or accounts that a customer deleted themselves aren't time-based, so they could reappear. Before restoring a backup, export the list of deleted job and account ids from the current database, and delete them again after the restore.
  - Keep volume backups off, or short, unless you need them.
- **Logs.** Railway keeps logs for its own period. The app doesn't log prompts, customer text, email links or passwords.
