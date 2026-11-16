// Customer photo uploads: checked by content, turned upright, stripped of metadata, stored per user.
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { UserError } from "./auth.ts";
import { generation } from "./config.ts";
import { db } from "./db.ts";
import { jpegOrientation, normalisePhoto, probe, sniffImage } from "./media.ts";

export const DATA_DIR = process.env.DATA_DIR ?? "data";
mkdirSync(`${DATA_DIR}/photos`, { recursive: true });

export interface Photo { id: string; width: number; height: number; bytes: number }

export async function savePhoto(userId: number, buf: Buffer): Promise<Photo> {
  if (buf.length === 0) throw new UserError("empty_file");
  if (buf.length > generation.upload.maxBytes) throw new UserError("too_large", 413);
  const kind = sniffImage(buf);
  if (kind === "heic") throw new UserError("heic_not_supported", 415);
  if (!kind) throw new UserError("not_an_image", 415);

  const id = randomBytes(12).toString("hex");
  const raw = `${DATA_DIR}/photos/${id}.upload`;
  const file = `${DATA_DIR}/photos/${id}.jpg`;
  writeFileSync(raw, buf);
  try {
    const original = await probe(raw).catch(() => { throw new UserError("unreadable_image", 415); });
    // Checked before scaling down, so a small photo is refused rather than quietly accepted.
    if (Math.min(original.width, original.height) < generation.upload.minShortSide) throw new UserError("image_too_small", 422);
    const orientation = kind === "jpeg" ? jpegOrientation(buf) : 1;
    const { width, height } = await normalisePhoto(raw, kind, file, generation.upload.maxLongSide, orientation)
      .catch(() => { throw new UserError("unreadable_image", 415); });
    const bytes = statSync(file).size;
    db.prepare("INSERT INTO photos (id, user_id, file, width, height, bytes) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, userId, file, width, height, bytes);
    return { id, width, height, bytes };
  } finally {
    rmSync(raw, { force: true });
  }
}

export function photoFor(userId: number, id: string): { file: string; width: number; height: number } | null {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  return (db.prepare("SELECT file, width, height FROM photos WHERE id = ? AND user_id = ?").get(id, userId) as any) ?? null;
}
