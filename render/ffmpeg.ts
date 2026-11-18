// All image/video work is done with the system ffmpeg binary.
import { spawn } from "node:child_process";

export const W = 1080;
export const H = 1920;
export const SECONDS = 5;
export const FPS = 30;

export function ffmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-y", ...args]);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve(err) : reject(new Error(`ffmpeg failed (${code}):\n${err.slice(-1500)}`)),
    );
  });
}

const VIDEO_OUT = ["-t", String(SECONDS), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium",
  "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart"];

/** Downscale so the longest side is at most `max` px. Keeps the photo otherwise untouched. */
export async function prepPhoto(input: string, out: string, max = 2048): Promise<void> {
  await ffmpeg(["-i", input, "-vf",
    `scale='if(gt(iw,ih),min(${max},iw),-2)':'if(gt(iw,ih),-2,min(${max},ih))'`,
    "-frames:v", "1", out]);
}

export interface Box { w: number; h: number; x: number; y: number }

/** Bounding box of the non-transparent area of a PNG. */
export async function alphaBox(png: string): Promise<Box> {
  const log = await ffmpeg(["-loop", "1", "-i", png, "-frames:v", "3", "-vf",
    "alphaextract,cropdetect=limit=24:round=2:reset=0", "-f", "null", "-"]);
  const m = [...log.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].pop();
  if (!m) throw new Error(`Could not find the product outline in ${png}`);
  const [w, h, x, y] = m.slice(1).map(Number);
  if (w < 20 || h < 20) throw new Error(`Cutout is nearly empty (${w}x${h}); background removal failed`);
  return { w, h, x, y };
}

/** Which edge(s) of the photo the product touches, i.e. it is probably cut off. Empty string if none. */
export async function touchesEdge(png: string): Promise<string> {
  const log = await ffmpeg(["-i", png, "-frames:v", "1", "-f", "null", "-"]);
  const size = log.match(/, (\d{2,5})x(\d{2,5})/);
  if (!size) return "";
  const [iw, ih] = [Number(size[1]), Number(size[2])];
  const b = await alphaBox(png);
  const m = 3;
  return [b.y <= m && "top", b.x <= m && "left", b.x + b.w >= iw - m && "right", b.y + b.h >= ih - m && "bottom"]
    .filter(Boolean).join("/");
}

export interface Placement {
  /** Centre of the product, as a fraction of frame width. */
  x: number;
  /** Where the product's base sits (top of the pedestal), as a fraction of frame height. */
  baseY: number;
  /** Largest product size, as fractions of frame width/height. */
  maxW: number;
  maxH: number;
  /** Gentle float amplitude in px (0 = static). */
  float: number;
  /**
   * Optional light match so the product sits in the scene's lighting. Applied evenly to
   * the whole product (like a photo filter): nothing is redrawn and the label stays as it is.
   */
  grade?: { brightness: number; contrast: number; warmth: number };
}

/**
 * Lay the unchanged product cut-out on the scene clip, with a soft contact shadow.
 * The product is only cropped, resized and moved.
 */
export async function composite(scene: string, cutout: string, p: Placement, out: string): Promise<void> {
  const box = await alphaBox(cutout);
  const scale = Math.min((p.maxW * W) / box.w, (p.maxH * H) / box.h);
  const pw = 2 * Math.round((box.w * scale) / 2);
  const ph = 2 * Math.round((box.h * scale) / 2);
  const cx = Math.round(p.x * W);
  const baseY = Math.round(p.baseY * H);
  const shW = Math.round(pw * 1.15);
  const shH = Math.max(8, Math.round(pw * 0.12));
  const pad = 60;
  const g = p.grade;
  const grade = g
    ? `,eq=brightness=${g.brightness}:contrast=${g.contrast},colorbalance=rm=${g.warmth}:bm=${-g.warmth}:rh=${g.warmth / 2}:bh=${-g.warmth / 2}`
    : "";

  const filter = [
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1[bg]`,
    `[1:v]crop=${box.w}:${box.h}:${box.x}:${box.y},scale=${pw}:${ph}:flags=lanczos,format=rgba,split[prodraw][forshadow]`,
    `[prodraw]format=gbrap${grade},format=rgba[prod]`,
    // Shadow: the product silhouette, blackened, squashed flat and blurred.
    `[forshadow]colorchannelmixer=rr=0:gg=0:bb=0:aa=0.6,scale=${shW}:${shH},` +
      `pad=${shW + 2 * pad}:${shH + 2 * pad}:${pad}:${pad}:color=black@0,boxblur=14:3[shadow]`,
    `[bg][shadow]overlay=x=${cx - Math.round(shW / 2) - pad}:y=${baseY - Math.round(shH / 2) - pad}[bgs]`,
    `[bgs][prod]overlay=x=${cx - pw / 2}:y='${baseY - ph}-${p.float}*(1-cos(2*PI*t/${SECONDS}))/2':eval=frame[v]`,
  ].join(";");

  await ffmpeg(["-stream_loop", "-1", "-i", scene, "-loop", "1", "-i", cutout,
    "-filter_complex", filter, "-map", "[v]", ...VIDEO_OUT, out]);
}

/**
 * Real estate: slow drift across the centre of the photo (no cut-out, no AI).
 * Travel is capped so a wide photo doesn't pan off the building onto its edges.
 */
export async function pan(photo: string, out: string): Promise<void> {
  const over = 1.08; // a little extra so there is always room to move
  const travelX = `min(iw-${W},${Math.round(W * 0.25)})`;
  const travelY = `min(ih-${H},${Math.round(H * 0.05)})`;
  const filter = [
    `[0:v]scale='if(gt(a,${W}/${H}),-2,${Math.round(W * over)})':'if(gt(a,${W}/${H}),${Math.round(H * over)},-2)':flags=lanczos`,
    `crop=${W}:${H}:x='(iw-${W})/2-${travelX}/2+${travelX}*t/${SECONDS}':y='(ih-${H})/2+${travelY}/2-${travelY}*t/${SECONDS}'`,
    `fps=${FPS},setsar=1[v]`,
  ].join(",");
  await ffmpeg(["-loop", "1", "-i", photo, "-filter_complex", filter, "-map", "[v]", ...VIDEO_OUT, out]);
}

/** A single frame, for checking scenes and outputs by eye. */
export async function frame(video: string, at: number, out: string): Promise<void> {
  await ffmpeg(["-ss", String(at), "-i", video, "-frames:v", "1", out]);
}
