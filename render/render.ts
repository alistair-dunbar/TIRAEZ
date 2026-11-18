// Renders one video: product photo + template -> silent, text-free 1080x1920 mp4.
//   npm run render -- --photo samples/fragrance-01.jpg --template fragrance [--scene 2] [--subject "perfume bottle"]
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname } from "node:path";
import { parseArgs } from "node:util";
import { cutout } from "./cutout.ts";
import { composite, pan, touchesEdge } from "./ffmpeg.ts";
import { loadTemplate, type SceneInfo } from "./templates.ts";

const { values } = parseArgs({
  options: {
    photo: { type: "string" }, template: { type: "string" }, scene: { type: "string" },
    /** What the product is, e.g. "perfume bottle". Defaults to the template's subject. */
    subject: { type: "string" },
  },
});
if (!values.photo || !values.template) {
  throw new Error("Usage: npm run render -- --photo <file> --template <id> [--scene <n>]");
}
const photo = values.photo;
const tpl = loadTemplate(values.template);
const started = Date.now();
let costUsd = 0;
let sceneLabel = "-";

mkdirSync("out", { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const out = `out/${tpl.id}-${basename(photo, extname(photo))}-${stamp}.mp4`;

if (tpl.mode === "pan") {
  await pan(photo, out);
} else {
  // 1. Cut-out (cached per photo + subject, so re-renders with other scenes are free).
  const cut = await cutout(photo, values.subject ?? tpl.subject);
  costUsd += cut.usd;
  if (cut.note) console.log(`Note: ${cut.note}`);
  const cropped = await touchesEdge(cut.file);
  if (cropped) console.log(`Warning: the product is cut off at the ${cropped} edge of the photo. Ask for a photo showing the whole product.`);

  // 2. Pick a scene from the library.
  const dir = `scenes/${tpl.id}`;
  const scenes = existsSync(dir) ? readdirSync(dir).filter((f) => /^scene-\d+\.json$/.test(f)) : [];
  if (scenes.length === 0) throw new Error(`No scenes for "${tpl.id}". Run: npm run scenes -- --template ${tpl.id}`);
  const pick = values.scene ? `scene-${values.scene}.json` : scenes[Math.floor(Math.random() * scenes.length)];
  if (!scenes.includes(pick)) throw new Error(`Scene ${values.scene} not found in ${dir}`);
  const info: SceneInfo = JSON.parse(readFileSync(`${dir}/${pick}`, "utf8"));
  sceneLabel = String(info.index);

  // 3. Composite the unchanged product onto the scene.
  await composite(`${dir}/${info.videoFile}`, cut.file, { ...tpl.placement, ...info.placement }, out);
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
const log = "data/runs.csv";
if (!existsSync(log)) appendFileSync(log, "time,photo,template,scene,usd_max,seconds,output\n");
appendFileSync(log, `${new Date().toISOString()},${basename(photo)},${tpl.id},${sceneLabel},${costUsd.toFixed(3)},${seconds},${out}\n`);
console.log(`Done in ${seconds}s -> ${out}`);
