// Fully AI-generated video: a still frame (Flux 2 Pro) animated with Kling v4.
// The spec (prompts, length) lives in ads/<id>.json.
//   npm run ai-video -- --spec ads/coffee-machine.json [--still-only]
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { PRICES, spentUsd } from "./budget.ts";
import { download, runFal } from "./fal.ts";
import { H, W, ffmpeg } from "./ffmpeg.ts";

const { values } = parseArgs({ options: { spec: { type: "string" }, "still-only": { type: "boolean" } } });
if (!values.spec) throw new Error("Usage: npm run ai-video -- --spec ads/<id>.json [--still-only]");
const spec: { id: string; seconds: number; still: string; motion: string } =
  JSON.parse(readFileSync(values.spec, "utf8"));
const base = `ads/${spec.id}`;
console.log(`Spent so far: $${spentUsd().toFixed(3)}`);

// 1. Still frame (skipped if it already exists, so a re-run never pays twice).
if (!existsSync(`${base}-still.jpg`)) {
  const usd = PRICES["fal-ai/flux-2-pro"].usd * Math.ceil((W * H) / 1_000_000);
  console.log(`Generating still (~$${usd.toFixed(3)})`);
  const res = await runFal({
    endpoint: "fal-ai/flux-2-pro",
    input: { prompt: spec.still, image_size: { width: W, height: H }, output_format: "png", safety_tolerance: "2" },
    estimateUsd: usd,
    note: `${spec.id} still`,
  });
  await download(res.images[0].url, `${base}-still.png`);
  await ffmpeg(["-i", `${base}-still.png`, "-q:v", "2", `${base}-still.jpg`]);
  rmSync(`${base}-still.png`);
  writeFileSync(`${base}-still.url`, res.images[0].url + "\n");
}
if (values["still-only"]) process.exit(0);

// 2. Animate it.
const usd = PRICES["kling/v4/image-to-video"].usd * spec.seconds;
console.log(`Animating ${spec.seconds}s at 1080p with Kling v4 (~$${usd.toFixed(2)})`);
const startUrl = readFileSync(`${base}-still.url`, "utf8").trim();
const video = await runFal({
  endpoint: "kling/v4/image-to-video",
  input: { start_image_url: startUrl, prompt: spec.motion, duration: spec.seconds, resolution: "1080p" },
  estimateUsd: usd,
  note: `${spec.id} video ${spec.seconds}s`,
});
await download(video.video.url, `${base}.raw.mp4`);
// Silent by default (music is added by the merchant in TikTok/Instagram).
await ffmpeg(["-i", `${base}.raw.mp4`, "-an", "-c:v", "copy", "-movflags", "+faststart", `${base}.mp4`]);
rmSync(`${base}.raw.mp4`);
console.log(`Saved ${base}.mp4. Spent so far: $${spentUsd().toFixed(3)}`);
