"""Check the call scripts against the contract, the test agency and each other.

Run:  python3 fixtures/calls/check_calls.py

For every NN-*.md script it checks:
- the front matter has every required field, and the id matches the file number
- languages, phone numbers and times are in contract format
- office_open matches the agency's real office hours at call_time_local
- every block used exists in blocks.md
- every listing exists in fixtures/listings.json (except the ones in unknown_refs,
  which must NOT exist, because the script tests a wrong reference)
- every function is one the voice agent has, and its arguments use contract values
  (templates, channels, callback reasons and priorities, time of day, agents)
- transfers only happen while the office is open
- callback times fall inside office hours
- the outcome matches what the call did, and every call ends with something done
  (only a wrong number may end with nothing)
- across all scripts, every line of the phone test matrix is covered

Allowed values are read from the contract schemas, so this stays in step with them.
"""

import datetime
import json
import pathlib
import re
import sys

import yaml

HERE = pathlib.Path(__file__).resolve().parent
FIXTURES = HERE.parent
SCHEMAS = FIXTURES.parent / "contract" / "schemas"

REQUIRED_FIELDS = [
    "id", "title", "language", "caller_number", "call_time_local", "office_open",
    "matrix", "listings", "blocks", "expected_functions", "expected_outcome",
    "end_action", "pass_criteria", "must_not",
]

FUNCTIONS = {
    "identify_caller", "find_listing", "save_answers", "get_duty_agent", "request_viewing",
    "book_callback", "transfer_call", "take_message", "send_confirmation", "log_call",
    "notify_agent",
}

# The phone test matrix from the business plan. Every line must be covered by at least one script.
REQUIRED_MATRIX = [
    "launch language: en",
    "launch language: es",
    "launch language: de",
    "launch language: sv",
    "launch language: nl",
    "launch language: fr",
    "reference that does not exist",
    "sold listing",
    "strong accent, background noise, speaker phone",
    "seller asking for a valuation",
    "boundary topic: legal",
    "angry caller, must transfer",
    "transfer to an agent who does not answer",
    "silence",
    "hang-up mid-call",
    "wrong number",
    "language switch mid-call",
]

# Outcomes that count as "something was done" at the end of the call.
ACTIONS = {"request_viewing", "book_callback", "transfer_call", "take_message"}

failures = []


def fail(where, message):
    failures.append(f"{where}: {message}")


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def contract_values():
    common = load_json(SCHEMAS / "common.schema.json")["$defs"]
    api = load_json(SCHEMAS / "api.schema.json")["$defs"]
    event = load_json(SCHEMAS / "event.schema.json")
    outcomes = None
    for rule in event["allOf"]:
        if rule["if"]["properties"]["type"].get("const") == "call_ended":
            outcomes = rule["then"]["properties"]["payload"]["properties"]["outcome"]["enum"]
    return {
        "voice_languages": set(common["voice_language"]["enum"]),
        "languages": set(common["language"]["enum"]),
        "phone": re.compile(common["phone"]["pattern"]),
        "templates": set(api["LeadNotifyRequest"]["properties"]["template"]["enum"]),
        "notify_channels": set(api["LeadNotifyRequest"]["properties"]["channel"]["enum"]),
        "callback_reasons": set(api["CallbackCreate"]["properties"]["reason"]["enum"]),
        "callback_priorities": set(api["CallbackCreate"]["properties"]["priority"]["enum"]),
        "times_of_day": set(api["ViewingRequestCreate"]["properties"]["time_of_day"]["enum"]),
        "outcomes": set(outcomes),
    }


def office_open_at(agency, local):
    day = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][local.weekday()]
    hhmm = local.strftime("%H:%M")
    return any(start <= hhmm < end for start, end in agency["office_hours"][day])


def parse_front_matter(path):
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not match:
        fail(path.name, "no front matter between --- lines")
        return None, text
    return yaml.safe_load(match.group(1)), text[match.end():]


def check_script(path, meta, body, v, agency, listings, block_ids):
    name = path.name
    for field in REQUIRED_FIELDS:
        if field not in meta:
            fail(name, f"missing field {field}")
    if any(f not in meta for f in REQUIRED_FIELDS):
        return

    number = name.split("-")[0]
    if meta["id"] != f"call-{number}":
        fail(name, f"id {meta['id']} should be call-{number}")

    if meta["language"] not in v["voice_languages"]:
        fail(name, f"language {meta['language']} is not a voice language")
    if "start_language" in meta and meta["start_language"] not in v["languages"]:
        fail(name, f"start_language {meta['start_language']} is not a contract language")
    if not v["phone"].match(meta["caller_number"]):
        fail(name, f"caller_number {meta['caller_number']} is not E.164")

    try:
        local = datetime.datetime.strptime(meta["call_time_local"], "%Y-%m-%dT%H:%M")
    except ValueError:
        fail(name, "call_time_local must look like 2026-12-08T21:04")
        return
    actually_open = office_open_at(agency, local)
    if meta["office_open"] != actually_open:
        fail(name, f"office_open is {meta['office_open']}, but agency hours say {actually_open} at {local:%a %H:%M}")

    for block in meta["blocks"]:
        if block not in block_ids:
            fail(name, f"block {block} is not in blocks.md")
    for block in set(re.findall(r"\bB\d{2}\b", body)):
        if block not in block_ids:
            fail(name, f"the script mentions {block}, which is not in blocks.md")

    unknown = set(meta.get("unknown_refs", []))
    for ref in unknown:
        if ref in listings:
            fail(name, f"unknown_refs lists {ref}, but it exists in listings.json")
    for ref in meta["listings"]:
        if ref not in listings:
            fail(name, f"listing {ref} is not in fixtures/listings.json")

    def check_ref(ref, where):
        if ref not in listings and ref not in unknown:
            fail(name, f"{where} uses {ref}, which is not in listings.json or unknown_refs")

    agent_ids = {a["agent_id"] for a in agency["agents"]}
    called = []
    for item in meta["expected_functions"]:
        if not isinstance(item, dict) or len(item) != 1:
            fail(name, f"each expected function must be a one-key map, got {item!r}")
            continue
        (fn, args), = item.items()
        args = args or {}
        called.append(fn)
        if fn not in FUNCTIONS:
            fail(name, f"unknown function {fn}")
            continue
        for key in ("ref", "listing_ref"):
            if key in args:
                check_ref(args[key], fn)
        for ref in args.get("add_listing_refs", []):
            check_ref(ref, fn)
        if "agent_id" in args and args["agent_id"] not in agent_ids:
            fail(name, f"{fn} names agent {args['agent_id']}, who is not in agency.json")
        if "language" in args and args["language"] not in v["languages"]:
            fail(name, f"{fn} language {args['language']} is not a contract language")
        if fn == "send_confirmation":
            if args.get("template") not in v["templates"]:
                fail(name, f"template {args.get('template')} is not in the contract")
            if args.get("channel") not in v["notify_channels"]:
                fail(name, f"channel {args.get('channel')} is not in the contract")
            if args.get("template") == "listing_link" and "listing_ref" not in args:
                fail(name, "listing_link needs a listing_ref")
        if fn == "book_callback":
            if args.get("reason") not in v["callback_reasons"]:
                fail(name, f"callback reason {args.get('reason')} is not in the contract")
            if args.get("priority") not in v["callback_priorities"]:
                fail(name, f"callback priority {args.get('priority')} is not in the contract")
            when = args.get("preferred_time")
            if when is not None:
                due = datetime.datetime.strptime(when, "%Y-%m-%dT%H:%M")
                if not office_open_at(agency, due):
                    fail(name, f"callback at {due:%a %H:%M} is outside office hours")
                if due <= local:
                    fail(name, "callback time is before the call")
        if fn == "request_viewing":
            if args.get("time_of_day", "any") not in v["times_of_day"]:
                fail(name, f"time_of_day {args.get('time_of_day')} is not in the contract")
            for day in args.get("preferred_days", []):
                if datetime.date.fromisoformat(day) <= local.date():
                    fail(name, f"viewing day {day} is not after the call")
        if fn == "transfer_call" and not actually_open:
            fail(name, "transfer_call while the office is closed (B10 forbids it)")

    outcome = meta["expected_outcome"]
    if outcome not in v["outcomes"]:
        fail(name, f"outcome {outcome} is not a call_ended outcome in the contract")
    needs = {
        "viewing_requested": "request_viewing",
        "callback_booked": "book_callback",
        "transferred": "transfer_call",
        "message_taken": "take_message",
    }
    if outcome in needs and needs[outcome] not in called:
        fail(name, f"outcome {outcome} but no {needs[outcome]} call")
    if "log_call" not in called:
        fail(name, "every call must end with log_call")
    if outcome == "wrong_number":
        if "notify_agent" in called:
            fail(name, "wrong numbers must not notify agents")
    elif not (ACTIONS & set(called) or any(
        isinstance(i, dict) and "send_confirmation" in i and (i["send_confirmation"] or {}).get("template") == "listing_link"
        for i in meta["expected_functions"]
    )):
        fail(name, "the call ends without anything done (viewing, callback, transfer, message or listings sent)")
    if not str(meta["end_action"]).strip():
        fail(name, "end_action is empty")

    for heading in ("## The caller", "## The call", "## Branches to try"):
        if heading not in body:
            fail(name, f"missing section '{heading}'")


def main():
    v = contract_values()
    agency = load_json(FIXTURES / "agency.json")
    listings = {item["ref"]: item for item in load_json(FIXTURES / "listings.json")}
    block_ids = set(re.findall(r"^## (B\d{2}) ", (HERE / "blocks.md").read_text(encoding="utf-8"), re.M))
    if not block_ids:
        fail("blocks.md", "no blocks found (headings must look like '## B01 Open')")

    scripts = sorted(p for p in HERE.glob("*.md") if re.match(r"^\d{2}-", p.name))
    covered = []
    ids = set()
    for path in scripts:
        meta, body = parse_front_matter(path)
        if meta is None:
            continue
        if meta.get("id") in ids:
            fail(path.name, f"duplicate id {meta.get('id')}")
        ids.add(meta.get("id"))
        check_script(path, meta, body, v, agency, listings, block_ids)
        covered.extend(meta.get("matrix", []))

    for line in REQUIRED_MATRIX:
        if not any(c.startswith(line) for c in covered):
            fail("matrix", f"no script covers '{line}'")

    if failures:
        print(f"FAILED: {len(failures)} problem(s)")
        for f in failures:
            print("  -", f)
        sys.exit(1)
    print(f"OK: {len(scripts)} call scripts, {len(block_ids)} blocks, all {len(REQUIRED_MATRIX)} matrix lines covered")


if __name__ == "__main__":
    main()
