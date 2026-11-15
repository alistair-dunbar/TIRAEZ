// Orders: one credit per video, taken when the order is placed and refunded if it fails.
// Jobs run one at a time in this process; a real queue can replace `enqueue` later.
import { mkdirSync, readFileSync } from "node:fs";
import { UserError } from "./auth.ts";
import { refundVideo, spendForVideo } from "./credits.ts";
import { db, tx } from "./db.ts";
import { engine, type CatalogTemplate } from "./engine/index.ts";

export const DATA_DIR = process.env.DATA_DIR ?? "data";
mkdirSync(`${DATA_DIR}/videos`, { recursive: true });
mkdirSync(`${DATA_DIR}/uploads`, { recursive: true });

export const catalog: CatalogTemplate[] =
  JSON.parse(readFileSync(new URL("../catalog/templates.json", import.meta.url), "utf8"));

export function createVideo(userId: number, templateId: string, uploadId?: string): number {
  const template = catalog.find((t) => t.id === templateId);
  if (!template) throw new UserError("unknown_template", 404);
  if (uploadId && !db.prepare("SELECT 1 FROM uploads WHERE id = ? AND user_id = ?").get(uploadId, userId)) {
    throw new UserError("unknown_upload", 404);
  }
  const id = tx(() => {
    const vid = Number(db.prepare(
      "INSERT INTO videos (user_id, template_id, upload_id, status) VALUES (?, ?, ?, 'queued')")
      .run(userId, templateId, uploadId ?? null).lastInsertRowid);
    spendForVideo(userId, vid); // throws no_credits -> the insert is rolled back
    return vid;
  });
  enqueue(id);
  return id;
}

let chain: Promise<void> = Promise.resolve();
function enqueue(videoId: number): void {
  chain = chain.then(() => run(videoId)).catch((e) => console.error("queue error", e));
}

/** Resolves when every queued job has finished (used by tests). */
export const idle = () => chain;

async function run(videoId: number): Promise<void> {
  const v = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId) as any;
  if (!v || v.status !== "queued") return;
  db.prepare("UPDATE videos SET status = 'processing' WHERE id = ?").run(videoId);
  const out = `${DATA_DIR}/videos/${videoId}.mp4`;
  try {
    const upload = v.upload_id
      ? (db.prepare("SELECT file, mime FROM uploads WHERE id = ?").get(v.upload_id) as any)
      : undefined;
    await engine().generate({ videoId, template: catalog.find((t) => t.id === v.template_id)!, upload, out });
    db.prepare("UPDATE videos SET status = 'done', file = ?, finished_at = datetime('now') WHERE id = ?").run(out, videoId);
  } catch (e) {
    console.error(`video ${videoId} failed:`, e);
    // The customer sees a generic failure; the real error stays in the server log and the row.
    db.prepare("UPDATE videos SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?")
      .run(String((e as Error).message).slice(0, 500), videoId);
    refundVideo(v.user_id, videoId);
  }
}

/** Jobs that were waiting or running when the server stopped can't be resumed: fail and refund them. */
export function recoverInterrupted(): number {
  const stuck = db.prepare("SELECT id, user_id FROM videos WHERE status IN ('queued', 'processing')").all() as any[];
  for (const v of stuck) {
    db.prepare("UPDATE videos SET status = 'failed', error = 'server restarted', finished_at = datetime('now') WHERE id = ?").run(v.id);
    refundVideo(v.user_id, v.id);
  }
  return stuck.length;
}

export function listVideos(userId: number) {
  return db.prepare(
    "SELECT id, template_id AS templateId, status, created_at AS createdAt FROM videos WHERE user_id = ? ORDER BY id DESC LIMIT 100")
    .all(userId);
}

export function videoFile(userId: number, videoId: number): string | null {
  const v = db.prepare("SELECT file FROM videos WHERE id = ? AND user_id = ? AND status = 'done'").get(videoId, userId) as any;
  return v?.file ?? null;
}
