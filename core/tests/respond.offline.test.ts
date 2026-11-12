// Tests respond.ts end to end with a fake Claude client, so the server-side
// safety nets are verified without an API key. The fake deliberately returns
// bad answers to prove the nets catch them.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { firstSentence } from "../src/checks.ts";
import { respond } from "../src/respond.ts";
import type { AssistantOutput } from "../src/types.ts";
import { config, fixture, listings, samples } from "./helpers.ts";

type CreateParams = Anthropic.MessageCreateParamsNonStreaming;

function fakeClient(output: Partial<AssistantOutput>, stop_reason = "end_turn") {
  const calls: CreateParams[] = [];
  const full: AssistantOutput = {
    language: "en",
    reply: "Thanks for your message.",
    summary_en: "Summary.",
    qualification: { budget: null, area: null, timing: null, travel_dates: null },
    needs_human: false,
    reason: "Routine enquiry",
    ...output,
  };
  const client = {
    messages: {
      create: async (params: CreateParams) => {
        calls.push(params);
        return { stop_reason, content: [{ type: "text", text: JSON.stringify(full) }] };
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const deps = (client: Anthropic) => ({ config, listings, client });
const german = samples.find((s) => s.language === "de")!;

describe("respond() with a fake model", () => {
  test("sends the matching listing and the JSON schema to the model", async () => {
    const { client, calls } = fakeClient({ language: "de" });
    await respond(german.text, deps(client));
    const params = calls[0];
    const user = String(params.messages[0].content);
    assert.ok(user.includes('"ref": "DCP-1003"'));
    assert.ok(user.includes("1850000"));
    assert.ok(!user.includes("DCP-1001"), "only the matching listing is sent");
    assert.equal(params.output_config?.format?.type, "json_schema");
    assert.equal(params.model, process.env.ANTHROPIC_MODEL || "claude-haiku-5-5");
  });

  test("adds the disclosure and booking link if the model forgets them", async () => {
    const { client } = fakeClient({ language: "de", reply: "Vielen Dank für Ihre Anfrage zur Villa." });
    const r = await respond(german.text, deps(client));
    assert.equal(firstSentence(r.reply), config.ai_disclosure.de);
    assert.ok(r.reply.trim().endsWith(config.booking_link));
    assert.equal(r.adjustments.length, 2);
    assert.equal(r.legal_footer, config.legal_footer.de);
  });

  test("mortgage question forces needs_human even if the model says false", async () => {
    const { client } = fakeClient({ needs_human: false });
    const r = await respond(fixture("en-mortgage-question.txt"), deps(client));
    assert.equal(r.needs_human, true);
    assert.match(r.reason, /mortgage/);
  });

  test("unknown ref: no listing data is sent to the model and needs_human is set", async () => {
    const { client, calls } = fakeClient({ language: "de", needs_human: false });
    const r = await respond(fixture("de-unknown-ref.txt"), deps(client));
    const user = String(calls[0].messages[0].content);
    assert.ok(user.includes("NO MATCHING LISTING"));
    assert.ok(!user.includes("price_eur"), "no listing details may reach the model");
    assert.equal(r.listing, null);
    assert.equal(r.needs_human, true);
  });

  test("an invented price is flagged for a human", async () => {
    const { client } = fakeClient({ language: "de", reply: `${config.ai_disclosure.de} Die Villa kostet 1.790.000 €.` });
    const r = await respond(german.text, deps(client));
    assert.equal(r.needs_human, true);
    assert.match(r.reason, /1790000/);
  });

  test("refusal stop reason becomes a clear error", async () => {
    const { client } = fakeClient({}, "refusal");
    await assert.rejects(respond(german.text, deps(client)), /declined/);
  });
});
