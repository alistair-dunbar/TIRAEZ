// fal.ai adapter, written against fal's documentation as checked on 16 Nov 2026:
// - Upload: POST https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3
//   with {file_name, content_type} -> {upload_url, file_url}; then PUT the bytes to upload_url.
// - Queue: POST https://queue.fal.run/<endpoint> -> {request_id, status_url, response_url}.
//   Status IN_QUEUE | IN_PROGRESS | COMPLETED; "a failed or cancelled request also has the
//   status COMPLETED", so the outcome is read from the result call (422 rejected input,
//   499 cancelled, 500/504 model or start failure, 404 once the result has expired).
// - Results are kept for a limited time (6 minutes to 1 hour, longer while payload storage is
//   on), so finished videos are downloaded straight away.
// - X-Fal-Object-Lifecycle-Preference sets how long uploaded and generated files stay on the CDN.
//
// Auth: FAL_KEY, sent as "Authorization: Key <key>". FAL_AUTH=proxy means an outbound proxy
// adds the header (cloud development sessions); then no key is read here.
import { createWriteStream } from "node:fs";
import { rename } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ModelConfig } from "../config.ts";
import { TransientError, type JobRef, type ResultOutcome, type StatusResult, type SubmitInput, type SubmitResult, type VideoProvider } from "./types.ts";

const QUEUE = "https://queue.fal.run";
const STORAGE = "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3";
const LIFECYCLE = JSON.stringify({ expiration_duration_seconds: 86_400 }); // one day: long enough to collect the result

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (process.env.FAL_KEY) h.Authorization = `Key ${process.env.FAL_KEY}`;
  return h;
}

/** Errors that mean the request never left this machine, so a retry can't double-charge. */
function neverSent(e: unknown): boolean {
  const code = (e as any)?.cause?.code ?? (e as any)?.code;
  return ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ERR_INVALID_URL"].includes(code);
}

async function body(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 500); } catch { return ""; }
}

export const fal: VideoProvider = {
  name: "fal",

  ready() {
    return Boolean(process.env.FAL_KEY) || process.env.FAL_AUTH === "proxy";
  },

  async uploadImage(bytes, mime, fileName) {
    let init: Response;
    try {
      init = await fetch(STORAGE, {
        method: "POST",
        headers: { ...headers(), "X-Fal-Object-Lifecycle-Preference": LIFECYCLE },
        body: JSON.stringify({ file_name: fileName, content_type: mime }),
      });
    } catch (e) { throw new TransientError(`upload initiate: ${(e as Error).message}`); }
    if (!init.ok) {
      const detail = `upload initiate ${init.status}: ${await body(init)}`;
      if (init.status >= 500 || init.status === 429) throw new TransientError(detail);
      throw new Error(detail);
    }
    const { upload_url, file_url } = (await init.json()) as { upload_url?: string; file_url?: string };
    if (!upload_url || !file_url) throw new Error("upload initiate: response without upload_url or file_url");
    let put: Response;
    try {
      put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": mime }, body: new Uint8Array(bytes) });
    } catch (e) { throw new TransientError(`upload put: ${(e as Error).message}`); }
    if (!put.ok) {
      const detail = `upload put ${put.status}: ${await body(put)}`;
      if (put.status >= 500 || put.status === 429) throw new TransientError(detail);
      throw new Error(detail);
    }
    return file_url;
  },

  async submit(model: ModelConfig, input: SubmitInput): Promise<SubmitResult> {
    let res: Response;
    try {
      res = await fetch(`${QUEUE}/${model.endpoint}`, {
        method: "POST",
        headers: { ...headers(), "X-Fal-Object-Lifecycle-Preference": LIFECYCLE },
        // Field names from the endpoint's OpenAPI schema (kling/v4/image-to-video).
        body: JSON.stringify({ start_image_url: input.imageUrl, prompt: input.prompt, duration: input.duration, resolution: input.resolution }),
      });
    } catch (e) {
      return neverSent(e)
        ? { ok: false, kind: "not_sent", detail: (e as Error).message }
        : { ok: false, kind: "unconfirmed", detail: (e as Error).message };
    }
    if (res.ok) {
      const j = (await res.json().catch(() => ({}))) as any;
      if (j.request_id && j.status_url && j.response_url) {
        return { ok: true, requestId: j.request_id, statusUrl: j.status_url, responseUrl: j.response_url };
      }
      return { ok: false, kind: "unconfirmed", detail: "accepted without a request id" };
    }
    const detail = `submit ${res.status}: ${await body(res)}`;
    if (res.status === 429) return { ok: false, kind: "busy", detail };
    if (res.status === 401 || res.status === 403 || res.status === 404) return { ok: false, kind: "config", detail };
    if (res.status >= 400 && res.status < 500) return { ok: false, kind: "rejected", detail };
    return { ok: false, kind: "unconfirmed", detail };
  },

  async status(job: JobRef): Promise<StatusResult | { lost: true }> {
    let res: Response;
    try { res = await fetch(job.statusUrl, { headers: headers(false) }); }
    catch (e) { throw new TransientError(`status: ${(e as Error).message}`); }
    if (res.status === 404) return { lost: true };
    if (!res.ok) throw new TransientError(`status ${res.status}: ${await body(res)}`);
    const j = (await res.json()) as any;
    if (!["IN_QUEUE", "IN_PROGRESS", "COMPLETED"].includes(j.status)) throw new TransientError(`status: unexpected ${j.status}`);
    return { state: j.status, queuePosition: Number.isInteger(j.queue_position) ? j.queue_position : null };
  },

  async result(job: JobRef): Promise<ResultOutcome> {
    let res: Response;
    try { res = await fetch(job.responseUrl, { headers: headers(false) }); }
    catch (e) { throw new TransientError(`result: ${(e as Error).message}`); }
    const detail = `result ${res.status}: ${res.ok ? "" : await body(res)}`;
    if (res.ok) {
      const j = (await res.json().catch(() => ({}))) as any;
      const url = j?.video?.url;
      return typeof url === "string" && url.startsWith("https://")
        ? { ok: true, videoUrl: url }
        : { ok: false, kind: "failed", detail: "result without a video url" };
    }
    if (res.status === 400) throw new TransientError(detail); // still in progress
    if (res.status === 404) return { ok: false, kind: "expired", detail };
    if (res.status === 422) return { ok: false, kind: "rejected", detail };
    if (res.status === 499) return { ok: false, kind: "cancelled", detail };
    if (res.status === 500 || res.status === 504) return { ok: false, kind: "failed", detail };
    throw new TransientError(detail);
  },

  async download(url: string, dest: string) {
    let res: Response;
    try { res = await fetch(url); }
    catch (e) { throw new TransientError(`download: ${(e as Error).message}`); }
    if (!res.ok || !res.body) throw new TransientError(`download ${res.status}`);
    const tmp = `${dest}.part`;
    await pipeline(Readable.fromWeb(res.body as any), createWriteStream(tmp));
    await rename(tmp, dest);
  },
};
