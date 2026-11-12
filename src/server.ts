import "./env.ts";
import express from "express";
import { StaticLinkCalendar } from "./calendar/static-link.ts";
import { ConsoleOutbound } from "./channels/console.ts";
import { loadConfig, loadListings, repoPath } from "./data.ts";
import { MissingApiKeyError, modelName, respond } from "./respond.ts";
import { loadSamples } from "./samples.ts";
import { MemoryStore } from "./store/memory.ts";

const config = loadConfig();
const listings = loadListings();
const samples = loadSamples();
const store = new MemoryStore();
const outbound = new ConsoleOutbound("web");
const calendar = new StaticLinkCalendar(config.booking_link);

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(repoPath("public")));

app.get("/api/config", (_req, res) => {
  res.json({
    agency_name: config.agency_name,
    agency_location: config.agency_location,
    agent_name: config.agent_name,
    model: modelName(),
    api_key_configured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
});

app.get("/api/samples", (_req, res) => {
  res.json(samples);
});

app.post("/enquiry", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ error: "Send JSON like { \"text\": \"<enquiry email>\" }." });
    return;
  }
  if (text.length > 20_000) {
    res.status(413).json({ error: "Enquiry is too long (max 20,000 characters)." });
    return;
  }

  const inbound = { channel: "web" as const, receivedAt: new Date(), rawText: text };
  try {
    const result = await respond(text, { config, listings });
    await store.save({ inbound, result, error: null });
    await outbound.send(result.parsed.email ?? "", result.reply);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await store.save({ inbound, result: null, error: message });
    const status = err instanceof MissingApiKeyError ? 503 : 502;
    console.error(`[enquiry] ${message}`);
    res.status(status).json({ error: message });
  }
});

app.get("/api/enquiries", async (_req, res) => {
  res.json(await store.list());
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`${config.agency_name} demo running at http://localhost:${port}`);
  console.log(`Model: ${modelName()} · Booking link: ${calendar.bookingLink(null)}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set: the page will load but Send will fail. See README.");
  }
});
