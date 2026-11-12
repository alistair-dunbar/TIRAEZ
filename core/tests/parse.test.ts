import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseEnquiry } from "../src/parse.ts";
import { fixture, samples } from "./helpers.ts";

const expected: Record<string, { name: string; email: string; ref: string; phone: string }> = {
  "en-golden-mile-apartment": { name: "James Whitfield", email: "james.whitfield@example.co.uk", ref: "DCP-1001", phone: "+44 7700 900123" },
  "de-benahavis-villa": { name: "Katrin Bauer", email: "k.bauer@example.de", ref: "DCP-1003", phone: "+49 151 23456789" },
  "sv-fuengirola-penthouse": { name: "Erik Lindqvist", email: "erik.lindqvist@example.se", ref: "DCP-1005", phone: "+46 70 123 45 67" },
  "nl-estepona-townhouse": { name: "Sanne de Vries", email: "sanne.devries@example.nl", ref: "DCP-1002", phone: "+31 6 12345678" },
  "fr-mijas-golf": { name: "Claire Dubois", email: "claire.dubois@example.be", ref: "DCP-1004", phone: "+32 470 12 34 56" },
};

describe("parseEnquiry: sample portal emails", () => {
  test("there are exactly 5 samples, one per language", () => {
    assert.deepEqual(samples.map((s) => s.language).sort(), ["de", "en", "fr", "nl", "sv"]);
  });

  for (const sample of samples) {
    test(sample.id, () => {
      const p = parseEnquiry(sample.text);
      const want = expected[sample.id];
      assert.ok(want, `no expectations for ${sample.id}`);
      assert.equal(p.name, want.name);
      assert.equal(p.email, want.email);
      assert.equal(p.phone, want.phone);
      assert.equal(p.listing_ref, want.ref);
      assert.ok(p.message.length > 40, "message should be extracted");
      assert.ok(!/^(sent at|gesendet|skickat|verzonden|envoyé)/im.test(p.message), "footer line must not be in message");
      assert.ok(!p.message.includes("CostaHomes Portal"), "portal boilerplate must not be in message");
    });
  }
});

describe("parseEnquiry: edge cases", () => {
  test("unknown ref is still extracted (lookup happens later)", () => {
    assert.equal(parseEnquiry(fixture("de-unknown-ref.txt")).listing_ref, "DCP-9999");
  });

  test("free-form pasted text with no labels", () => {
    const p = parseEnquiry("Hi, is ref dcp 1006 still for sale? Call me on +44 7700 900456 or mail anna@example.com. Thanks, Anna");
    assert.equal(p.listing_ref, "DCP-1006");
    assert.equal(p.email, "anna@example.com");
    assert.equal(p.phone, "+44 7700 900456");
    assert.equal(p.name, null);
    assert.ok(p.message.startsWith("Hi, is ref"));
  });

  test("no ref at all", () => {
    assert.equal(parseEnquiry("Do you have any villas with a pool near Marbella?").listing_ref, null);
  });

  test("a price in the text is not mistaken for a phone number", () => {
    assert.equal(parseEnquiry("Our budget is 1 850 000 EUR for DCP-1003.").phone, null);
  });
});
