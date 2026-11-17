// Read-only checks against the live site: no sign-ups, no uploads, no generation, no cost.
//   node scripts/verify-live.mjs [https://www.tiraez.com] [out-dir]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = (process.argv[2] ?? "https://www.tiraez.com").replace(/\/$/, "");
const out = process.argv[3] ?? ".cache/verify-live";
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, what, detail = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  (${detail})` : ""}`);

// HTTP-level checks
const health = await fetch(`${base}/healthz`).catch((e) => e);
check(health.status === 200, "healthz answers 200", String(health.status ?? health.message));
const plain = await fetch(base.replace("https://", "http://") + "/templates", { redirect: "manual" }).catch((e) => e);
check(plain.status === 301 && plain.headers?.get("location")?.startsWith("https://"), "http redirects to https", `${plain.status} ${plain.headers?.get("location")}`);
const home = await fetch(base + "/");
check(/max-age/.test(home.headers.get("strict-transport-security") ?? ""), "HSTS header present");
check(/default-src 'self'/.test(home.headers.get("content-security-policy") ?? ""), "CSP header present");
const site = await (await fetch(base + "/api/site")).json();
check(Boolean(site.brandName), "site info loads", `brand ${site.brandName}, generation ${site.generationOn ? "on" : "off"}, payments ${site.paymentsOn ? "on" : "off"}`);
const cat = await (await fetch(base + "/api/templates")).json();
check(cat.templates?.length > 0, "catalogue loads", `${cat.templates?.length} templates`);
check(!/"prompt"|Do not add people/.test(JSON.stringify(cat)), "no prompt text sent to browsers");
check(cat.templates.every((t) => t.preview === null), "no preview media shown (none approved)");
check((await fetch(base + "/no-such-page")).status === 404, "unknown pages return 404");
for (const h of ["x-frame-options", "cross-origin-opener-policy", "permissions-policy", "x-content-type-options"]) check(Boolean(home.headers.get(h)), `${h} header present`);
const terms = await fetch(base + "/legal/terms");
const termsText = await terms.text();
check(terms.status === 200, "terms page answers 200");
check(!/mark class="todo"|Draft for review/.test(termsText), "no draft or unconfirmed policy text in production");
if (!site.legal || site.legal.draft) check(site.signupsOpen === false && /being prepared/.test(termsText), "policies unpublished: pages withheld and sign-ups closed");
else check(site.signupsOpen === true, "policies published: sign-ups open");
for (const f of ["/favicon.svg", "/favicon.ico", "/apple-touch-icon.png", "/manifest.webmanifest", "/brand/tiraez-wordmark.svg"]) check((await fetch(base + f)).status === 200, `${f} served`);

// Browser checks at three widths
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const path of ["/", "/templates", `/templates/${cat.templates[0].slug}`, "/signin", "/legal/privacy", "/report"]) {
    const r = await p.goto(base + path, { waitUntil: "networkidle" });
    const h1 = await p.locator("h1").first().textContent().catch(() => null);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(r.status() === 200 && h1 && overflow <= 0, `${w}px ${path}`, `h1 "${h1?.trim()}"${overflow > 0 ? `, overflow ${overflow}px` : ""}`);
    if (path === "/") await p.screenshot({ path: `${out}/home-${w}.png`, fullPage: true });
  }
  check(errors.length === 0, `${w}px no console or page errors`, errors.slice(0, 3).join(" | "));
  await p.close();
}
await b.close();
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("FAIL")).length} failed, screenshots in ${out}`);
process.exitCode = results.some((r) => r.startsWith("FAIL")) ? 1 : 0;
