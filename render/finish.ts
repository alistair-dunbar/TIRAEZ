// Finishing pass: makes a generated clip look less "AI" without generating anything.
// Costs nothing (ffmpeg only). Two parts:
//   1. Edit: cut one long shot into several shorter shots (cuts, punch-ins, speed changes).
//   2. Look: softer colour, less sharpness, lens imperfections, film grain, handheld shake.
//
//   npm run finish -- --video ads/coffee-machine.mp4 [--spec ads/coffee-machine.json]
//                     [--look looks/natural.json] [--out ads/coffee-machine-finished.mp4]
//
// The shots come from "edit.shots" in the spec; without a spec only the look is applied.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { H, W, ffmpeg } from "./ffmpeg.ts";

export interface Shot {
  /** Start and end in the source clip, in seconds. */
  from: number;
  to: number;
  /** Playback speed. Keep at 1 or above: slowing down 24 fps footage stutters. */
  speed?: number;
  /** Punch-in: 1 = full frame, 1.3 = 30% closer. */
  zoom?: number;
  /** What the punch-in centres on, as fractions of the frame (0.5/0.5 = centre). */
  focusX?: number;
  focusY?: number;
}

export interface Look {
  /** 1 = unchanged. AI footage is usually oversaturated; 0.85-0.9 looks more like a camera. */
  saturation: number;
  contrast: number;
  /** Raises the darkest tones (0-0.08) so blacks aren't unnaturally deep. */
  blackLift: number;
  /** Lowers the brightest tones (0.9-1) so highlights roll off like a real sensor. */
  whiteCeiling: number;
  /** Blur radius that takes the edge off AI over-sharpening (0 = off, 0.4-0.8 typical). */
  soften: number;
  /** Colour fringing at edges in px, like a real lens (0 = off). */
  fringe: number;
  /** Darker corners (0 = off, 0.2-0.5 typical). */
  vignette: number;
  /** Film grain strength (0 = off, 6-12 typical). */
  grain: number;
  /** Handheld camera wobble: travel in px and tilt in degrees (0 = off). */
  shakePx: number;
  shakeDegrees: number;
}

const n = (v: number) => Number(v.toFixed(4));

function shotFilter(s: Shot, i: number): string {
  const speed = s.speed ?? 1;
  const zoom = Math.max(1, s.zoom ?? 1);
  const fx = s.focusX ?? 0.5;
  const fy = s.focusY ?? 0.5;
  // Crop window of 1/zoom, placed so the focus point stays inside the frame.
  const crop = zoom > 1
    ? `crop=w=iw/${zoom}:h=ih/${zoom}:x='(iw-ow)*${n(fx)}':y='(ih-oh)*${n(fy)}',`
    : "";
  return `[0:v]trim=start=${s.from}:end=${s.to},setpts=(PTS-STARTPTS)/${speed},${crop}` +
    `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1[s${i}]`;
}

function lookFilter(l: Look): string {
  const f: string[] = [];
  if (l.shakePx > 0 || l.shakeDegrees > 0) {
    // Enlarge slightly, tilt and drift with slow overlapping waves, then crop back to size.
    // Several waves at unrelated speeds keep the motion from looking like a loop.
    const rad = (l.shakeDegrees * Math.PI) / 180;
    const margin = 1 + (2 * l.shakePx + 12) / W;
    f.push(`scale=${2 * Math.round((W * margin) / 2)}:-2:flags=lanczos`);
    if (rad > 0) f.push(`rotate=a='${n(rad)}*(0.6*sin(1.1*t)+0.4*sin(2.7*t+1.3))':fillcolor=black`);
    f.push(
      `crop=${W}:${H}:` +
        `x='(iw-${W})/2+${l.shakePx}*(0.6*sin(1.7*t)+0.3*sin(4.3*t+0.7)+0.1*sin(9.1*t))':` +
        `y='(ih-${H})/2+${l.shakePx}*(0.6*sin(1.3*t+2.1)+0.3*sin(3.7*t)+0.1*sin(8.3*t+1.1))'`,
    );
  }
  f.push(`eq=saturation=${l.saturation}:contrast=${l.contrast}`);
  f.push(`curves=all='0/${n(l.blackLift)} 0.5/0.5 1/${n(l.whiteCeiling)}'`);
  if (l.soften > 0) f.push(`gblur=sigma=${l.soften}`);
  if (l.fringe > 0) f.push(`rgbashift=rh=${-l.fringe}:bh=${l.fringe}`);
  if (l.vignette > 0) f.push(`vignette=angle=${n(l.vignette)}`);
  // Grain last, on brightness only and changing every frame, so it sits on top like sensor noise.
  if (l.grain > 0) f.push(`noise=c0s=${l.grain}:c0f=t+u`);
  f.push("format=yuv420p");
  return f.join(",");
}

export async function finish(video: string, out: string, look: Look, shots?: Shot[]): Promise<void> {
  const parts: string[] = [];
  let last = "[0:v]";
  if (shots?.length) {
    shots.forEach((s, i) => parts.push(shotFilter(s, i)));
    parts.push(`${shots.map((_, i) => `[s${i}]`).join("")}concat=n=${shots.length}:v=1:a=0[cut]`);
    last = "[cut]";
  } else {
    parts.push(`[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1[cut]`);
    last = "[cut]";
  }
  parts.push(`${last}${lookFilter(look)}[v]`);
  await ffmpeg(["-i", video, "-filter_complex", parts.join(";"), "-map", "[v]",
    // Grain is costly to store; the bitrate cap keeps files near 10 MB per 8 seconds,
    // in line with what TikTok and Instagram re-compress uploads to anyway.
    "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-maxrate", "10M", "-bufsize", "20M",
    "-an", "-movflags", "+faststart", out]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: { video: { type: "string" }, spec: { type: "string" }, look: { type: "string" }, out: { type: "string" } },
  });
  if (!values.video) throw new Error("Usage: npm run finish -- --video <file> [--spec ads/<id>.json] [--look looks/<name>.json] [--out <file>]");
  const look: Look = JSON.parse(readFileSync(values.look ?? "looks/natural.json", "utf8"));
  const shots: Shot[] | undefined = values.spec ? JSON.parse(readFileSync(values.spec, "utf8")).edit?.shots : undefined;
  const out = values.out ?? values.video.replace(/\.mp4$/, "-finished.mp4");
  await finish(values.video, out, look, shots);
  console.log(`Saved ${out}${shots ? ` (${shots.length} shots)` : " (look only)"}`);
}
