// The pre-written offline replies must follow the same 7 reply rules as live ones,
// and must reach the page through respond() with its safety nets.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  endsWithBookingLink,
  extractEuroAmounts,
  guessLanguage,
  hasAiDisclosure,
  questionCount,
  wordCount,
} from "../src/checks.ts";
import { findListing } from "../src/data.ts";
import { loadOfflineReplies, offlineClient, offlineOutputFor } from "../src/offline.ts";
import { parseEnquiry } from "../src/parse.ts";
import { respond } from "../src/respond.ts";
import { config, listings, samples } from "./helpers.ts";

const book = loadOfflineReplies();

describe("offline mode", () => {
  for (const sample of samples) {
    test(`${sample.id}: pre-written reply follows the rules`, async () => {
      const output = offlineOutputFor(sample.text, samples, book);
      const r = await respond(sample.text, { config, listings, client: offlineClient(output) });
      const listing = findListing(listings, parseEnquiry(sample.text).listing_ref)!;

      assert.deepEqual(r.adjustments, [], "safety nets should not need to fix a pre-written reply");
      assert.equal(r.language, sample.language);
      assert.equal(guessLanguage(r.reply), sample.language);
      assert.ok(hasAiDisclosure(r.reply, config));
      assert.ok(endsWithBookingLink(r.reply, config.booking_link));
      assert.ok(wordCount(r.reply) < config.max_reply_words, `${wordCount(r.reply)} words`);
      assert.ok(questionCount(r.reply) <= 2);
      const allowed = new Set([listing.price_eur, ...extractEuroAmounts(sample.text)]);
      for (const amount of extractEuroAmounts(r.reply)) assert.ok(allowed.has(amount), `€${amount}`);
      assert.equal(guessLanguage(r.summary_en), "en");
    });
  }

  test("an edited or pasted enquiry gets the fallback, flagged for a human", () => {
    const out = offlineOutputFor(`${samples[0].text}\nP.S. one more question`, samples, book);
    assert.equal(out.needs_human, true);
    assert.match(out.reason, /Offline mode/);
  });

  test("whitespace differences still match the sample", () => {
    const de = samples.find((s) => s.language === "de")!;
    assert.equal(offlineOutputFor(de.text.replace(/\n/g, "\r\n  "), samples, book).language, "de");
  });
});
