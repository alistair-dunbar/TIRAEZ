// Extracts buyer name, contact, listing ref and message from raw enquiry text.
// Deterministic (no AI call): handles labelled portal emails in EN/DE/SV/NL/FR
// and falls back to regexes for free-form pasted text.
import type { ParsedEnquiry } from "./types.ts";

const NAME_LABELS = ["name", "naam", "namn", "nom", "full name"];
const EMAIL_LABELS = ["email", "e-mail", "e-post", "epost", "mail", "courriel"];
const PHONE_LABELS = ["phone", "telephone", "tel", "telefon", "telefoon", "téléphone", "mobile", "handy"];
const MESSAGE_LABELS = ["message", "nachricht", "meddelande", "bericht", "comments", "kommentar"];
// Lines that end the message body in portal emails ("Sent at 23:47", etc.)
const MESSAGE_END = /^(sent at|gesendet|skickat|verzonden|envoyé|--\s*$)/i;

const REF_PATTERN = /\b([A-Z]{2,5})[-\s]?(\d{3,6})\b/i;
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

function extractRef(text: string, lines: string[]): string | null {
  // Prefer an explicit "reference" line, then the subject, then anywhere.
  const refLine = lines.find((l) => /(ref|référence|referentie|referens|objekt)/i.test(l) && REF_PATTERN.test(l));
  const m = (refLine ?? text).match(REF_PATTERN);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null;
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
    listing_ref: extractRef(text, lines),
    message: extractMessage(lines) ?? text,
  };
}
