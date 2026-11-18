// Builds the reusable background-scene library for a template. Run once per template;
// existing scenes are skipped, so re-running never pays twice.
//   npm run scenes -- --template fragrance [--only 1]
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { PRICES } from "./budget.ts";
import { download, runFal } from "./fal.ts";
import { H, SECONDS, W, ffmpeg } from "./ffmpeg.ts";
import { loadTemplate, type SceneInfo } from "./templates.ts";

const { values } = parseArgs({ options: { template: { type: "string" }, only: { type: "string" } } });
if (!values.template) throw new Error("Usage: npm run scenes -- --template <id> [--only <n>]");

const tpl = loadTemplate(values.template);
if (tpl.mode !== "composite") {
  console.log(`Template "${tpl.id}" does not use AI scenes; nothing to build.`);
  process.exit(0);
}

const dir = `scenes/${tpl.id}`;
mkdirSync(dir, { recursive: true });

const megapixels = (W * H) / 1_000_000;
const stillUsd = PRICES["fal-ai/flux/dev"].usd * megapixels;
const videoUsd = PRICES["fal-ai/kling-video/v2.5-turbo/pro/image-to-video"].usd * SECONDS;

for (const [i, prompt] of tpl.scenes.entries()) {
  const n = i + 1;
  if (values.only && Number(values.only) !== n) continue;
  const base = `${dir}/scene-${n}`;
  if (existsSync(`${base}.mp4`)) {
    console.log(`scene ${n}: already built, skipping`);
    continue;
  }

  console.log(`scene ${n}: generating still (~$${stillUsd.toFixed(3)})`);
  const still = await runFal({
    endpoint: "fal-ai/flux/dev",
    input: { prompt: prompt.still, image_size: { width: W, height: H }, num_images: 1, output_format: "png" },
    estimateUsd: stillUsd,
    note: `${tpl.id} scene ${n} still`,
  });
  const stillUrl: string = still.images[0].url;
  await download(stillUrl, `${base}.tmp.png`);
  await ffmpeg(["-i", `${base}.tmp.png`, "-q:v", "2", `${base}.jpg`]);
  rmSync(`${base}.tmp.png`);

  console.log(`scene ${n}: animating with Kling (~$${videoUsd.toFixed(2)})`);
  const video = await runFal({
    endpoint: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    input: {
      image_url: stillUrl,
      prompt: prompt.motion,
      duration: String(SECONDS),
      negative_prompt:
        "camera movement, zoom, pan, dolly, objects appearing, products, bottles, cups, text, letters, people, hands, blur, distortion, low quality",
    },
    estimateUsd: videoUsd,
    note: `${tpl.id} scene ${n} video`,
  });
  // Re-compress for the repo: the original is ~12 MB, this is ~2 MB with no visible loss.
  await download(video.video.url, `${base}.tmp.mp4`);
  await ffmpeg(["-i", `${base}.tmp.mp4`, "-c:v", "libx264", "-preset", "slow", "-crf", "20",
    "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", `${base}.mp4`]);
  rmSync(`${base}.tmp.mp4`);

  const info: SceneInfo = {
    template: tpl.id, index: n, still: prompt.still, motion: prompt.motion,
    stillFile: `scene-${n}.jpg`, videoFile: `scene-${n}.mp4`, costUsd: stillUsd + videoUsd,
  };
  writeFileSync(`${base}.json`, JSON.stringify(info, null, 2) + "\n");
  console.log(`scene ${n}: saved ${base}.mp4`);
}
