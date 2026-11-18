// Prints packs/build/*.html to PDF with Chromium (Playwright is pre-installed in cloud
// sessions; it is not a project dependency). Run packs/build_pdf.py first.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const build = join(dirname(fileURLToPath(import.meta.url)), "build");
const jobs = JSON.parse(readFileSync(join(build, "jobs.json"), "utf8"));

const browser = await chromium.launch();
const page = await browser.newPage();
for (const job of jobs) {
  await page.goto(pathToFileURL(join(build, job.html)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: join(build, job.pdf), format: "A4", printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: "<span></span>",
    footerTemplate: "<div style='width:100%;text-align:center;font-size:8px;color:#9a8c7c'><span class='pageNumber'></span></div>",
  });
  console.log(`saved ${join(build, job.pdf)}`);
}
await browser.close();
