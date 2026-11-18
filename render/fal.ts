// Minimal fal.ai queue client using plain fetch (no SDK).
// Auth: if FAL_KEY is set it is sent as "Authorization: Key ...". In cloud sessions
// the key is a network secret injected by the proxy, so FAL_KEY is not needed there.
// Cloud sessions: run with NODE_USE_ENV_PROXY=1 so Node's fetch uses the proxy.
import { writeFile } from "node:fs/promises";
import { assertBudget, record, type Endpoint } from "./budget.ts";

const QUEUE = "https://queue.fal.run";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.FAL_KEY) h.Authorization = `Key ${process.env.FAL_KEY}`;
  return h;
}

async function json(res: Response, what: string): Promise<any> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${what} failed (${res.status}): ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FalCall {
  endpoint: Endpoint;
  input: Record<string, unknown>;
  /** Upper-bound cost used for the budget check before sending. */
  estimateUsd: number;
  /** Actual cost from the finished job's metrics; defaults to the estimate. */
  costFromMetrics?: (metrics: { inference_time?: number }) => number;
  note: string;
}

export async function runFal(call: FalCall): Promise<any> {
  assertBudget(call.estimateUsd, call.note);

  const submit = await json(
    await fetch(`${QUEUE}/${call.endpoint}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(call.input),
    }),
    `submit ${call.endpoint}`,
  );

  // From here on fal.ai may charge, so record cost even if polling fails later.
  let status: any;
  const started = Date.now();
  for (;;) {
    status = await json(await fetch(submit.status_url, { headers: headers() }), "status");
    if (status.status === "COMPLETED") break;
    if (Date.now() - started > 15 * 60_000) {
      record(call.endpoint, call.estimateUsd, `${call.note} (timed out; cost estimated)`);
      throw new Error(`Timed out waiting for ${call.endpoint} request ${submit.request_id}`);
    }
    await sleep(2000);
  }

  const usd = call.costFromMetrics ? call.costFromMetrics(status.metrics ?? {}) : call.estimateUsd;
  record(call.endpoint, usd, call.note);

  const result = await fetch(submit.response_url, { headers: headers() });
  return json(result, `result ${call.endpoint}`);
}

export async function download(url: string, path: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

export async function dataUri(buf: Buffer, mime: string): Promise<string> {
  return `data:${mime};base64,${buf.toString("base64")}`;
}
