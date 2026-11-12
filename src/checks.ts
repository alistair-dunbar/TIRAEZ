// Deterministic checks on the model's output. Used two ways:
//   1. As server-side safety nets in respond.ts (legal rules must not depend on the
//      model following instructions).
//   2. As assertions in tests/.
import type { AgencyConfig, Listing } from "./types.ts";

// ---------------------------------------------------------------------------
// Rule 1: AI disclosure in the first sentence
// ---------------------------------------------------------------------------

/** First sentence of a reply (up to the first . ! or ? followed by whitespace). */
export function firstSentence(text: string): string {
  const t = text.trim();
  const m = t.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : t).trim();
}

// "AI" in the languages we support (KI = German, IA = French/Spanish/Italian).
const AI_WORD = /(?<!\p{L})(AI|KI|IA)(?!\p{L})|AI-|KI-|\bartificial intelligence\b/u;

export function hasAiDisclosure(reply: string, config: AgencyConfig): boolean {
  const first = firstSentence(reply);
  return AI_WORD.test(first) && first.toLowerCase().includes(config.agency_name.toLowerCase());
}

export function disclosureFor(config: AgencyConfig, language: string): string {
  return config.ai_disclosure[language] ?? config.ai_disclosure[config.fallback_language];
}

/** Ensures the reply opens with the disclosure. Returns the (possibly) fixed reply. */
export function enforceDisclosure(reply: string, config: AgencyConfig, language: string): { reply: string; changed: boolean } {
  if (hasAiDisclosure(reply, config)) return { reply, changed: false };
  return { reply: `${disclosureFor(config, language)} ${reply.trim()}`, changed: true };
}

// ---------------------------------------------------------------------------
// Rule 7: end with the booking link
// ---------------------------------------------------------------------------

export function endsWithBookingLink(reply: string, link: string): boolean {
  return reply.trim().replace(/[.)\]\s]+$/, "").endsWith(link);
}

export function enforceBookingLink(reply: string, link: string): { reply: string; changed: boolean } {
  if (endsWithBookingLink(reply, link)) return { reply, changed: false };
  if (reply.includes(link)) {
    // Link is present but not last: move it to the end.
    const without = reply.split(link).join("").replace(/[ \t]+\n/g, "\n").replace(/\s{2,}/g, " ").trim();
    return { reply: `${without}\n\n${link}`, changed: true };
  }
  return { reply: `${reply.trim()}\n\n${link}`, changed: true };
}

// ---------------------------------------------------------------------------
// Rule 4: legal / tax / mortgage / residency questions go to a human
// ---------------------------------------------------------------------------

// Word stems per language. Matched at the start of a word, case-insensitive.
// A trailing "$" means whole word only (so "tax$" does not match "taxi").
// Deliberately avoids ambiguous words (e.g. Swedish "visa" = "show", French "prêt" = "ready").
const HANDOFF_STEMS: Record<string, string[]> = {
  mortgage: ["mortgage", "remortgag", "hypothek", "hypotheek", "bolån", "hypothèque", "prêt immobilier", "crédit immobilier", "financing", "finanzierung", "financiering", "finansiering", "financement", "interest rate", "zinssatz", "ränta", "taux d'intérêt"],
  tax: ["tax$", "taxes", "taxation", "steuer", "belasting", "skatt", "impôt", "impot", "taxe$", "taxes", "fiscal"],
  legal: ["legal", "lawyer", "solicitor", "attorney", "notary", "contract", "anwalt", "rechtsanwalt", "notar", "vertrag", "rechtlich", "advocaat", "notaris", "juridisch", "advokat", "jurist", "juridisk", "avocat", "notaire", "juridique", "inheritance", "erbschaft", "erfenis", "succession"],
  residency: ["residency", "residence permit", "golden visa", "visum", "aufenthalt", "wohnsitz", "verblijfsvergunning", "residentie", "uppehållstillstånd", "résidence", "titre de séjour", "nie number", "nie-nummer", "numéro nie"],
};

export function detectHandoffTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const [topic, stems] of Object.entries(HANDOFF_STEMS)) {
    const found = stems.some((stem) => {
      const whole = stem.endsWith("$");
      const escaped = stem.replace(/\$$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<!\\p{L})${escaped}${whole ? "(?!\\p{L})" : ""}`, "u").test(lower);
    });
    if (found) hits.push(topic);
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Rule 3: no invented prices
// ---------------------------------------------------------------------------

const MULTIPLIERS: [RegExp, number][] = [
  [/^(m|mio\.?|million|millions|millionen|miljoner|miljoen|miljon)$/i, 1_000_000],
  [/^(k|tsd\.?|tausend|thousand)$/i, 1_000],
];

/**
 * Finds money amounts in text: numbers next to €, EUR or "euro".
 * Handles 695.000 / 695,000 / 695 000 / 695000 / €1.85m / 1,85 Mio. €.
 */
export function extractEuroAmounts(text: string): number[] {
  const amounts: number[] = [];
  const num = String.raw`(\d{1,3}(?:[.,\s  ]\d{3})+|\d+(?:[.,]\d{1,2})?)`;
  const mult = String.raw`(?:\s?(m|mio\.?|million(?:s|en)?|miljoner|miljoen|miljon|k|tsd\.?|tausend|thousand)(?!\p{L}))?`;
  const cur = String.raw`(?:€|eur(?:o|os)?(?!\p{L}))`;
  const patterns = [
    new RegExp(String.raw`${cur}\s?${num}${mult}`, "giu"), // €695,000
    new RegExp(String.raw`${num}${mult}\s?${cur}`, "giu"), // 695.000 € / 550 000 euro
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      amounts.push(toNumber(m[1], m[2]));
    }
  }
  return [...new Set(amounts)].filter((n) => Number.isFinite(n) && n >= 1000);
}

function toNumber(raw: string, multiplier?: string): number {
  let value: number;
  if (/^\d{1,3}([.,\s  ]\d{3})+$/.test(raw)) {
    value = Number(raw.replace(/[.,\s  ]/g, ""));
  } else {
    value = Number(raw.replace(",", "."));
  }
  if (multiplier) {
    const found = MULTIPLIERS.find(([re]) => re.test(multiplier.trim()));
    if (found) value *= found[1];
  }
  return Math.round(value);
}

/**
 * Amounts in the reply that are neither a listing price nor a figure the buyer
 * wrote themselves (e.g. their budget). Empty array = all prices are verified.
 */
export function unverifiedAmounts(reply: string, listings: Listing[], enquiryText: string): number[] {
  const allowed = new Set([...listings.map((l) => l.price_eur), ...extractEuroAmounts(enquiryText)]);
  return extractEuroAmounts(reply).filter((n) => !allowed.has(n));
}

// ---------------------------------------------------------------------------
// Rule 5 and 6: length and number of questions
// ---------------------------------------------------------------------------

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function questionCount(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

// ---------------------------------------------------------------------------
// Rule 2: language. A small stop-word heuristic, good enough to cross-check the
// model's own "language" field in tests. Not used to make decisions in production.
// ---------------------------------------------------------------------------

const STOPWORDS: Record<string, string[]> = {
  en: ["the", "and", "you", "is", "are", "we", "your", "with", "for", "this", "would", "could", "when", "thank", "property"],
  de: ["und", "der", "die", "das", "ist", "sie", "wir", "ihre", "mit", "für", "eine", "nicht", "gerne", "wann", "können", "vielen"],
  sv: ["och", "är", "att", "det", "för", "med", "vi", "du", "ni", "har", "den", "en", "när", "kan", "tack", "gärna"],
  nl: ["en", "het", "de", "een", "is", "u", "wij", "uw", "met", "voor", "niet", "wanneer", "kunt", "graag", "bedankt", "dank"],
  fr: ["et", "le", "la", "les", "est", "vous", "nous", "votre", "avec", "pour", "une", "des", "quand", "merci", "pouvez"],
};

export function guessLanguage(text: string): string {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  let best = "unknown";
  let bestScore = 0;
  for (const [lang, stops] of Object.entries(STOPWORDS)) {
    const set = new Set(stops);
    const score = words.filter((w) => set.has(w)).length;
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return best;
}
