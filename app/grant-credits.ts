// Operator tool: add credits to an account without a payment (testers, goodwill, support).
//   npm run credits -- someone@example.com 5 "beta tester"
import { grantCredits } from "./credits.ts";

const [email, count, ...note] = process.argv.slice(2);
const n = Number(count);
if (!email || !Number.isInteger(n) || n < 1 || n > 1000) {
  console.error('Usage: npm run credits -- <email> <credits 1-1000> "<note>"');
  process.exit(1);
}
console.log(`${email} now has ${grantCredits(email, n, note.join(" ") || "manual grant")} credits`);
