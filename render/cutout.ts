// Product cut-out, cached per photo + subject.
//
// Two models, combined:
//  - BiRefNet gives clean edges but keeps everything in the foreground (hands, flowers, props).
//  - SAM 3 keeps only the object named in `subject` (e.g. "perfume bottle") but has rough edges.
// The final alpha is BiRefNet's mask, limited to a slightly grown SAM 3 mask.
// The mask is applied to the ORIGINAL photo, so product pixels are never redrawn.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { PRICES } from "./budget.ts";
import { dataUri, download, runFal } from "./fal.ts";
import { ffmpeg, prepPhoto } from "./ffmpeg.ts";

export interface CutoutResult { file: string; usd: number; note?: string }

export async function cutout(photo: string, subject: string | undefined): Promise<CutoutResult> {
  mkdirSync(".cache", { recursive: true });
  const hash = createHash("sha1").update(readFileSync(photo)).digest("hex").slice(0, 12);
  const key = subject ? `${hash}-${subject.replace(/\W+/g, "_")}` : hash;
  const prepped = `.cache/${hash}-photo.png`;
  const edgeMask = `.cache/${hash}-mask.png`;
  const subjectMask = `.cache/${key}-sam.png`;
  const out = `.cache/${key}-cutout.png`;
  if (existsSync(out)) return { file: out, usd: 0 };

  if (!existsSync(prepped)) await prepPhoto(photo, prepped);
  const image = await dataUri(readFileSync(prepped), "image/png");
  let usd = 0;
  let note: string | undefined;

  if (!existsSync(edgeMask)) {
    const res = await runFal({
      endpoint: "fal-ai/birefnet/v2",
      input: { image_url: image, model: "General Use (Heavy)", operating_resolution: "2048x2048", mask_only: true },
      estimateUsd: 0.02,
      costFromMetrics: (m) => (m.inference_time ?? 30) * PRICES["fal-ai/birefnet/v2"].usd,
      note: `cutout ${basename(photo)}`,
    });
    await download(res.image.url, edgeMask);
    usd += 0.02;
  }

  let gate: string | undefined;
  if (subject) {
    if (!existsSync(subjectMask)) {
      const res = await runFal({
        endpoint: "fal-ai/sam-3/image",
        input: { image_url: image, prompt: subject, apply_mask: false, max_masks: 1 },
        estimateUsd: PRICES["fal-ai/sam-3/image"].usd,
        note: `subject "${subject}" ${basename(photo)}`,
      });
      usd += PRICES["fal-ai/sam-3/image"].usd;
      if (res.masks?.length) await download(res.masks[0].url, subjectMask);
    }
    if (existsSync(subjectMask)) gate = subjectMask;
    else note = `no "${subject}" found; kept the whole foreground`;
  }

  // Combine: edge mask x grown subject mask, then use it as the photo's alpha channel.
  const grow = "dilation,".repeat(6);
  const filter = gate
    ? `[1:v][0:v]scale2ref[em][p];[2:v][p]scale2ref[sm][p2];` +
      `[em]format=gray[e];[sm]format=gray,${grow}boxblur=2[s];[e][s]blend=all_mode=multiply[m];` +
      `[p2][m]alphamerge,format=rgba`
    : `[1:v][0:v]scale2ref[m][p];[m]format=gray[mg];[p][mg]alphamerge,format=rgba`;
  await ffmpeg(["-i", prepped, "-i", edgeMask, ...(gate ? ["-i", gate] : []),
    "-filter_complex", filter, "-frames:v", "1", out]);
  return { file: out, usd, note };
}
