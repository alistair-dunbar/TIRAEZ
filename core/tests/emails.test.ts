// The 30 sample emails in fixtures/emails/ (repo root) against their answer key.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { repoPath } from "../src/data.ts";
import { parseEnquiry } from "../src/parse.ts";

interface KeyEntry {
  file: string;
  source: string;
  language: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  phone_e164: string | null;
  listing_ref: string | null;
  listing_status: string | null;
  handoff_topic: string | null;
  needs_human: boolean;
  opt_out: boolean;
}

const readRoot = (rel: string) => readFileSync(repoPath(`../${rel}`), "utf8");
const key = JSON.parse(readRoot("fixtures/emails/answer-key.json")) as KeyEntry[];
const listings = JSON.parse(readRoot("fixtures/agencies/costa-test-homes/listings.json")) as { ref: string; status: string }[];
const agency = JSON.parse(readRoot("fixtures/agencies/costa-test-homes/agency.json")) as { handoff_topics: string[] };

describe("sample emails: answer key", () => {
  test("30 emails, 5 per launch language", () => {
    assert.equal(key.length, 30);
    for (const lang of ["en", "es", "de", "sv", "nl", "fr"]) {
      assert.equal(key.filter((k) => k.language === lang).length, 5, lang);
    }
  });

  test("statuses, handoff topics and phones agree with the fixtures and the contract", () => {
    const status = new Map(listings.map((l) => [l.ref, l.status]));
    for (const k of key) {
      const want = k.listing_ref === null ? null : (status.get(k.listing_ref) ?? "unknown");
      assert.equal(k.listing_status, want, k.file);
      if (k.handoff_topic) assert.ok(agency.handoff_topics.includes(k.handoff_topic), `${k.file}: ${k.handoff_topic}`);
      assert.equal(k.needs_human, k.handoff_topic !== null || k.listing_status === "unknown", k.file);
      if (k.phone_e164) assert.match(k.phone_e164, /^\+[1-9]\d{6,14}$/, k.file);
      assert.equal(k.phone_e164, k.phone === null ? null : `+${k.phone.replace(/\D/g, "")}`, k.file);
      assert.ok(["idealista", "kyero", "rightmove_overseas", "web_form"].includes(k.source), k.file);
    }
  });
});

describe("sample emails: parser", () => {
  for (const k of key) {
    test(k.file, () => {
      const p = parseEnquiry(readRoot(`fixtures/emails/${k.file}`));
      assert.equal(p.name, k.name, "name");
      assert.equal(p.email, k.email, "email");
      assert.equal(p.phone, k.phone, "phone");
      assert.equal(p.listing_ref, k.listing_ref, "listing_ref");
      assert.ok(p.message.length > 20, "message extracted");
      assert.ok(!/^(sent at|enviado desde|rightmove overseas lead)/im.test(p.message), "footer kept out of the message");
    });
  }
});
