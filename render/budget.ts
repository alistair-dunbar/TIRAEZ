// Spending ledger and hard cap. Every paid fal.ai call is checked against the cap
// before it is sent, and its actual cost is appended to data/spend.csv (committed,
// so the cap holds across sessions).
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const LEDGER = new URL("../data/spend.csv", import.meta.url);
const HEADER = "time,endpoint,usd,note\n";

export const BUDGET_USD = Number(process.env.BUDGET_USD ?? 5);

// fal.ai list prices, checked via api.fal.ai/v1/models/pricing on 2026-11-15.
export const PRICES = {
  "fal-ai/flux/dev": { unit: "megapixels", usd: 0.025 },
  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video": { unit: "seconds", usd: 0.07 },
  "fal-ai/birefnet/v2": { unit: "compute seconds", usd: 0.000575 },
  "fal-ai/sam-3/image": { unit: "image", usd: 0.005 },
} as const;

export type Endpoint = keyof typeof PRICES;

export function spentUsd(): number {
  if (!existsSync(LEDGER)) return 0;
  return readFileSync(LEDGER, "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .reduce((sum, line) => sum + Number(line.split(",")[2] ?? 0), 0);
}

export function assertBudget(estimateUsd: number, what: string): void {
  const spent = spentUsd();
  if (spent + estimateUsd > BUDGET_USD) {
    throw new Error(
      `Budget stop: ${what} would cost ~$${estimateUsd.toFixed(3)}, ` +
        `already spent $${spent.toFixed(3)} of $${BUDGET_USD}. Raise BUDGET_USD to continue.`,
    );
  }
}

export function record(endpoint: string, usd: number, note: string): void {
  if (!existsSync(LEDGER)) writeFileSync(LEDGER, HEADER);
  const safeNote = note.replace(/[,\n]/g, " ");
  appendFileSync(LEDGER, `${new Date().toISOString()},${endpoint},${usd.toFixed(4)},${safeNote}\n`);
}
