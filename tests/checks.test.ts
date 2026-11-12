import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  detectHandoffTopics,
  enforceBookingLink,
  enforceDisclosure,
  extractEuroAmounts,
  firstSentence,
  guessLanguage,
  hasAiDisclosure,
  unverifiedAmounts,
} from "../src/checks.ts";
import { parseEnquiry } from "../src/parse.ts";
import { config, listings, samples } from "./helpers.ts";

describe("extractEuroAmounts", () => {
  const cases: [string, number[]][] = [
    ["The price is €695,000.", [695000]],
    ["Der Preis beträgt 1.850.000 €.", [1850000]],
    ["Priset är 549 000 euro.", [549000]],
    ["Prijs: € 389.000", [389000]],
    ["Le prix est de 315 000 EUR.", [315000]],
    ["Asking €1.85m or 1,85 Mio. €", [1850000]],
    ["Budget around 700k EUR", [700000]],
    ["Viewing at 10:00 on 14 February, 118 m², 2 beds.", []],
    ["Europe is lovely", []],
  ];
  for (const [text, want] of cases) {
    test(text, () => assert.deepEqual(extractEuroAmounts(text).sort(), want.sort()));
  }

  test("unverifiedAmounts allows listing prices and the buyer's own budget", () => {
    const enquiry = "Our budget is 550 000 euro.";
    assert.deepEqual(unverifiedAmounts("It costs €549,000, within your €550,000 budget.", listings, enquiry), []);
    assert.deepEqual(unverifiedAmounts("It costs €540,000.", listings, enquiry), [540000]);
  });
});

describe("AI disclosure", () => {
  test("every configured disclosure line passes the check on its own", () => {
    for (const [lang, line] of Object.entries(config.ai_disclosure)) {
      assert.ok(hasAiDisclosure(`${line} Rest of reply.`, config), `disclosure for ${lang} failed`);
    }
  });

  test("missing disclosure is detected and prepended in the right language", () => {
    const reply = "Vielen Dank für Ihre Anfrage. Wann möchten Sie kaufen?";
    assert.equal(hasAiDisclosure(reply, config), false);
    const fixed = enforceDisclosure(reply, config, "de");
    assert.equal(fixed.changed, true);
    assert.equal(firstSentence(fixed.reply), config.ai_disclosure.de);
  });

  test("disclosure in the second sentence does not count", () => {
    assert.equal(hasAiDisclosure(`Thanks for your message. ${config.ai_disclosure.en}`, config), false);
  });
});

describe("booking link", () => {
  const link = config.booking_link;
  test("appended when missing", () => {
    assert.ok(enforceBookingLink("Hello.", link).reply.endsWith(link));
  });
  test("moved to the end when in the middle", () => {
    const r = enforceBookingLink(`Book here ${link} and we will reply.`, link);
    assert.equal(r.changed, true);
    assert.ok(r.reply.endsWith(link));
    assert.equal(r.reply.split(link).length, 2, "link appears exactly once");
  });
  test("left alone when already last", () => {
    assert.equal(enforceBookingLink(`Hello.\n\n${link}`, link).changed, false);
  });
});

describe("detectHandoffTopics", () => {
  const cases: [string, string[]][] = [
    ["Can I get a Spanish mortgage?", ["mortgage"]],
    ["Wie hoch ist die Grunderwerbsteuer? Brauche ich einen Anwalt?", ["tax", "legal"]],
    ["Welche Steuern fallen an?", ["tax"]],
    ["Kan jag få bolån i Spanien?", ["mortgage"]],
    ["Hur hög är fastighetsskatten?", ["tax"]],
    ["Hebben wij een hypotheek nodig?", ["mortgage"]],
    ["Quel est le taux d'intérêt pour un prêt immobilier ?", ["mortgage"]],
    ["How do I get a residence permit or golden visa?", ["residency"]],
    ["Can we book a taxi from the airport?", []],
    ["Kan ni visa lägenheten i maj?", []], // Swedish "visa" = "show"
  ];
  for (const [text, want] of cases) {
    test(text, () => assert.deepEqual(detectHandoffTopics(text), want));
  }

  test("none of the 5 normal samples trigger a handoff", () => {
    for (const s of samples) {
      assert.deepEqual(detectHandoffTopics(parseEnquiry(s.text).message), [], s.id);
    }
  });
});

describe("guessLanguage (test helper) recognises each sample's own message", () => {
  for (const s of samples) {
    test(s.id, () => assert.equal(guessLanguage(parseEnquiry(s.text).message), s.language));
  }
});
