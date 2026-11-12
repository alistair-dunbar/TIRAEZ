"""Build contract/CONTRACT_BUNDLE.md: the whole contract in one file, for pasting into a chat.

Run after any contract change:  python3 contract/bundle.py
CI fails if the committed bundle is out of date.
"""

import pathlib

C = pathlib.Path(__file__).resolve().parent


def block(lang, path):
    return f"```{lang}\n{path.read_text(encoding='utf-8').rstrip()}\n```\n"


def demote(text):
    return "\n".join("#" + line if line.startswith("#") else line for line in text.splitlines()) + "\n"


parts = [(C / "bundle_header.md").read_text(encoding="utf-8"), "\n---\n\n"]
parts += ["## README\n\n", demote((C / "README.md").read_text(encoding="utf-8")), "\n"]
parts += ["## CHANGELOG\n\n", demote((C / "CHANGELOG.md").read_text(encoding="utf-8")), "\n"]
parts += ["## openapi.yaml\n\n", block("yaml", C / "openapi.yaml"), "\n"]
for name in ["common", "agency", "listing", "lead", "event", "api"]:
    parts += [f"## schemas/{name}.schema.json\n\n", block("json", C / "schemas" / f"{name}.schema.json"), "\n"]
parts += ["## Examples (request and response pairs, also the test cases)\n\n"]
for p in sorted((C / "examples").glob("*.json")):
    parts += [f"### {p.name}\n\n", block("json", p), "\n"]

out = C / "CONTRACT_BUNDLE.md"
out.write_text("".join(parts).rstrip() + "\n", encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
