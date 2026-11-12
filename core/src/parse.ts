// Extracts buyer name, contact, listing ref and message from raw enquiry text.
// Deterministic (no AI call): handles labelled portal emails in EN/DE/SV/NL/FR
// and falls back to regexes for free-form pasted text.
import type { ParsedEnquiry } from "./types.ts";

const NAME_LABELS = ["name", "naam", "namn", "nom", "full name", "nombre"];
const EMAIL_LABELS = ["email", "e-mail", "e-post", "epost", "mail", "courriel", "correo", "correo electrónico"];
const PHONE_LABELS = ["phone", "telephone", "tel", "telefon", "telefoon", "téléphone", "mobile", "handy", "teléfono", "móvil"];
const MESSAGE_LABELS = ["message", "nachricht", "meddelande", "bericht", "comments", "kommentar", "mensaje", "comentarios"];
// Lines that end the message body in portal emails ("Sent at 23:47", etc.)
const MESSAGE_END = /^(sent at|gesendet|skickat|verzonden|envoyé|enviado|--\s*$)/i;

// Listing refs look like "CTH-1234". Two patterns, so ordinary text ("June 2027", "EUR450000")
// is not read as a ref:
// - Anywhere in the text: capital letters, an optional hyphen, digits ("CTH-1234", "CTH1234").
// - Straight after a reference word, also lower case or with a space ("ref cth 1234").
const REF_STRICT = /\b([A-Z]{2,5})-?(\d{3,6})\b/g;
const REF_AFTER_KEYWORD =
  /(?:ref|reference|referenz|referentie|referens|referencia|référence)\b\.?(?:\s*(?:no|nr|nº)\.?)?\s*[:#]?\s*([a-z]{2,5})[-\s]?(\d{3,6})\b/giu;
// Letter groups that are never a listing prefix: currencies, months, units, time words.
const NOT_A_PREFIX = new Set([
  "EUR", "GBP", "USD", "SEK", "NOK", "DKK", "CHF", "AED", "SAR", "PLN",
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUNE", "JUL", "JULY", "AUG", "SEP", "SEPT", "OCT", "NOV", "DEC",
  "MARCH", "APRIL", "JUNI", "JULI", "MAJ", "MEI", "MAI", "MAYO", "JUNIO", "JULIO", "JUIN",
  "UTC", "GMT", "CET", "CEST", "TEL", "FAX", "SQM", "SQFT",
]);
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+|\b00)\d[\d\s().-]{7,}\d/; // needs + or 00 so prices are not mistaken for phones

function labelValue(lines: string[], labels: string[]): string | null {
  for (const line of lines) {
    const m = line.match(/^\s*([^:]{1,30}?)\s*:\s*(.+)$/);
    if (m && labels.includes(m[1].trim().toLowerCase())) return m[2].trim();
  }
  return null;
}

function extractMessage(lines: string[]): string | null {
  const start = lines.findIndex((l) => {
    const m = l.match(/^\s*([^:]{1,30}?)\s*:\s*(.*)$/);
    return !!m && MESSAGE_LABELS.includes(m[1].trim().toLowerCase());
  });
  if (start === -1) return null;
  const first = lines[start].replace(/^[^:]*:\s*/, "");
  const body: string[] = first ? [first] : [];
  for (const line of lines.slice(start + 1)) {
    if (MESSAGE_END.test(line.trim())) break;
    body.push(line);
  }
  const text = body.join("\n").trim();
  return text || null;
}

function firstRef(text: string, pattern: RegExp): string | null {
  for (const m of text.matchAll(pattern)) {
    const prefix = m[1].toUpperCase();
    if (!NOT_A_PREFIX.has(prefix)) return `${prefix}-${m[2]}`;
  }
  return null;
}

function extractRef(text: string): string | null {
  // Prefer a ref named as one ("Reference: CTH-1234", "ref cth 1234"), then any ref-shaped code.
  return firstRef(text, REF_AFTER_KEYWORD) ?? firstRef(text, REF_STRICT);
}

export function parseEnquiry(raw: string): ParsedEnquiry {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");

  const email = labelValue(lines, EMAIL_LABELS)?.match(EMAIL_PATTERN)?.[0] ?? null;
  // Skip the portal's own "From:" address when looking for the buyer's email.
  const bodyEmail =
    lines
      .filter((l) => !/^\s*from\s*:/i.test(l))
      .join("\n")
      .match(EMAIL_PATTERN)?.[0] ?? null;

  const phone = labelValue(lines, PHONE_LABELS) ?? text.match(PHONE_PATTERN)?.[0]?.trim() ?? null;

  return {
    name: labelValue(lines, NAME_LABELS),
    email: email ?? bodyEmail,
    phone,
    listing_ref: extractRef(text),
    message: extractMessage(lines) ?? text,
  };
}
