"""Contract tests shared by Part A and Part B.

Static mode (no server, runs in CI on every push):
    python3 contract/tests/validate.py

    - every schema is valid JSON Schema 2020-12
    - every test agency in fixtures/agencies/ matches the schemas, and its own
      rules: one on-duty agent, a disclosure line (and legal_footer line, if set) for every language, voice
      languages offered in text too, listings in the agency's own currency
    - every endpoint in openapi.yaml has at least one success example
    - every example's request and response match the schemas for its status
    - listings inside example responses are identical to the fixture listings

Live mode (against Part A's API, or Part B's mock):
    python3 contract/tests/validate.py --base-url http://localhost:8787/v2 --api-key test
    python3 contract/tests/validate.py --base-url https://staging.core.tiraez.com/v2 --api-key $KEY --include-stateful

    Sends each example request and checks the status code and that the response
    matches the schema. Values are not compared, because a real server returns
    its own IDs and times. Examples that need existing leads (paths or bodies
    with lead IDs) only run with --include-stateful, against a server seeded
    with the example leads (the mock should be).
"""

import argparse
import http.client
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "contract"
SCHEMAS = CONTRACT / "schemas"
EXAMPLES = CONTRACT / "examples"
FIXTURES = ROOT / "fixtures"
AGENCIES = FIXTURES / "agencies"
BASE_ID = "https://contract.tiraez.invalid/v2/"

failures = []


def fail(where, message):
    failures.append(f"{where}: {message}")


def load_registry():
    resources = []
    for path in sorted(SCHEMAS.glob("*.schema.json")):
        schema = json.loads(path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        if schema.get("$id") != BASE_ID + path.name:
            fail(path.name, f"$id must be {BASE_ID + path.name}")
        resources.append((schema["$id"], Resource.from_contents(schema)))
    return Registry().with_resources(resources)


def validator_for(ref, registry):
    """ref looks like 'schemas/api.schema.json#/$defs/Duty' (as in openapi.yaml)."""
    file_part, _, fragment = ref.partition("#")
    uri = BASE_ID + pathlib.PurePosixPath(file_part).name
    schema = {"$ref": uri + ("#" + fragment if fragment else "")}
    return Draft202012Validator(schema, registry=registry, format_checker=FormatChecker())


def errors_of(validator, instance):
    return [
        f"{'/'.join(str(p) for p in e.absolute_path) or '(root)'}: {e.message}"
        for e in sorted(validator.iter_errors(instance), key=lambda e: list(e.absolute_path))
    ]


def load_operations():
    spec = yaml.safe_load((CONTRACT / "openapi.yaml").read_text(encoding="utf-8"))
    shared = spec["components"]["responses"]
    ops = {}
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            request_ref = None
            body = op.get("requestBody")
            if body:
                request_ref = body["content"]["application/json"]["schema"]["$ref"]
            responses = {}
            for status, resp in op["responses"].items():
                if "$ref" in resp:
                    resp = shared[resp["$ref"].split("/")[-1]]
                responses[int(status)] = resp["content"]["application/json"]["schema"]["$ref"]
            pattern = "^" + re.sub(r"\{[^}]+\}", r"[^/]+", path) + "$"
            ops[op["operationId"]] = {
                "method": method.upper(),
                "path": path,
                "pattern": pattern,
                "request": request_ref,
                "responses": responses,
            }
    return ops


def check_fixtures(registry):
    """Validate every test agency. Returns {ref: listing} across all agencies."""
    agency_v = validator_for("schemas/agency.schema.json", registry)
    listing_v = validator_for("schemas/listing.schema.json", registry)
    all_listings = {}
    folders = sorted(p for p in AGENCIES.iterdir() if p.is_dir())
    if not folders:
        fail("fixtures/agencies", "no test agencies found")
    for folder in folders:
        where = f"fixtures/agencies/{folder.name}"
        agency = json.loads((folder / "agency.json").read_text(encoding="utf-8"))
        errs = errors_of(agency_v, agency)
        for err in errs:
            fail(f"{where}/agency.json", err)
        if errs:
            continue
        if agency["agency_id"] != folder.name:
            fail(where, f"agency_id {agency['agency_id']} must match the folder name")
        on_duty = [a["agent_id"] for a in agency["agents"] if a["on_duty"]]
        if len(on_duty) != 1:
            fail(where, f"exactly one agent must be on_duty, found {on_duty}")
        missing = set(agency["languages"]) - set(agency["disclosure"])
        if missing:
            fail(where, f"no disclosure line for {sorted(missing)}")
        if "legal_footer" in agency:
            missing = set(agency["languages"]) - set(agency["legal_footer"])
            if missing:
                fail(where, f"no legal_footer line for {sorted(missing)}")
        if "phone" in agency:
            ph = agency["phone"]
            if not set(ph["voice_languages"]) <= set(agency["languages"]):
                fail(where, "every voice language must also be in languages")
            if not set(ph["opening_languages"]) <= set(ph["voice_languages"]):
                fail(where, "opening languages must be voice languages")
        for a in agency["agents"]:
            if a["summary_language"] not in a["speaks"]:
                fail(where, f"agent {a['agent_id']} gets summaries in a language they don't speak")

        for item in json.loads((folder / "listings.json").read_text(encoding="utf-8")):
            ref = item.get("ref")
            for err in errors_of(listing_v, item):
                fail(f"{where}/listings.json {ref}", err)
            if item.get("agency_id") != agency["agency_id"]:
                fail(f"{where}/listings.json {ref}", "agency_id does not match the agency")
            if item.get("currency") != agency["currency"]:
                fail(f"{where}/listings.json {ref}", f"currency {item.get('currency')} is not the agency's {agency['currency']}")
            if ref in all_listings:
                fail(where, f"ref {ref} is used by more than one listing")
            all_listings[ref] = item
    return all_listings


def load_examples():
    examples = []
    for path in sorted(EXAMPLES.glob("*.json")):
        examples.append((path.name, json.loads(path.read_text(encoding="utf-8"))))
    return examples


def expected_response(example):
    if "response_fixture" in example:
        return json.loads((FIXTURES / example["response_fixture"]).read_text(encoding="utf-8"))
    return example["response"]


def check_examples_static(examples, ops, registry, listings):
    covered = set()
    for name, ex in examples:
        op = ops.get(ex["operation"])
        if not op:
            fail(name, f"unknown operation {ex['operation']}")
            continue
        if ex["method"] != op["method"] or not re.match(op["pattern"], ex["path"]):
            fail(name, f"{ex['method']} {ex['path']} does not match {op['method']} {op['path']}")

        if op["request"]:
            errs = errors_of(validator_for(op["request"], registry), ex["request"])
            if ex.get("request_invalid"):
                if not errs:
                    fail(name, "request is marked invalid but passes the schema")
            else:
                for err in errs:
                    fail(name, f"request {err}")
        elif ex["request"] is not None:
            fail(name, "this endpoint takes no request body")

        status = ex["status"]
        if status not in op["responses"]:
            fail(name, f"status {status} is not documented for {ex['operation']}")
            continue
        for err in errors_of(validator_for(op["responses"][status], registry), expected_response(ex)):
            fail(name, f"response {err}")

        response = expected_response(ex)
        for item in response.get("results", []) if isinstance(response, dict) else []:
            if listings.get(item.get("ref")) != item:
                fail(name, f"listing {item.get('ref')} differs from the fixture listings")

        if 200 <= status < 300:
            covered.add(ex["operation"])

    for op_id in ops:
        if op_id not in covered:
            fail("examples", f"no success example for {op_id}")


def is_stateful(ex):
    blob = ex["path"] + json.dumps(ex.get("request") or {})
    return "lead_" in blob


def check_live(examples, ops, registry, base_url, api_key, include_stateful):
    ran = skipped = 0
    for name, ex in examples:
        if is_stateful(ex) and not include_stateful:
            skipped += 1
            continue
        op = ops[ex["operation"]]
        data = None if ex["request"] is None else json.dumps(ex["request"]).encode()
        req = urllib.request.Request(
            base_url.rstrip("/") + ex["path"],
            data=data,
            method=ex["method"],
            headers={"Content-Type": "application/json", "X-Api-Key": api_key},
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                status, body = resp.status, resp.read()
        except urllib.error.HTTPError as e:
            status, body = e.code, e.read()
        except (OSError, http.client.HTTPException) as e:
            fail(name, f"no response: {e!r}")
            continue
        ran += 1
        if status != ex["status"]:
            fail(name, f"live status {status}, expected {ex['status']}")
        try:
            payload = json.loads(body or b"null")
        except json.JSONDecodeError:
            fail(name, "live response is not JSON")
            continue
        ref = op["responses"].get(status)
        if not ref:
            fail(name, f"live status {status} is not documented")
            continue
        for err in errors_of(validator_for(ref, registry), payload):
            fail(name, f"live response {err}")
    print(f"live: ran {ran}, skipped {skipped} stateful")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", help="Run the examples against this server")
    parser.add_argument("--api-key", default="test")
    parser.add_argument("--include-stateful", action="store_true")
    args = parser.parse_args()

    registry = load_registry()
    ops = load_operations()
    listings = check_fixtures(registry)
    examples = load_examples()
    check_examples_static(examples, ops, registry, listings)
    if args.base_url:
        check_live(examples, ops, registry, args.base_url, args.api_key, args.include_stateful)

    if failures:
        print(f"FAILED: {len(failures)} problem(s)")
        for f in failures:
            print("  -", f)
        sys.exit(1)
    print(f"OK: {len(ops)} endpoints, {len(examples)} examples, {len(listings)} listings")


if __name__ == "__main__":
    main()
