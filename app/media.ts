// Image and video handling with the system ffmpeg/ffprobe (no npm dependency).
import { spawn } from "node:child_process";

function run(cmd: string, args: string[]): Promise<{ out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve({ out, err }) : reject(new Error(`${cmd} failed (${code}): ${err.slice(-600)}`))));
  });
}
const ffmpeg = (args: string[]) => run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);

export type ImageKind = "jpeg" | "png" | "webp" | "heic" | null;

/** The real file type from its first bytes. The file name and the browser's claim are ignored. */
export function sniffImage(b: Buffer): ImageKind {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (b.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|hevc|mif1|msf1|heim|heis)$/.test(b.subarray(8, 12).toString("latin1"))) return "heic";
  return null;
}

/** EXIF orientation (1-8) of a JPEG, or 1 when absent. Phones store rotation here instead of in the pixels. */
export function jpegOrientation(b: Buffer): number {
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker === 0xe1 && b.subarray(i + 4, i + 10).toString("latin1") === "Exif\0\0") {
      const t = i + 10;
      const le = b.subarray(t, t + 2).toString("latin1") === "II";
      const u16 = (o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
      const u32 = (o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
      try {
        const ifd = t + u32(t + 4);
        const n = u16(ifd);
        for (let k = 0; k < n; k++) {
          const e = ifd + 2 + k * 12;
          if (u16(e) === 0x0112) { const v = u16(e + 8); return v >= 1 && v <= 8 ? v : 1; }
        }
      } catch { return 1; }
      return 1;
    }
    if (marker === 0xda) break; // start of image data: no EXIF before it
    i += 2 + len;
  }
  return 1;
}

const ORIENT_FILTER: Record<number, string> = {
  1: "", 2: "hflip", 3: "hflip,vflip", 4: "vflip", 5: "transpose=0", 6: "transpose=1", 7: "transpose=3", 8: "transpose=2",
};

export async function probe(file: string): Promise<{ width: number; height: number; duration: number | null }> {
  const { out } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
    "stream=width,height:format=duration", "-of", "json", file]);
  const j = JSON.parse(out);
  const s = j.streams?.[0];
  if (!s?.width || !s?.height) throw new Error("no picture found");
  const d = Number(j.format?.duration);
  return { width: s.width, height: s.height, duration: Number.isFinite(d) ? d : null };
}

/**
 * Re-encodes an uploaded photo: turned upright, scaled down to maxLongSide, saved as JPEG with
 * all metadata (camera, location) removed. Returns the new size.
 */
export async function normalisePhoto(input: string, kind: ImageKind, output: string, maxLongSide: number, orientation: number) {
  const filters = [ORIENT_FILTER[orientation] || "", `scale='if(gt(iw,ih),min(${maxLongSide},iw),-2)':'if(gt(iw,ih),-2,min(${maxLongSide},ih))'`]
    .filter(Boolean).join(",");
  // -noautorotate: we apply the EXIF rotation ourselves, exactly once.
  await ffmpeg(["-noautorotate", "-i", input, "-vf", `${filters},format=yuvj444p`, "-map_metadata", "-1", "-frames:v", "1", "-q:v", "2", output]);
  return probe(output);
}

/** Crops a normalised photo to the customer's frame. The crop is never chosen silently. */
export async function cropPhoto(input: string, crop: { x: number; y: number; w: number; h: number }, output: string, maxLongSide: number) {
  const scale = `scale='if(gt(iw,ih),min(${maxLongSide},iw),-2)':'if(gt(iw,ih),-2,min(${maxLongSide},ih))'`;
  await ffmpeg(["-i", input, "-vf", `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},${scale}`, "-map_metadata", "-1", "-frames:v", "1", "-q:v", "2", output]);
  return probe(output);
}

/** A still from the finished video, for lists and the player's poster. */
export async function posterFrame(video: string, output: string): Promise<void> {
  await ffmpeg(["-ss", "0.5", "-i", video, "-frames:v", "1", "-vf", "scale='min(720,iw)':-2", "-q:v", "3", output]);
}

/** Test helper: a short synthetic clip made from ffmpeg's built-in test pattern. */
export async function testClip(output: string, w: number, h: number, seconds: number): Promise<void> {
  await ffmpeg(["-f", "lavfi", "-i", `testsrc2=size=${w}x${h}:rate=24:duration=${seconds}`, "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "ultrafast", output]);
}
