export type LanguageCode = string; // ISO 639-1, e.g. "en", "de", "sv", "nl", "fr"

export interface Faq {
  q: string;
  a: string;
}

/** Everything that varies per agency or region. Loaded from config/*.json. */
export interface AgencyConfig {
  agency_name: string;
  agency_location: string;
  agent_name: string;
  region: string;
  currency: string;
  supported_languages: LanguageCode[];
  fallback_language: LanguageCode;
  tone: string;
  max_reply_words: number;
  booking_link: string;
  /** First sentence of every reply, per language. EU AI Act transparency requirement. */
  ai_disclosure: Record<LanguageCode, string>;
  /** Shown under the reply, not inside it. */
  legal_footer: Record<LanguageCode, string>;
  handoff_topics: string[];
  faqs: Faq[];
}

export interface Listing {
  ref: string;
  title: string;
  area: string;
  price_eur: number;
  beds: number;
  baths: number;
  size_m2: number;
  features: string[];
  availability: string;
}

/** Output of src/parse.ts */
export interface ParsedEnquiry {
  name: string | null;
  email: string | null;
  phone: string | null;
  listing_ref: string | null;
  message: string;
}

export interface Qualification {
  budget: string | null;
  area: string | null;
  timing: string | null;
  travel_dates: string | null;
}

/** The strict JSON the model returns. */
export interface AssistantOutput {
  language: LanguageCode;
  reply: string;
  summary_en: string;
  qualification: Qualification;
  needs_human: boolean;
  reason: string;
}

/** What POST /enquiry returns: the model output after server-side checks, plus context. */
export interface EnquiryResult extends AssistantOutput {
  parsed: ParsedEnquiry;
  listing: Listing | null;
  legal_footer: string;
  model: string;
  elapsed_ms: number;
  /** Server-side safety nets that changed the model's output, for transparency. */
  adjustments: string[];
  /** True when DEMO_MODE=offline: the reply is pre-written, not AI output. */
  offline?: boolean;
}
