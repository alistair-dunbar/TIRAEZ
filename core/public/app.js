// Plain JS, no framework. Talks to GET /api/config, GET /api/samples, POST /enquiry.
const $ = (id) => document.getElementById(id);

const LANG_NAMES = { en: "English", de: "German", sv: "Swedish", nl: "Dutch", fr: "French", es: "Spanish", it: "Italian" };
let samples = [];
let timerFrame = null;
let offlineMode = false;

async function init() {
  const [config, sampleList] = await Promise.all([
    fetch("/api/config").then((r) => r.json()),
    fetch("/api/samples").then((r) => r.json()),
  ]);
  $("agency-name").textContent = `${config.agency_name}, ${config.agency_location}`;
  $("logo").textContent = config.agency_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  document.title = `${config.agency_name} · Enquiry Assistant`;
  $("key-warning").hidden = config.api_key_configured || config.offline;
  $("offline-banner").hidden = !config.offline;
  offlineMode = Boolean(config.offline);
  if (config.offline) $("timer-label").textContent = "offline";

  samples = sampleList;
  for (const s of samples) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    $("sample-select").append(opt);
  }
  // Start on the German sample: it's the one in the demo script.
  const start = samples.find((s) => s.language === "de") ?? samples[0];
  if (start) {
    $("sample-select").value = start.id;
    $("enquiry-text").value = start.text;
  }
}

$("sample-select").addEventListener("change", (e) => {
  const s = samples.find((x) => x.id === e.target.value);
  $("enquiry-text").value = s ? s.text : "";
  if (!s) $("enquiry-text").focus();
});

function startTimer() {
  const t0 = performance.now();
  $("timer").className = "timer running";
  $("timer-label").textContent = "replying";
  const tick = () => {
    $("timer-value").textContent = ((performance.now() - t0) / 1000).toFixed(1);
    timerFrame = requestAnimationFrame(tick);
  };
  tick();
  return t0;
}

function stopTimer(t0, ok) {
  cancelAnimationFrame(timerFrame);
  $("timer-value").textContent = ((performance.now() - t0) / 1000).toFixed(1);
  $("timer").className = ok ? "timer done" : "timer";
  $("timer-label").textContent = ok ? (offlineMode ? "offline" : "replied") : "failed";
}

function setField(id, value) {
  const el = $(id);
  el.textContent = value ?? "Not stated";
  el.classList.toggle("none", value == null || value === "");
}

function linkify(text) {
  const escaped = text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  return escaped.replace(/https?:\/\/[^\s<]+[^\s<.,)]/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
}

function showResult(r) {
  $("reply-bubble").innerHTML = linkify(r.reply);
  $("legal-footer").textContent = r.legal_footer;
  $("legal-footer").hidden = false;

  $("summary-text").textContent = r.summary_en;
  setField("q-budget", r.qualification.budget);
  setField("q-area", r.qualification.area);
  setField("q-timing", r.qualification.timing);
  setField("q-travel", r.qualification.travel_dates);
  const contact = [r.parsed.name, r.parsed.email, r.parsed.phone].filter(Boolean).join(" · ");
  setField("q-buyer", contact || null);
  setField("q-listing", r.listing ? `${r.listing.ref} · ${r.listing.title}` : r.parsed.listing_ref ? `${r.parsed.listing_ref} (not found)` : null);
  setField("q-language", LANG_NAMES[r.language] ?? r.language);
  setField("q-human", r.needs_human ? "Yes" : "No");

  const badge = $("human-badge");
  badge.textContent = r.needs_human ? "Agent follow-up needed" : "Routine";
  badge.className = `badge ${r.needs_human ? "warn" : "ok"}`;
  $("reason-text").textContent = r.reason;
  const adj = r.adjustments.length ? ` · Safety nets applied: ${r.adjustments.join("; ")}` : "";
  $("meta-text").textContent = `${r.model} · server time ${(r.elapsed_ms / 1000).toFixed(1)} s${adj}`;
  $("summary-card").hidden = false;
}

$("send-btn").addEventListener("click", async () => {
  const text = $("enquiry-text").value.trim();
  if (!text) {
    $("enquiry-text").focus();
    return;
  }
  $("send-btn").disabled = true;
  $("error").hidden = true;
  $("summary-card").hidden = true;
  $("legal-footer").hidden = true;
  $("empty-state").hidden = true;

  const parsedMessage = text.split(/\n(?:Message|Nachricht|Meddelande|Bericht|Message)\s?:\s*\n?/i)[1]?.split(/\n\s*\n/)[0] ?? text;
  $("buyer-bubble").textContent = parsedMessage.trim();
  $("buyer-bubble").hidden = false;
  $("reply-bubble").innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  $("reply-bubble").hidden = false;

  const t0 = startTimer();
  try {
    const res = await fetch("/enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    stopTimer(t0, true);
    showResult(body);
  } catch (err) {
    stopTimer(t0, false);
    $("reply-bubble").hidden = true;
    $("error").textContent = err.message;
    $("error").hidden = false;
  } finally {
    $("send-btn").disabled = false;
  }
});

init().catch((err) => {
  $("error").textContent = `Could not load the demo: ${err.message}`;
  $("error").hidden = false;
});
