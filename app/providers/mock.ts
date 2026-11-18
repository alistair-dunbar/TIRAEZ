// Test-only provider. It refuses to load outside NODE_ENV=test, so it can never stand in for a
// real generation in front of a customer. Its "videos" are ffmpeg test patterns made on the spot.
import { ASPECT_RATIOS } from "../catalog.ts";
import { testClip } from "../media.ts";
import { TransientError, type JobRef, type VideoProvider } from "./types.ts";

export interface MockScript {
  submit: Array<"ok" | "rejected" | "busy" | "not_sent" | "unconfirmed" | "config">;
  statusErrors: number;          // transient failures before status works
  states: Array<"IN_QUEUE" | "IN_PROGRESS" | "COMPLETED">;
  result: "ok" | "rejected" | "failed" | "expired";
  downloadErrors: number;
  uploads: number;
  submits: number;
}

export const mockScript: MockScript = fresh();
function fresh(): MockScript {
  return { submit: [], statusErrors: 0, states: [], result: "ok", downloadErrors: 0, uploads: 0, submits: 0 };
}
export function resetMock(): void { Object.assign(mockScript, fresh()); }

const progress = new Map<string, number>();

export const mock: VideoProvider = {
  name: "mock",
  ready() {
    if (process.env.NODE_ENV !== "test") throw new Error("The mock provider only runs in tests");
    return true;
  },
  async uploadImage() { mockScript.uploads++; return "https://mock.invalid/input.jpg"; },
  async submit() {
    mockScript.submits++;
    const next = mockScript.submit.shift() ?? "ok";
    if (next !== "ok") return { ok: false, kind: next, detail: `mock ${next}` } as any;
    const id = `req_${mockScript.submits}_${Date.now()}`;
    progress.set(id, 0);
    return { ok: true, requestId: id, statusUrl: `mock://${id}/status`, responseUrl: `mock://${id}` };
  },
  async status(job: JobRef) {
    if (mockScript.statusErrors > 0) { mockScript.statusErrors--; throw new TransientError("mock status unavailable"); }
    if (!progress.has(job.requestId)) return { lost: true };
    const states = mockScript.states.length ? mockScript.states : ["IN_QUEUE", "IN_PROGRESS", "COMPLETED"] as const;
    const i = progress.get(job.requestId)!;
    progress.set(job.requestId, Math.min(i + 1, states.length - 1));
    return { state: states[Math.min(i, states.length - 1)], queuePosition: states[i] === "IN_QUEUE" ? 2 : null };
  },
  async result() {
    const r = mockScript.result;
    return r === "ok" ? { ok: true, videoUrl: "https://mock.invalid/output.mp4" } : { ok: false, kind: r, detail: `mock ${r}` };
  },
  async download(_url, dest, job) {
    if (mockScript.downloadErrors > 0) { mockScript.downloadErrors--; throw new TransientError("mock download failed"); }
    const ratio = ASPECT_RATIOS[job.settings.aspectRatio] ?? 1;
    const h = 320, w = 2 * Math.round((h * ratio) / 2);
    await testClip(dest, w, h, Math.min(job.settings.duration, 2));
  },
};
