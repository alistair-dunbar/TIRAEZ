import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoPath } from "./data.ts";

export interface SampleEnquiry {
  id: string; // file name without .txt, e.g. "de-benahavis-villa"
  language: string; // from the file name prefix
  label: string;
  text: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  de: "German",
  sv: "Swedish",
  nl: "Dutch",
  fr: "French",
};

export function loadSamples(dir = "data/sample-enquiries"): SampleEnquiry[] {
  const abs = repoPath(dir);
  return readdirSync(abs)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((file) => {
      const id = file.replace(/\.txt$/, "");
      const language = id.split("-")[0];
      const text = readFileSync(join(abs, file), "utf8");
      const ref = text.match(/\b[A-Z]{2,5}-\d{3,6}\b/)?.[0] ?? "no ref";
      return { id, language, label: `${LANGUAGE_NAMES[language] ?? language} · ${ref}`, text };
    });
}
