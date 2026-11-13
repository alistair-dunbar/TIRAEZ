"""Mock of Part A's core API (contract v2), for building and testing Part B before join 1.

It serves the three test agencies in fixtures/agencies/, keeps leads, events,
viewing requests, callbacks and messages in memory, and checks every request
against the contract schemas, so a wrong call from the voice agent fails here
first instead of at join 1.

Run:
    pip install -r contract/tests/requirements.txt
    python3 voice/mock_core/server.py              # http://localhost:8787/v2

Environment variables:
    MOCK_PORT        port to listen on (default 8787)
    MOCK_API_KEYS    comma-separated keys accepted in X-Api-Key (default "test")
    MOCK_DELAY_MS    added delay on every request, to rehearse slow responses (default 0)
    MOCK_FEED_AGE_H  feed_age_hours reported by listing searches (default 0.5; set 30 to test stale feeds)

Test helpers (not part of the contract):
    X-Mock-Now: 2026-12-11T13:20   pretend the agency's local time is this, for /duty and callbacks
    X-Mock-Fail: 500 | 503 | 429   make this one request fail, to test the voice agent's fallbacks
    GET  /_mock/log                every request received, in order, with bodies (compare with a script's expected_functions)
    GET  /_mock/outbox             every notification "sent" to agents and leads
    POST /_mock/reset              back to the seeded state
"""

import datetime
import json
import os
import pathlib
import secrets
import sys
import threading
import time
import zoneinfo
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "contract" / "tests"))
import validate as contract  # noqa: E402  (reuses the contract's schema loading)

AGENCIES_DIR = ROOT / "fixtures" / "agencies"
VERSION = "2.1.0"
CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

PORT = int(os.environ.get("MOCK_PORT", "8787"))
API_KEYS = {k.strip() for k in os.environ.get("MOCK_API_KEYS", "test").split(",") if k.strip()}
DELAY_S = int(os.environ.get("MOCK_DELAY_MS", "0")) / 1000
FEED_AGE_H = float(os.environ.get("MOCK_FEED_AGE_H", "0.5"))

REGISTRY = contract.load_registry()
SCHEMA = {
    "search": contract.validator_for("schemas/api.schema.json#/$defs/ListingSearchRequest", REGISTRY),
    "upsert": contract.validator_for("schemas/api.schema.json#/$defs/LeadUpsertRequest", REGISTRY),
    "patch": contract.validator_for("schemas/api.schema.json#/$defs/LeadPatchRequest", REGISTRY),
    "event": contract.validator_for("schemas/api.schema.json#/$defs/EventCreateRequest", REGISTRY),
    "viewing": contract.validator_for("schemas/api.schema.json#/$defs/ViewingRequestCreate", REGISTRY),
    "callback": contract.validator_for("schemas/api.schema.json#/$defs/CallbackCreate", REGISTRY),
    "notify_agent": contract.validator_for("schemas/api.schema.json#/$defs/AgentNotifyRequest", REGISTRY),
    "notify_lead": contract.validator_for("schemas/api.schema.json#/$defs/LeadNotifyRequest", REGISTRY),
}


def ulid(prefix):
    """A ULID-shaped id: 10 characters of time, 16 of randomness, Crockford base32."""
    ms = int(time.time() * 1000)
    t = "".join(CROCKFORD[(ms >> (5 * i)) & 31] for i in reversed(range(10)))
    r = "".join(secrets.choice(CROCKFORD) for _ in range(16))
    return f"{prefix}_{t}{r}"


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class ApiError(Exception):
    def __init__(self, status, code, message, retry_after_s=None):
        super().__init__(message)
        self.status, self.code, self.message, self.retry_after_s = status, code, message, retry_after_s


class Store:
    """All mock state. Seeded so the contract examples and the call scripts work."""

    def __init__(self):
        self.lock = threading.Lock()
        self.reset()

    def reset(self):
        self.agencies = {}
        self.listings = {}
        for folder in sorted(p for p in AGENCIES_DIR.iterdir() if p.is_dir()):
            agency = json.loads((folder / "agency.json").read_text(encoding="utf-8"))
            self.agencies[agency["agency_id"]] = agency
            self.listings[agency["agency_id"]] = json.loads((folder / "listings.json").read_text(encoding="utf-8"))
        self.leads, self.events = {}, {}
        self.viewings, self.callbacks, self.outbox, self.log = [], [], [], []
        self._seed()

    def _lead(self, lead_id, agency_id, **fields):
        lead = {
            "lead_id": lead_id, "agency_id": agency_id, "name": None, "email": None, "phone": None,
            "language": "en", "intent": "unknown", "listing_refs": [], "budget_min": None, "budget_max": None,
            "timing": "unknown", "financing": "unknown", "travel_dates": None, "status": "new",
            "first_contact_at": utc_now(), "first_reply_at": None,
        }
        lead.update(fields)
        self.leads[lead_id] = lead
        self.events[lead_id] = []
        return lead

    def _seed(self):
        # The lead the examples 11, 13, 15, 17 and 18 refer to by id. No phone on it, so a
        # caller from +4915112345678 (Spain call 01, example 09) is still a first-time caller.
        self._lead("lead_01JD8Z6K3M4XQ7R2S5T8V9W0YA", "costa-test-homes",
                   language="de", first_contact_at="2026-12-08T20:04:00Z", first_reply_at="2026-12-08T20:04:02Z")
        # Karin Ekström (Spain call 02, examples 10, 12, 16, 20, 21): emailed the night before.
        karin = "lead_01JD8Z7B2N5YR8S3T6V9W1X4ZB"
        self._lead(karin, "costa-test-homes", phone="+46701234567", language="sv", intent="buyer",
                   listing_refs=["CTH-1234"], status="qualifying",
                   first_contact_at="2026-12-08T22:10:41Z", first_reply_at="2026-12-08T22:11:20Z")
        self.events[karin] += [
            {"event_id": ulid("evt"), "type": "message_in", "channel": "portal", "at": "2026-12-08T22:10:41Z",
             "payload": {"text": "Hej! Är villan CTH-1234 fortfarande till salu?", "language": "sv", "source": "idealista"},
             "line": "Enquiry from Idealista about CTH-1234, in Swedish."},
            {"event_id": ulid("evt"), "type": "message_out", "channel": "email", "at": "2026-12-08T22:11:20Z",
             "payload": {"text": "(AI reply in Swedish)", "language": "sv"},
             "line": "AI replied in Swedish about CTH-1234 and asked about timing."},
        ]
        # A lead who opted out (example 19).
        self._lead("lead_01JF2B4C6D8E0G2H4J6K8M0N2P", "costa-test-homes", phone="+46709999999",
                   language="sv", status="opted_out")

    # ---------- helpers ----------

    def agency(self, agency_id):
        if agency_id not in self.agencies:
            raise ApiError(404, "agency_not_found", f"No agency {agency_id}.")
        return self.agencies[agency_id]

    def lead(self, lead_id):
        if lead_id not in self.leads:
            raise ApiError(404, "lead_not_found", f"No lead {lead_id}.")
        return self.leads[lead_id]

    @staticmethod
    def local_now(agency, override):
        if override:
            return datetime.datetime.strptime(override, "%Y-%m-%dT%H:%M")
        return datetime.datetime.now(zoneinfo.ZoneInfo(agency["timezone"])).replace(tzinfo=None, second=0, microsecond=0)

    @staticmethod
    def is_open(agency, local):
        hhmm = local.strftime("%H:%M")
        return any(a <= hhmm < b for a, b in agency["office_hours"][DAYS[local.weekday()]])

    @staticmethod
    def next_open(agency, local):
        for d in range(0, 8):
            day = local.date() + datetime.timedelta(days=d)
            for start, _ in agency["office_hours"][DAYS[day.weekday()]]:
                at = datetime.datetime.combine(day, datetime.time.fromisoformat(start))
                if at > local:
                    return at
        return None

    @staticmethod
    def pick_agent(agency, preferred_agent_id=None, preferred_language=None):
        """The fallback rule from contract 1.1: named agent, then a speaker of the language, then on duty."""
        agents = agency["agents"]
        if preferred_agent_id:
            for a in agents:
                if a["agent_id"] == preferred_agent_id:
                    return a
        if preferred_language:
            speakers = [a for a in agents if preferred_language in a["speaks"]]
            if speakers:
                return next((a for a in speakers if a["on_duty"]), speakers[0])
        return next(a for a in agents if a["on_duty"])

    def add_event(self, lead_id, event, line):
        stored = dict(event, event_id=ulid("evt"), line=line)
        self.events[lead_id].append(stored)
        return stored["event_id"]

    # ---------- endpoints ----------

    def duty(self, agency_id, now_override):
        agency = self.agency(agency_id)
        local = self.local_now(agency, now_override)
        open_now = self.is_open(agency, local)
        duty = next(a for a in agency["agents"] if a["on_duty"])
        nxt = None if open_now else self.next_open(agency, local)
        return {
            "agency_id": agency_id, "office_open": open_now, "now_local": local.strftime("%Y-%m-%dT%H:%M"),
            "duty_agent": {"agent_id": duty["agent_id"], "name": duty["name"], "mobile": duty["mobile"]},
            "next_open_local": nxt.strftime("%Y-%m-%dT%H:%M") if nxt else None,
        }

    def search(self, body):
        self.agency(body["agency_id"])
        include_all = body.get("include_unavailable", False)
        out = []
        for i, item in enumerate(self.listings[body["agency_id"]]):
            if "ref" in body:
                if item["ref"].upper() != body["ref"].upper():
                    continue
            else:
                if "town" in body and item["town"].lower() != body["town"].lower():
                    continue
                if "area" in body and item["area"].lower() != body["area"].lower():
                    continue
                if "type" in body and item["type"] != body["type"]:
                    continue
                if "price_min" in body and item["price"] < body["price_min"]:
                    continue
                if "price_max" in body and item["price"] > body["price_max"]:
                    continue
                if "beds" in body and item["beds"] < body["beds"]:
                    continue
            if item["status"] != "available" and not include_all and "ref" not in body:
                continue
            out.append((item["status"] != "available", i, item))
        out.sort(key=lambda x: (x[0], x[1]))
        return {"results": [x[2] for x in out[: body.get("limit", 3)]], "feed_age_hours": FEED_AGE_H}

    def upsert(self, body):
        self.agency(body["agency_id"])
        for lead in self.leads.values():
            if lead["agency_id"] != body["agency_id"]:
                continue
            if (body.get("phone") and lead["phone"] == body["phone"]) or (body.get("email") and lead["email"] == body["email"]):
                for k in ("name", "email", "phone"):
                    if body.get(k) and not lead[k]:
                        lead[k] = body[k]
                lead["language"] = body["language"]
                history = sorted(self.events[lead["lead_id"]], key=lambda e: e["at"], reverse=True)[:3]
                return {"lead_id": lead["lead_id"], "is_new": False, "opted_out": lead["status"] == "opted_out",
                        "history": [{"at": e["at"], "channel": e["channel"], "line": e["line"]} for e in history]}
        lead = self._lead(ulid("lead"), body["agency_id"], name=body.get("name"), email=body.get("email"),
                          phone=body.get("phone"), language=body["language"],
                          first_contact_at=body.get("contact_at", utc_now()))
        if body.get("listing_ref"):
            lead["listing_refs"].append(body["listing_ref"])
        return {"lead_id": lead["lead_id"], "is_new": True, "opted_out": False, "history": []}

    def patch(self, lead_id, body):
        lead = self.lead(lead_id)
        for k, v in body.items():
            if k == "add_listing_refs":
                lead["listing_refs"] += [r for r in v if r not in lead["listing_refs"]]
            else:
                lead[k] = v
        return lead

    def event(self, lead_id, body):
        lead = self.lead(lead_id)
        if body["type"] == "opt_out":
            lead["status"] = "opted_out"
        if body["type"] == "message_out" and lead["first_reply_at"] is None:
            lead["first_reply_at"] = body["at"]
        p = body["payload"]
        line = {
            "call_ended": f"Call ended: {p.get('outcome')} ({p.get('duration_s')} s, {p.get('language')}).",
            "message_in": f"Message in by {body['channel']} ({p.get('language')}).",
            "message_out": f"Reply sent by {body['channel']} ({p.get('language')}).",
            "handoff": f"Handed off: {p.get('topic')}.",
        }.get(body["type"], body["type"].replace("_", " ").capitalize() + ".")
        return {"event_id": self.add_event(lead_id, body, line)}

    def viewing(self, body):
        lead = self.lead(body["lead_id"])
        agency = self.agency(lead["agency_id"])
        if not any(i["ref"] == body["listing_ref"] for i in self.listings[agency["agency_id"]]):
            raise ApiError(404, "listing_not_found", f"No listing {body['listing_ref']}.")
        agent = self.pick_agent(agency, body.get("preferred_agent_id"), body.get("preferred_language"))
        rid = ulid("vrq")
        self.viewings.append(dict(body, request_id=rid, agent_id=agent["agent_id"]))
        lead["status"] = "viewing_requested"
        if body["listing_ref"] not in lead["listing_refs"]:
            lead["listing_refs"].append(body["listing_ref"])
        self.add_event(body["lead_id"], {"type": "viewing_request", "channel": body["channel"], "at": utc_now(), "payload": body},
                       f"Viewing requested for {body['listing_ref']} on {', '.join(body['preferred_days'])}.")
        return {"request_id": rid, "status": "pending_agent_confirmation", "agent_id": agent["agent_id"]}

    def callback(self, body, now_override):
        lead = self.lead(body["lead_id"])
        agency = self.agency(lead["agency_id"])
        agent = self.pick_agent(agency, body.get("preferred_agent_id"), body.get("preferred_language"))
        due = body.get("preferred_time")
        if not due:
            local = self.local_now(agency, now_override)
            nxt = local if self.is_open(agency, local) else self.next_open(agency, local)
            due = nxt.strftime("%Y-%m-%dT%H:%M")
        cid = ulid("cbk")
        self.callbacks.append(dict(body, callback_id=cid, agent_id=agent["agent_id"], due_local=due))
        lead["status"] = "callback"
        self.add_event(body["lead_id"], {"type": "callback_request", "channel": body["channel"], "at": utc_now(), "payload": body},
                       f"Callback booked for {due} ({body['priority']}).")
        return {"callback_id": cid, "agent_id": agent["agent_id"], "due_local": due}

    def notify_agent(self, body):
        agency = self.agency(body["agency_id"])
        self.lead(body["lead_id"])
        agent = self.pick_agent(agency, body.get("agent_id"))
        sent = ["email"] + (["whatsapp"] if agency["channels"]["whatsapp"] else [])
        self.outbox.append({"to": "agent", "agent_id": agent["agent_id"], "language": agent["summary_language"],
                            "channels": sent, "summary": body["summary"], "urgency": body["urgency"]})
        return {"sent_to": sent}

    def notify_lead(self, body):
        lead = self.lead(body["lead_id"])
        agency = self.agency(lead["agency_id"])
        if lead["status"] == "opted_out":
            raise ApiError(409, "lead_opted_out", "This lead opted out. Nothing was sent.")
        if body["channel"] == "whatsapp" and not agency["channels"]["whatsapp"]:
            raise ApiError(503, "channel_unavailable", "WhatsApp is not set up for this agency.")
        if body["channel"] == "email" and not lead["email"]:
            raise ApiError(400, "bad_request", "This lead has no email address. Save it with PATCH first.")
        mid = ulid("msg")
        self.outbox.append({"to": "lead", "lead_id": lead["lead_id"], "message_id": mid, **body})
        return {"message_id": mid, "channel": body["channel"]}


STORE = Store()


class Handler(BaseHTTPRequestHandler):
    server_version = "TiraezMockCore/" + VERSION

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path))

    def send(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return None
        try:
            return json.loads(self.rfile.read(n))
        except json.JSONDecodeError:
            raise ApiError(400, "bad_request", "Body is not valid JSON.")

    @staticmethod
    def check(schema, body):
        if body is None:
            raise ApiError(400, "bad_request", "A JSON body is required.")
        errs = contract.errors_of(SCHEMA[schema], body)
        if errs:
            raise ApiError(400, "bad_request", "; ".join(errs[:3]))

    def handle_any(self):
        path = urlparse(self.path).path.rstrip("/")
        try:
            body = self.body()
        except ApiError as e:
            return self.send(e.status, {"error": {"code": e.code, "message": e.message}})

        if path.startswith("/_mock/"):
            with STORE.lock:
                if path == "/_mock/log":
                    return self.send(200, STORE.log)
                if path == "/_mock/outbox":
                    return self.send(200, STORE.outbox)
                if path == "/_mock/reset" and self.command == "POST":
                    STORE.reset()
                    return self.send(200, {"reset": True})
            return self.send(404, {"error": {"code": "bad_request", "message": "Unknown mock helper."}})

        if DELAY_S:
            time.sleep(DELAY_S)
        with STORE.lock:
            STORE.log.append({"at": utc_now(), "method": self.command, "path": path, "body": body})
        try:
            if not path.startswith("/v2"):
                raise ApiError(404, "bad_request", "Use the /v2 base path.")
            route = path[3:]
            if route == "/health" and self.command == "GET":
                return self.send(200, {"status": "ok", "version": VERSION})
            if self.headers.get("X-Api-Key") not in API_KEYS:
                raise ApiError(401, "unauthorized", "Missing or wrong X-Api-Key.")
            fail = self.headers.get("X-Mock-Fail")
            if fail:
                code = {"429": "rate_limited", "503": "channel_unavailable"}.get(fail, "internal")
                raise ApiError(int(fail), code, "Failure injected by X-Mock-Fail.", 5 if fail == "429" else None)
            now = self.headers.get("X-Mock-Now")
            parts = route.strip("/").split("/")
            with STORE.lock:
                result = self.route(parts, body, now)
            return self.send(*result)
        except ApiError as e:
            err = {"code": e.code, "message": e.message}
            if e.retry_after_s:
                err["retry_after_s"] = e.retry_after_s
            return self.send(e.status, {"error": err})
        except Exception as e:  # a bug in the mock: report it in contract format
            return self.send(500, {"error": {"code": "internal", "message": f"Mock error: {e!r}"}})

    def route(self, parts, body, now):
        m = self.command
        if m == "GET" and len(parts) == 2 and parts[0] == "agency":
            return 200, STORE.agency(parts[1])
        if m == "GET" and len(parts) == 3 and parts[0] == "agency" and parts[2] == "duty":
            return 200, STORE.duty(parts[1], now)
        if m == "POST" and parts == ["listings", "search"]:
            self.check("search", body)
            return 200, STORE.search(body)
        if m == "POST" and parts == ["leads", "upsert"]:
            self.check("upsert", body)
            return 200, STORE.upsert(body)
        if m == "PATCH" and len(parts) == 2 and parts[0] == "leads":
            self.check("patch", body)
            return 200, STORE.patch(parts[1], body)
        if m == "POST" and len(parts) == 3 and parts[0] == "leads" and parts[2] == "events":
            self.check("event", body)
            return 201, STORE.event(parts[1], body)
        if m == "POST" and parts == ["viewings", "request"]:
            self.check("viewing", body)
            return 201, STORE.viewing(body)
        if m == "POST" and parts == ["callbacks"]:
            self.check("callback", body)
            return 201, STORE.callback(body, now)
        if m == "POST" and parts == ["notify", "agent"]:
            self.check("notify_agent", body)
            return 200, STORE.notify_agent(body)
        if m == "POST" and parts == ["notify", "lead"]:
            self.check("notify_lead", body)
            return 200, STORE.notify_lead(body)
        raise ApiError(404, "bad_request", f"No endpoint {m} /{'/'.join(parts)}.")

    do_GET = do_POST = do_PATCH = handle_any


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Mock core v{VERSION} on http://localhost:{PORT}/v2 "
          f"({len(STORE.agencies)} agencies, keys: {', '.join(sorted(API_KEYS))})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
