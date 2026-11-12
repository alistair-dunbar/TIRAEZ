// Live tests against the Claude API. Each enquiry is sent once (in before())
// and the results are checked against the reply rules. Skips cleanly without a key.
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  extractEuroAmounts,
  firstSentence,
  guessLanguage,
  hasAiDisclosure,
  endsWithBookingLink,
  questionCount,
  wordCount,
} from "../src/checks.ts";
import { respond } from "../src/respond.ts";
import type { EnquiryResult } from "../src/types.ts";
import { config, fixture, listings, samples, SKIP_LIVE } from "./helpers.ts";

const MAX_MS = 15_000;

if (SKIP_LIVE) console.log(`\n⚠  ${SKIP_LIVE}\n`);

describe("live Claude API", { skip: SKIP_LIVE, timeout: 180_000 }, () => {
  const results = new Map<string, EnquiryResult>();
  const inputs = new Map<string, string>([
    ...samples.map((s) => [s.id, s.text] as [string, string]),
    ["mortgage", fixture("en-mortgage-question.txt")],
    ["unknown-ref", fixture("de-unknown-ref.txt")],
  ]);

  before(async () => {
    // Sequential, so each timing reflects a single request.
    for (const [id, text] of inputs) {
      const r = await respond(text, { config, listings });
      results.set(id, r);
      const adj = r.adjustments.length ? ` | safety nets: ${r.adjustments.join("; ")}` : "";
      console.log(`[${id}] ${r.elapsed_ms} ms, ${r.language}, needs_human=${r.needs_human}${adj}\n  ${r.reply.replace(/\n+/g, " ")}\n`);
    }
  });

  for (const sample of samples) {
    describe(`sample ${sample.id}`, () => {
      const get = () => results.get(sample.id)!;

      test(`replies in the buyer's language (${sample.language})`, () => {
        const r = get();
        assert.equal(r.language, sample.language, "model's language field");
        assert.equal(guessLanguage(r.reply), sample.language, "language of the reply text");
      });

      test("AI disclosure is in the first sentence", () => {
        assert.ok(hasAiDisclosure(get().reply, config), `first sentence: "${firstSentence(get().reply)}"`);
      });

      test("any price matches listings.json exactly", () => {
        const r = get();
        const allowed = new Set([r.listing!.price_eur, ...extractEuroAmounts(sample.text)]);
        for (const amount of extractEuroAmounts(r.reply)) {
          assert.ok(allowed.has(amount), `reply mentions €${amount}, listing price is €${r.listing!.price_eur}`);
        }
      });

      test("ends with the booking link", () => {
        assert.ok(endsWithBookingLink(get().reply, config.booking_link));
      });

      test(`under ${config.max_reply_words} words, at most 2 questions`, () => {
        const r = get();
        assert.ok(wordCount(r.reply) < config.max_reply_words, `${wordCount(r.reply)} words`);
        assert.ok(questionCount(r.reply) <= 2, `${questionCount(r.reply)} questions`);
      });

      test("English summary is filled in", () => {
        const r = get();
        assert.ok(r.summary_en.length > 20);
        assert.equal(guessLanguage(r.summary_en), "en");
      });

      test(`returns in under ${MAX_MS / 1000} seconds`, () => {
        assert.ok(get().elapsed_ms < MAX_MS, `${get().elapsed_ms} ms`);
      });
    });
  }

  describe("mortgage question", () => {
    test("sets needs_human to true", () => {
      assert.equal(results.get("mortgage")!.needs_human, true);
    });
    test("does not quote rates or tax amounts", () => {
      const reply = results.get("mortgage")!.reply;
      assert.ok(!/\d+(?:[.,]\d+)?\s?%/.test(reply), `reply mentions a percentage: ${reply}`);
    });
    test(`returns in under ${MAX_MS / 1000} seconds`, () => {
      assert.ok(results.get("mortgage")!.elapsed_ms < MAX_MS);
    });
  });

  describe("unknown listing ref (DCP-9999)", () => {
    const get = () => results.get("unknown-ref")!;

    test("does not produce invented details", () => {
      const r = get();
      assert.equal(r.listing, null);
      assert.deepEqual(extractEuroAmounts(r.reply), [], "no prices");
      assert.ok(!/\d+\s?(m²|m2|qm|Quadratmeter)/i.test(r.reply), "no sizes");
      assert.ok(!/\d+\s?(Schlafzimmer|Zimmer|Bäder|Badezimmer)/i.test(r.reply), "no bedroom/bathroom counts");
      const otherRefs = (r.reply.match(/\b[A-Z]{2,5}-\d{3,6}\b/g) ?? []).filter((ref) => ref !== "DCP-9999");
      assert.deepEqual(otherRefs, [], "no other listings offered");
    });
    test("asks which property they mean and flags a human", () => {
      assert.ok(questionCount(get().reply) >= 1);
      assert.equal(get().needs_human, true);
    });
    test("still replies in German with the disclosure", () => {
      assert.equal(get().language, "de");
      assert.ok(hasAiDisclosure(get().reply, config));
    });
  });
});
