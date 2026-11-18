// Reports of misuse or problems, and the founders' tools for handling them and for suspending accounts.
//   npm run reports                          list open reports
//   npm run reports -- --close 4 --outcome "Removed the video, warned the account"
//   npm run suspend -- --email a@example.com --reason "Impersonation (report 4)"
//   npm run suspend -- --email a@example.com --lift
//   npm run suspend -- --email a@example.com --lift-age --note "Report 7: typo, reviewed"   (then they confirm their age again)
import { ValidationError, type User } from "./auth.ts";
import { db } from "./db.ts";
import { liftAgeRestriction } from "./account.ts";

export const REPORT_KINDS: Record<string, string> = {
  rights: "Uses my photo, likeness, brand or work without permission",
  harmful: "Harmful, abusive or illegal content",
  deceptive: "Misleading or deceptive content",
  child_safety: "Content involving a child",
  age_correction: "I entered my age by mistake and my account was restricted",
  privacy: "A request about my personal data (access, correction, deletion or objection)",
  security: "A security or privacy problem with the site",
  other: "Something else",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? c : "")).trim().slice(0, max + 1) : "");

export function createReport(user: User | null, body: any): number {
  body = body && typeof body === "object" ? body : {};
  const errors: Record<string, string> = {};
  const kind = String(body.kind ?? "");
  if (!REPORT_KINDS[kind]) errors.kind = "Choose what the problem is.";
  const target = clean(body.target, 500);
  if (target.length > 500) errors.target = "Keep this to 500 characters.";
  const details = clean(body.details, 4000);
  if (details.length < 10) errors.details = "Tell us what happened, in a sentence or two.";
  else if (details.length > 4000) errors.details = "Keep this to 4,000 characters.";
  const email = user ? null : clean(body.email, 200).toLowerCase();
  if (email && (!EMAIL.test(email) || email.length > 200)) errors.email = "Write an email address with an @, such as name@example.com.";
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return Number(db.prepare("INSERT INTO reports (user_id, contact_email, kind, target, details) VALUES (?, ?, ?, ?, ?)")
    .run(user?.id ?? null, user ? user.email : email || null, kind, target || null, details).lastInsertRowid);
}

export function suspend(email: string, reason: string): boolean {
  const u = db.prepare("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL").get(email.toLowerCase()) as any;
  if (!u) return false;
  db.prepare("UPDATE users SET suspended_at = datetime('now'), suspended_reason = ? WHERE id = ?").run(reason, u.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
  return true;
}

export function lift(email: string): boolean {
  return db.prepare("UPDATE users SET suspended_at = NULL, suspended_reason = NULL WHERE email = ? AND deleted_at IS NULL").run(email.toLowerCase()).changes > 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const arg = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
  if (args[0] === "suspend") {
    const email = arg("email");
    if (!email) { console.log("Usage: npm run suspend -- --email <address> (--reason <text> | --lift)"); process.exit(1); }
    if (args.includes("--lift-age")) {
      const note = arg("note");
      if (!note) { console.log("Give a --note saying what was reviewed (for example the report number)."); process.exit(1); }
      const u = db.prepare("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL").get(email.toLowerCase()) as any;
      console.log(u && liftAgeRestriction(u.id, note) ? `Lifted the age restriction on ${email}. They must confirm their age again before using the service.` : "No restricted account with that email.");
    } else if (args.includes("--lift")) console.log(lift(email) ? `Lifted the suspension on ${email}.` : "No such account.");
    else {
      const reason = arg("reason");
      if (!reason) { console.log("Give a --reason, so the decision can be explained later."); process.exit(1); }
      console.log(suspend(email, reason) ? `Suspended ${email} and signed it out everywhere.` : "No such account.");
    }
  } else if (arg("close")) {
    const id = Number(arg("close"));
    const outcome = arg("outcome");
    if (!outcome) { console.log("Give an --outcome describing what was done."); process.exit(1); }
    const r = db.prepare("UPDATE reports SET status = 'closed', outcome = ?, closed_at = datetime('now') WHERE id = ?").run(outcome, id);
    console.log(r.changes ? `Closed report ${id}.` : "No such report.");
  } else {
    const rows = db.prepare("SELECT * FROM reports WHERE status = 'open' ORDER BY kind = 'child_safety' DESC, id").all() as any[];
    if (!rows.length) console.log("No open reports.");
    for (const r of rows) {
      console.log(`#${r.id}  ${r.created_at}  ${REPORT_KINDS[r.kind] ?? r.kind}`);
      console.log(`    from: ${r.contact_email ?? "no contact given"}${r.user_id ? ` (account ${r.user_id})` : ""}`);
      if (r.target) console.log(`    about: ${r.target}`);
      console.log(`    ${r.details.replace(/\n/g, "\n    ")}\n`);
    }
  }
}
