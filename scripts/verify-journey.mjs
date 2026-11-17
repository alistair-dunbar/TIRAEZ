// Internal browser check of the whole journey (mock provider, test payments). Not shipped.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const [base, dir, width = "1440", height = "900"] = process.argv.slice(2);
const W = Number(width);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: Number(height) } });
const errors = [];
p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
p.on("pageerror", (e) => errors.push(String(e)));
const shot = async (name) => { await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${dir}/${W}-${name}.png`, fullPage: true }); };
const log = (...a) => console.log(`[${W}]`, ...a);
const overflow = async (where) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 0) errors.push(`${where}: overflow ${o}px`); };

// Sign in via the header link
await p.goto(base + "/");
if (W < 960) await p.click("[data-menu-toggle]");
await p.click(W < 960 ? "#mobile-nav >> text=Sign in" : "[data-nav] >> text=Sign in");
await p.waitForSelector("h1:has-text('Sign in')");
await p.click("button:has-text('Sign in')");
log("empty sign-in errors:", await p.locator(".field__error:not(:empty)").count());
await p.fill("input[type=email]", "owner@example.com");
await p.fill("input[type=password]", "password123");
await p.click("button:has-text('Sign in')");
await p.waitForSelector("h1:has-text('Templates')");

// Catalogue: filter, search, empty state, reset
await p.click(".chip:has-text('Coffee shops')");
log("coffee entries:", await p.locator(".entry").count(), "url:", new URL(p.url()).search);
await p.fill("input[type=search]", "zzzz");
log("empty state shown:", await p.locator(".empty:not([hidden])").count());
await p.click(".empty button:has-text('Reset filters')");
await p.fill("input[type=search]", "steam");
await p.click(".segmented button[aria-label='Vertical 9:16']");
log("search steam + 9:16:", await p.locator(".entry").count(), new URL(p.url()).search);
await shot("catalogue");
await overflow("catalogue");
await p.click(".entry >> nth=0 >> .entry__name a");
await p.waitForSelector(".crumbs");
await shot("template");
await p.click(".crumbs a:has-text('Templates')");
log("filters kept after back:", new URL(p.url()).search, await p.inputValue("input[type=search]"));
await p.fill("input[type=search]", "");
await p.click(".segmented button[aria-label='Any format']");
await p.click(".chip:has-text('Coffee shops')");
await p.click(".entry:has-text('Morning light on the bar') >> text=Use this template");
await p.waitForSelector("h1:has-text('Create a video')");
await shot("workspace-empty");
await overflow("workspace");

// Generate with nothing filled in: errors beside fields
await p.click("button:has-text('Generate video')");
log("validation status:", await p.textContent(".review .form-status"));
// Invalid upload (text file named .jpg)
await p.setInputFiles("input[type=file]", `${dir}/fake.jpg`);
await p.waitForSelector("#upload-title ~ [role=alert]:not(:empty), .field__error[role=alert]:not(:empty)");
log("bad upload error:", await p.textContent(".field__error[role=alert]"));
// Real upload
await p.setInputFiles("input[type=file]", `${dir}/photo.jpg`);
await p.waitForSelector(".crop__frame");
await p.focus(".crop__frame");
await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown");
await p.fill("input[type=text] >> nth=0", "Espresso machine on an oak counter");
await p.click(".option:has-text('Square 1:1')");
await p.click(".option:has-text('Vertical 9:16')");
await shot("workspace-filled");
// Refresh keeps the draft
await p.reload();
await p.waitForSelector(".crop__frame");
log("draft after refresh:", await p.inputValue("input[type=text] >> nth=0"));
await p.click("button:has-text('Generate video')");
await p.waitForURL(/\/videos\/\d+$/);
await p.waitForSelector("h1:has-text('queued'), h1:has-text('being made')");
log("status:", await p.textContent("h1"));
await shot("job-running");
// Refresh during the job
await p.reload();
await p.waitForSelector("h1");
log("after refresh:", await p.textContent("h1"));
await p.waitForSelector("h1:has-text('Your video is ready')", { timeout: 30000 });
await shot("job-ready");
await overflow("job");
const video = await p.$eval("video", (v) => ({ autoplay: v.autoplay, muted: v.muted, controls: v.controls, src: v.getAttribute("src") }));
log("video:", JSON.stringify(video));
const dl = await p.getAttribute("a:has-text('Download video')", "href");
const r = await p.request.get(base + dl);
log("download:", r.status(), r.headers()["content-type"], r.headers()["content-disposition"]);
log("credits in header:", W >= 960 ? await p.textContent(".nav__credits") : "(menu)");

// Create another version keeps inputs
await p.click("text=Create another version");
await p.waitForSelector("h1:has-text('Create another version')");
log("prefilled:", await p.inputValue("input[type=text] >> nth=0"), "| crop shown:", await p.locator(".crop__frame").count());
await shot("another-version");

// Change template keeps compatible details
await p.click("text=Change template");
await p.waitForSelector(".notice:has-text('Choose a new template')");
await p.click(".chip:has-text('Real estate')");
await p.click(".entry:has-text('Room, slow glide') >> text=Use this template");
await p.waitForSelector("h1:has-text('Create')");
log("change-template notice:", (await p.textContent(".page__head .notice")).replace(/\s+/g, " "));

// My videos
await p.goto(base + "/videos");
await p.waitForSelector(".video-card");
log("my videos:", await p.locator(".video-card").count(), "|", (await p.textContent(".video-card")).replace(/\s+/g, " "));
await shot("my-videos");
await overflow("my videos");

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : `[${W}] no page errors, no overflow`);
await b.close();
