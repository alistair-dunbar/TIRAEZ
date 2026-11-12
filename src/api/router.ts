// Core API, contract v1. Four endpoints plus /health. See contract/README.md.
import { timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import type { CoreStore } from "./store.ts";
import { validate } from "./validate.ts";

export const CONTRACT_VERSION = "1.0";
/** tz_<test|live>_<client>_<24 hex chars>, e.g. tz_test_voice_000000000000000000000000 */
export const API_KEY_PATTERN = /^tz_(test|live)_[a-z]+_[0-9a-f]{24}$/;

export interface ApiOptions {
  store: CoreStore;
  apiKeys: string[];
  /** Called after each request with its duration, for the request-time log. */
  onRequest?: (info: { method: string; path: string; status: number; ms: number }) => void;
}

function fail(res: Response, status: number, code: string, message: string, details?: string[]) {
  res.status(status).json({ error: { code, message, ...(details?.length ? { details } : {}) } });
}

function keyMatches(given: string, keys: string[]): boolean {
  const a = Buffer.from(given);
  return keys.some((k) => {
    const b = Buffer.from(k);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export function createApiRouter(opts: ApiOptions): Router {
  const { store } = opts;
  const router = express.Router();
  router.use(express.json({ limit: "200kb" }));

  router.use((req: Request, res: Response, next: NextFunction) => {
    const started = performance.now();
    res.on("finish", () => {
      opts.onRequest?.({ method: req.method, path: req.path, status: res.statusCode, ms: Math.round(performance.now() - started) });
    });
    next();
  });

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", contract_version: CONTRACT_VERSION });
  });

  // Everything below needs "Authorization: Bearer <api key>".
  router.use((req, res, next) => {
    const header = req.get("authorization") ?? "";
    const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!key) return fail(res, 401, "unauthorized", "Missing API key. Send 'Authorization: Bearer <key>'.");
    if (!keyMatches(key, opts.apiKeys)) return fail(res, 401, "unauthorized", "Invalid API key.");
    next();
  });

  router.get("/agency/:id", async (req, res) => {
    const agency = await store.getAgency(String(req.params.id));
    if (!agency) return fail(res, 404, "not_found", `No agency with id "${req.params.id}".`);
    res.json(agency);
  });

  router.post("/listings/search", async (req, res) => {
    const problems = validate("listings-search.request.json", req.body);
    if (problems.length) return fail(res, 400, "invalid_request", "The request body is not valid.", problems);
    if (!(await store.getAgency(req.body.agency_id))) {
      return fail(res, 404, "not_found", `No agency with id "${req.body.agency_id}".`);
    }
    res.json(await store.searchListings(req.body));
  });

  router.post("/leads/upsert", async (req, res) => {
    const problems = validate("leads-upsert.request.json", req.body);
    if (problems.length) return fail(res, 400, "invalid_request", "The request body is not valid.", problems);
    if (!req.body.email && !req.body.phone) {
      return fail(res, 400, "invalid_request", "A lead needs an email or a phone number.");
    }
    if (!(await store.getAgency(req.body.agency_id))) {
      return fail(res, 404, "not_found", `No agency with id "${req.body.agency_id}".`);
    }
    const { lead, created } = await store.upsertLead(req.body);
    res.status(created ? 201 : 200).json({ lead_id: lead.id, created, lead });
  });

  router.post("/leads/:id/events", async (req, res) => {
    const problems = validate("leads-events.request.json", req.body);
    if (problems.length) return fail(res, 400, "invalid_request", "The request body is not valid.", problems);
    const event = await store.addEvent(String(req.params.id), req.body);
    if (!event) return fail(res, 404, "not_found", `No lead with id "${req.params.id}".`);
    res.status(201).json({ event_id: event.id, lead_id: event.lead_id, event });
  });

  router.use((_req, res) => fail(res, 404, "not_found", "No such endpoint in contract v1."));

  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const badJson = err instanceof SyntaxError;
    if (!badJson) console.error("[api]", err);
    fail(res, badJson ? 400 : 500, badJson ? "invalid_request" : "server_error", badJson ? "The request body is not valid JSON." : "Unexpected server error.");
  });

  return router;
}
