"""Replay every call script's expected functions against the mock core.

For each script in fixtures/calls/<agency>/, this sends the API calls the voice
agent would make (in the script's order, with the script's arguments) to a mock
started in-process, and checks the answers make sense for that script:

- identify_caller: a returning caller (matrix says so) is matched, others are new
- find_listing: a wrong reference finds nothing; otherwise the results include
  a listing the script talks about
- get_duty_agent: office open or closed exactly as the script says, at the
  script's local time
- book_callback: the due time is after the call and inside office hours, and
  a preferred agent or language is honoured
- request_viewing: the preferred agent or language is honoured
- notify_agent: the script's 5-line agent summary is valid (5 lines, each at
  most 160 characters, as the contract requires)
- every request passes the contract schemas (the mock refuses anything else)

transfer_call is handled by the voice platform, not the core, so it is skipped.

Run:  python3 voice/mock_core/test_scripts_against_mock.py
"""

import datetime
import json
import pathlib
import re
import sys
import threading
import unittest
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "fixtures" / "calls"))

import server  # noqa: E402
import check_calls  # noqa: E402

CALLS = ROOT / "fixtures" / "calls"


class Client:
    def __init__(self, base):
        self.base = base

    def call(self, method, path, body=None, now=None):
        headers = {"Content-Type": "application/json", "X-Api-Key": "test"}
        if now:
            headers["X-Mock-Now"] = now
        req = urllib.request.Request(self.base + path, method=method, headers=headers,
                                     data=None if body is None else json.dumps(body).encode())
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())


def agent_summary(body):
    m = re.search(r"## Agent summary[^\n]*\n(.*?)(\n## |\Z)", body, re.S)
    if not m:
        return None
    return [re.sub(r"^\d+\.\s*", "", line).strip() for line in m.group(1).splitlines() if re.match(r"^\d+\.", line.strip())]


def scripts():
    for folder in sorted(p for p in CALLS.iterdir() if p.is_dir()):
        for path in sorted(folder.glob("[0-9][0-9]-*.md")):
            meta, body = check_calls.parse_front_matter(path)
            yield folder.name, path, meta, body


class ScriptsAgainstMock(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.api = Client(f"http://127.0.0.1:{cls.httpd.server_address[1]}/v2")

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def replay(self, agency_id, path, meta, body):
        server.STORE.reset()
        agency = server.STORE.agencies[agency_id]
        name = f"{agency_id}/{path.name}"
        now = meta["call_time_local"]
        call_dt = datetime.datetime.strptime(now, "%Y-%m-%dT%H:%M")
        unknown = set(meta.get("unknown_refs", []))
        lead_id = None
        lang = meta.get("start_language", meta["language"])

        for item in meta["expected_functions"]:
            (fn, args), = item.items()
            args = dict(args or {})
            with self.subTest(script=name, function=fn, args=args):
                if fn == "identify_caller":
                    st, r = self.api.call("POST", "/leads/upsert", {
                        "agency_id": agency_id, "channel": "phone", "phone": meta["caller_number"], "language": lang})
                    self.assertEqual(st, 200, r)
                    lead_id = r["lead_id"]
                    returning = any("returning caller" in m for m in meta["matrix"])
                    self.assertEqual(r["is_new"], not returning, "returning-caller expectation")
                    self.assertFalse(r["opted_out"])

                elif fn == "find_listing":
                    st, r = self.api.call("POST", "/listings/search", dict(args, agency_id=agency_id))
                    self.assertEqual(st, 200, r)
                    refs = [x["ref"] for x in r["results"]]
                    if args.get("ref") in unknown:
                        self.assertEqual(refs, [], "a wrong reference must find nothing")
                    else:
                        self.assertTrue(set(refs) & set(meta["listings"]),
                                        f"search returned {refs}, none of the script's listings {meta['listings']}")

                elif fn == "save_answers":
                    st, r = self.api.call("PATCH", f"/leads/{lead_id}", args)
                    self.assertEqual(st, 200, r)

                elif fn == "get_duty_agent":
                    st, r = self.api.call("GET", f"/agency/{agency_id}/duty", now=now)
                    self.assertEqual(st, 200, r)
                    self.assertEqual(r["office_open"], meta["office_open"], "office open/closed")

                elif fn == "request_viewing":
                    st, r = self.api.call("POST", "/viewings/request", dict(args, lead_id=lead_id, channel="phone"))
                    self.assertEqual(st, 201, r)
                    self.check_agent(agency, r["agent_id"], args)

                elif fn == "book_callback":
                    st, r = self.api.call("POST", "/callbacks", dict(args, lead_id=lead_id, channel="phone"), now=now)
                    self.assertEqual(st, 201, r)
                    due = datetime.datetime.strptime(r["due_local"], "%Y-%m-%dT%H:%M")
                    self.assertGreater(due, call_dt, "callback due before the call")
                    self.assertTrue(check_calls.office_open_at(agency, due), f"callback due {due:%a %H:%M} outside hours")
                    self.check_agent(agency, r["agent_id"], args)

                elif fn == "send_confirmation":
                    vars_ = {"listing_ref": args["listing_ref"]} if "listing_ref" in args else {}
                    st, r = self.api.call("POST", "/notify/lead", {
                        "lead_id": lead_id, "channel": args["channel"], "template": args["template"],
                        "language": args.get("language", meta["language"]), "vars": vars_})
                    self.assertEqual(st, 200, r)

                elif fn == "notify_agent":
                    lines = agent_summary(body)
                    self.assertIsNotNone(lines, "script has no agent summary")
                    payload = {"agency_id": agency_id, "lead_id": lead_id, "summary": lines,
                               "urgency": "normal", "source_channel": "phone"}
                    if "agent_id" in args:
                        payload["agent_id"] = args["agent_id"]
                    st, r = self.api.call("POST", "/notify/agent", payload)
                    self.assertEqual(st, 200, f"agent summary rejected by the contract: {r}")

                elif fn == "log_call":
                    st, r = self.api.call("POST", f"/leads/{lead_id}/events", {
                        "type": "call_ended", "channel": "phone", "at": "2026-12-01T00:00:00Z",
                        "payload": {"call_id": "test", "duration_s": 120, "outcome": meta["expected_outcome"],
                                    "transcript": "(test)", "language": meta["language"]}})
                    self.assertEqual(st, 201, r)

    def check_agent(self, agency, agent_id, args):
        if "preferred_agent_id" in args:
            self.assertEqual(agent_id, args["preferred_agent_id"], "preferred agent not honoured")
        elif "preferred_language" in args:
            speaks = next(a["speaks"] for a in agency["agents"] if a["agent_id"] == agent_id)
            self.assertIn(args["preferred_language"], speaks, "preferred language not honoured")

    def test_every_script(self):
        count = 0
        for agency_id, path, meta, body in scripts():
            self.replay(agency_id, path, meta, body)
            count += 1
        self.assertGreater(count, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
