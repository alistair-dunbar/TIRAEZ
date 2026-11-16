// The provider adapter: the rest of the service talks to video models only through this.
import type { ModelConfig } from "../config.ts";

/** A failure worth retrying later (network trouble, a 5xx while checking status). */
export class TransientError extends Error {}

export interface SubmitInput { imageUrl: string; prompt: string; duration: number; resolution: string }

export type SubmitResult =
  | { ok: true; requestId: string; statusUrl: string; responseUrl: string }
  /** rejected: the provider refused the input. config: our setup is wrong (key, endpoint). */
  | { ok: false; kind: "rejected" | "config"; detail: string }
  /** busy / not_sent: certainly not accepted, so it is safe to try again. */
  | { ok: false; kind: "busy" | "not_sent"; detail: string }
  /** unconfirmed: it may have been accepted (and billed). Never resubmitted automatically. */
  | { ok: false; kind: "unconfirmed"; detail: string };

export interface StatusResult { state: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED"; queuePosition: number | null }

export type ResultOutcome =
  | { ok: true; videoUrl: string }
  | { ok: false; kind: "rejected" | "failed" | "cancelled" | "expired" | "lost"; detail: string };

export interface JobRef { requestId: string; statusUrl: string; responseUrl: string; settings: { aspectRatio: string; duration: number } }

export interface VideoProvider {
  name: string;
  /** True when credentials are configured. Says nothing about whether the provider is up. */
  ready(): boolean;
  uploadImage(bytes: Buffer, mime: string, fileName: string): Promise<string>;
  submit(model: ModelConfig, input: SubmitInput): Promise<SubmitResult>;
  /** Throws TransientError when the status can't be read right now; "lost" when the request is unknown. */
  status(job: JobRef): Promise<StatusResult | { lost: true }>;
  result(job: JobRef): Promise<ResultOutcome>;
  download(url: string, dest: string, job: JobRef): Promise<void>;
}
