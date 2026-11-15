// The video step sits behind this interface, so the rest of the service doesn't care
// how a video is made. ENGINE=mock (default) costs nothing; ENGINE=fal spends real money.
import { copyFile, readFile } from "node:fs/promises";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { PRICES } from "../../render/budget.ts";
import { download, runFal } from "../../render/fal.ts";
import { ffmpeg } from "../../render/ffmpeg.ts";

export interface CatalogTemplate {
  id: string;
  niche: string;
  name: Record<string, string>;
  description: Record<string, string>;
  spec: string;
  preview: string;
}

export interface Job {
  videoId: number;
  template: CatalogTemplate;
  /** The merchant's photo, if they uploaded one. */
  upload?: { file: string; mime: string };
  /** Where the finished mp4 must be written. */
  out: string;
}

export interface Engine {
  name: string;
  generate(job: Job): Promise<void>;
}

/** Development engine: waits a few seconds, then delivers an existing sample video. Free. */
const mock: Engine = {
  name: "mock",
  async generate(job) {
    await new Promise((r) => setTimeout(r, Number(process.env.MOCK_DELAY_MS ?? 4000)));
    if (process.env.MOCK_FAIL === "1") throw new Error("mock failure");
    await copyFile(process.env.MOCK_VIDEO ?? "ads/coffee-machine-phone.mp4", job.out);
  },
};

/**
 * Real engine: Kling v4 animates either the merchant's photo or the template's own still.
 * Every call goes through the spending cap in render/budget.ts.
 * NOTE: the merchant-photo path has not been tested yet (labels may be altered by the model).
 */
const fal: Engine = {
  name: "fal",
  async generate(job) {
    const spec: { id: string; seconds: number; still: string; motion: string } =
      JSON.parse(readFileSync(job.template.spec, "utf8"));
    let start: string;
    if (job.upload) {
      start = `data:${job.upload.mime};base64,${(await readFile(job.upload.file)).toString("base64")}`;
    } else {
      const urlFile = `ads/${spec.id}-still.url`;
      if (!existsSync(urlFile)) throw new Error(`No still for template ${spec.id}; run npm run ai-video -- --spec ${job.template.spec} --still-only`);
      start = readFileSync(urlFile, "utf8").trim();
    }
    const video = await runFal({
      endpoint: "kling/v4/image-to-video",
      input: { start_image_url: start, prompt: spec.motion, duration: spec.seconds, resolution: "1080p" },
      estimateUsd: PRICES["kling/v4/image-to-video"].usd * spec.seconds,
      note: `order ${job.videoId} ${spec.id}`,
    });
    const raw = `${job.out}.raw.mp4`;
    await download(video.video.url, raw);
    await ffmpeg(["-i", raw, "-an", "-c:v", "copy", "-movflags", "+faststart", job.out]);
    rmSync(raw);
  },
};

export function engine(): Engine {
  const name = process.env.ENGINE ?? "mock";
  if (name === "mock") return mock;
  if (name === "fal") return fal;
  throw new Error(`Unknown ENGINE "${name}" (use mock or fal)`);
}
