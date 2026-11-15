// Downloads the openly licensed test photos listed in samples/sources.json.
// The photos themselves are not committed; only the list and their credits are.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

interface Source { file: string; url: string }
const sources: Source[] = JSON.parse(readFileSync("samples/sources.json", "utf8"));

for (const s of sources) {
  const path = `samples/${s.file}`;
  if (existsSync(path)) continue;
  // Wikimedia asks automated clients for a descriptive User-Agent.
  const res = await fetch(s.url, { headers: { "User-Agent": "render-test/0.1 (https://example.com)" } });
  if (!res.ok) {
    console.log(`skip ${s.file}: HTTP ${res.status}`);
    continue;
  }
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  console.log(`saved ${path}`);
  await new Promise((r) => setTimeout(r, 1500)); // be gentle with free image hosts
}
