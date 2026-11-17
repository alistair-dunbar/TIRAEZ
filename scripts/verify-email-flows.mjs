// Browser check of sign-up, email confirmation and password reset against a local test server.
// Emails are read from the sandbox outbox (DATA_DIR/outbox, MAIL=outbox): nothing is really sent.
// Usage: node scripts/verify-email-flows.mjs http://localhost:3202 .cache/e2e [width height]
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const [base, dir, width = "1440", height = "900"] = process.argv.slice(2);
const W = Number(width);
const results = [];
const check = (ok, what, detail = "") => results.push(`${ok ? "PASS" : "FAIL"}  [${W}] ${what}${detail ? `  (${detail})` : ""}`);

/** The newest link to `path` in mail sent to `to`. */
function linkFor(to, path) {
  const name = to.replace(/[^a-z0-9@.]/gi, "_"); // as the outbox names its files
  const files = readdirSync(`${dir}/outbox`).filter((f) => f.endsWith(`-${name}.eml`)).sort();
  for (const f of files.reverse()) {
    const m = new RegExp(`https?://\\S+${path}\\?token=[A-Za-z0-9_-]+`).exec(readFileSync(`${dir}/outbox/${f}`, "utf8"));
    if (m) return new URL(m[0]).pathname + new URL(m[0]).search;
  }
  return null;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: Number(height) } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
const shot = (name) => p.screenshot({ path: `${dir}/${W}-${name}.png`, fullPage: true });

// The journey's account (made with curl) confirms through its emailed link.
const ownerLink = linkFor("owner@example.com", "/verify-email");
if (ownerLink) { await p.goto(base + ownerLink); await p.waitForSelector("h1"); }

// 1. Sign up through the form
const email = `person-${W}-${Date.now()}@example.com`;
await p.goto(base + "/signup");
await p.fill("input[name=name]", "Sara Al-Qahtani");
await p.fill("input[name=email]", email);
await p.fill("input[name=password]", "first-password");
await p.fill("input[name=age]", "34");
await p.check("input[name=agreeTerms]");
await p.check("input[name=confirmAdult]");
await p.click("button:has-text('Create account')");
await p.waitForSelector("h1:has-text('Confirm your email')");
check(true, "sign-up leads to 'Confirm your email'");
await shot("confirm-email");

// 2. Protected pages wait for confirmation
await p.goto(base + "/create/coffee-morning-bar");
await p.waitForSelector("h1");
check((await p.textContent("h1")).includes("Confirm your email"), "workspace redirects until the email is confirmed");

// 3. Open the link from the email
await wait(100);
const verify = linkFor(email, "/verify-email");
await p.goto(base + verify);
await p.waitForSelector("h1:has-text('Your email is confirmed')");
check(!p.url().includes("token="), "token removed from the address bar");
await p.goto(base + "/create/coffee-morning-bar");
await p.waitForSelector("h1");
check(!(await p.textContent("h1")).includes("Confirm"), "workspace opens after confirming", await p.textContent("h1"));
await p.goto(base + verify);
await p.waitForSelector("h1");
check((await p.textContent("main")).includes("already been used"), "a used confirmation link says so");

// 4. Forgot password from the sign-in page
await p.context().clearCookies();
await p.goto(base + "/signin");
await p.fill("input[name=email]", email);
await p.click("a:has-text('Forgot password?')");
await p.waitForSelector("h1:has-text('Reset your password')");
check((await p.inputValue("input[name=email]")) === email, "'Forgot password?' carries the email across");
await p.click("button:has-text('Send reset instructions')");
await p.waitForSelector("text=If an account exists for this email, we'll send password reset instructions.");
check(true, "neutral reply shown");
await shot("forgot-sent");

// 5. Open the reset link and choose a new password
await wait(100);
const reset = linkFor(email, "/reset-password");
await p.goto(base + reset);
await p.waitForSelector("h1:has-text('Choose a new password')");
check((await p.getAttribute("input[autocomplete=username]", "value")) === email, "reset form carries the username for password managers");
await p.fill("input[name=password]", "second-password");
await p.fill("input[name=confirm]", "something-else");
await p.click("button:has-text('Save new password')");
check((await p.textContent(".field__error:not(:empty)")).includes("don't match"), "mismatched passwords explained");
await p.fill("input[name=confirm]", "second-password");
await shot("reset-form");
await p.click("button:has-text('Save new password')");
await p.waitForSelector("text=Your password has been changed.");
check(true, "password changed");

// 6. Old password refused, new one works, link can't be reused
await p.goto(base + "/signin");
await p.fill("input[name=email]", email); await p.fill("input[name=password]", "first-password");
await p.click("button:has-text('Sign in')");
const refused = await p.waitForSelector(".form-status:has-text(\"don't match\")", { timeout: 5000 }).then(() => true, () => false);
check(refused, "old password refused", await p.textContent(".form-status"));
await p.fill("input[name=password]", "second-password");
await p.click("button:has-text('Sign in')");
await p.waitForSelector("h1:has-text('Templates')");
check(true, "new password signs in");
await p.goto(base + reset);
await p.waitForSelector("text=This link has already been used.");
check(await p.isVisible("a:has-text('Request a new link')"), "a used reset link offers a new one");
await shot("reset-used");

const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check(overflow <= 0, "no horizontal overflow", String(overflow));
check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
await b.close();
console.log(results.join("\n"));
process.exitCode = results.some((r) => r.startsWith("FAIL")) ? 1 : 0;
