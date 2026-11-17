// What still stands between the live site and each operation. Run it with the production settings:
//   NODE_ENV=production MAIL=resend APP_URL=... npm run launch-check    (or on Railway: node app/launch-check.ts)
// It reads the config files and environment only; it changes nothing and sends nothing.
import { business, compliance, legal, legalStatus, paymentTermsMissing, retention, transfersMissing } from "./legal.ts";
import { mailReady } from "./mail.ts";

process.env.LEGAL_ENFORCE = "1";
const lines: string[] = [];
const item = (ok: boolean, what: string, fix: string) => lines.push(`${ok ? "  ok  " : "  TODO"} ${what}${ok ? "" : `\n         -> ${fix}`}`);

const status = legalStatus();
const facts = Object.entries(business).filter(([k, v]) => !k.startsWith("_") && v === null).map(([k]) => k);
lines.push("Accounts (sign-up, login, email confirmation, password reset)");
item(facts.length === 0, "operator details", `fill in config/business.json: ${facts.join(", ")}`);
item(retention.confirmed, "retention periods confirmed", "check config/retention.json, then set \"confirmed\": true");
const policyGaps = status.unresolved.filter((u) => !u.startsWith("business.") && !u.startsWith("retention."));
item(policyGaps.length === 0, "policy text complete", `still unresolved: ${policyGaps.join(", ")} (config/legal.json)`);
item(legal.status === "published", "policies marked published", "set \"status\": \"published\" in config/legal.json once reviewed");
const t = transfersMissing("accounts");
item(t.length === 0, "safeguards for transfers outside Saudi Arabia (account data)", `record mechanism and riskAssessment for: ${t.join(", ")} in config/compliance.json (docs/compliance/transfers.md)`);
item(mailReady(), "account email can be sent", "set MAIL=resend, RESEND_API_KEY, MAIL_FROM and APP_URL in Railway Variables (docs/DEPLOY.md)");

lines.push("", "Video generation");
const g = transfersMissing("generation");
item(g.length === 0, "safeguards for transfers to the video model and hosting", `record mechanism and riskAssessment for: ${g.join(", ")} in config/compliance.json`);
item(process.env.ENGINE === "fal", "ENGINE=fal set", "set ENGINE=fal and FAL_KEY in Railway Variables (costs money per video)");

lines.push("", "Payments");
const p = paymentTermsMissing();
item(p.length === 0, "billing terms decided", `fill in config/legal.json unresolved: ${p.join(", ")}`);
item(process.env.PAYMENTS === "moyasar", "PAYMENTS=moyasar set", "set PAYMENTS=moyasar, MOYASAR_SECRET_KEY and APP_URL when ready to sell");

console.log(lines.join("\n"));
void compliance;
