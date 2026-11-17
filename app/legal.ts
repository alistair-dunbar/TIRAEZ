// Legal pages: Markdown sources in legal/*.md, facts filled in from config/*.json at render time.
//
// A fact that isn't confirmed yet (null in config/business.json or config/legal.json, or retention
// periods not yet confirmed) is never guessed. In development it shows as a highlighted
// "to confirm" mark. In production the documents are only published once config/legal.json says
// "published" and nothing is left unresolved; until then each page says it is being prepared and new
// accounts can't be opened (they would have to agree to terms that don't exist yet).
// LEGAL_PREVIEW=1 shows the drafts, with a "not in force" banner, on a deployment that isn't public.
import { readFileSync } from "node:fs";
import { pricing, site } from "./config.ts";

const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

export interface LegalDocMeta { title: string; version: string; effective: string | null }
export interface LegalConfig { status: "draft" | "published"; documents: Record<string, LegalDocMeta>; unresolved: Record<string, string | null>; paymentsOnly: string[] }
export interface TransferRecord { recipient: string; purposes: string[]; data: string; location: string; role: string; mechanism: string | null; riskAssessment: string | null }
export interface ComplianceConfig { transfers: Record<string, TransferRecord> }
export interface RetentionConfig { confirmed: boolean; unusedPhotosDays: number; expiredSessions: boolean; providerFilesHours: number; unverifiedAccountsDays: number; ageRestrictedDays: number }

export const business: Record<string, string | null> = read("config/business.json");
export const legal: LegalConfig = read("config/legal.json");
export const retention: RetentionConfig = read("config/retention.json");
export const compliance: ComplianceConfig = read("config/compliance.json");
const packs: { id: string; credits: number; priceSar: number }[] = read("config/packs.json");

export const LEGAL_DOCS = ["terms", "privacy", "acceptable-use", "billing", "cookies", "contact"] as const;
export type LegalSlug = (typeof LEGAL_DOCS)[number];

const sources = new Map<string, string>();
function source(slug: string): string {
  if (!sources.has(slug) || process.env.NODE_ENV !== "production") {
    sources.set(slug, readFileSync(new URL(`../legal/${slug}.md`, import.meta.url), "utf8"));
  }
  return sources.get(slug)!;
}

/** Read at call time, so tests can switch production-style enforcement on. */
export function legalEnforced(): boolean {
  return (process.env.NODE_ENV === "production" || process.env.LEGAL_ENFORCE === "1") && process.env.LEGAL_PREVIEW !== "1";
}

export const termsVersion = () => legal.documents.terms.version;
export const privacyVersion = () => legal.documents.privacy.version;

// ---------------------------------------------------------------------------------------------
// Tokens

type Token = { value: string | null; pending?: boolean; email?: boolean };

function tokenValue(name: string, slug: string): Token {
  const [scope, ...rest] = name.split(".");
  const key = rest.join(".");
  const doc = legal.documents[slug];
  if (name === "brand") return { value: site.brandName };
  if (scope === "doc") return { value: key === "version" ? doc.version : key === "effective" ? doc.effective : null };
  if (scope === "business") return { value: business[key] ?? null, email: key.endsWith("Email") };
  if (scope === "legal" && rest[0] === "unresolved") {
    const v = legal.unresolved[rest[1]] ?? null;
    // Decisions that only matter once people can pay don't hold up the rest of the service: while
    // buying is switched off, the policy says so instead of guessing.
    if (v === null && legal.paymentsOnly.includes(rest[1]) && !paymentsSwitchedOn()) return { value: "This will be set out here before buying credits opens." };
    return { value: v };
  }
  if (scope === "retention") {
    const v = (retention as any)[key];
    // The numbers describe what the code does; they still need the founders' sign-off as policy.
    return { value: v === undefined ? null : String(v), pending: !retention.confirmed };
  }
  if (name === "pricing.currency") return { value: pricing.currency };
  if (name === "pricing.perVideo") {
    const lines = Object.entries(pricing.creditsByDuration).map(([d, c]) => `a ${d}-second video uses ${c} credit${c === 1 ? "" : "s"}`);
    return { value: lines.length ? `At the moment ${lines.join(", ")}.` : null };
  }
  if (name === "pricing.pack") {
    const lines = packs.map((p) => `${p.credits} credits for ${pricing.currency} ${p.priceSar}`);
    return { value: lines.length ? `Credits are sold in packs: ${lines.join("; ")}.` : null };
  }
  if (name === "payments.status") {
    const on = process.env.PAYMENTS === "moyasar";
    return { value: on ? "" : "Buying credits on the site isn't switched on yet. This page describes how it will work once it is." };
  }
  return { value: null };
}

// ---------------------------------------------------------------------------------------------
// A small Markdown subset: # headings, paragraphs, "- " lists, | tables |, **bold**, [links](/path).
// Everything is escaped first; only these constructs produce markup.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function inline(text: string, slug: string, unresolved: Set<string>): string {
  let out = esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
      const safe = /^(\/|#|mailto:|https:\/\/)/.test(href) ? href : "#";
      return `<a class="link" href="${safe}">${label}</a>`;
    });
  out = out.replace(/\{\{([a-zA-Z.]+)\}\}/g, (_m, name: string) => {
    const t = tokenValue(name, slug);
    if (t.value === null || t.value === undefined) {
      unresolved.add(name);
      return `<mark class="todo" title="Not confirmed yet: ${esc(name)}">to confirm: ${esc(name.split(".").pop()!)}</mark>`;
    }
    if (t.pending) unresolved.add(`${name} (needs sign-off)`);
    const v = esc(t.value);
    const shown = t.email && t.value ? `<a class="link" href="mailto:${v}">${v}</a>` : v;
    return t.pending ? `<mark class="todo" title="Matches the code; needs the founders' sign-off">${shown}</mark>` : shown;
  });
  return out;
}

function render(md: string, slug: string, unresolved: Set<string>): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const hm = /^(#{1,3}) (.+)$/.exec(line);
    if (hm) {
      const level = hm[1].length;
      const body = inline(hm[2], slug, unresolved);
      out.push(level === 1 ? `<h1 class="h1">${body}</h1>` : `<h${level} id="${slugify(body)}">${body}</h${level}>`);
      i++; continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) items.push(`<li>${inline(lines[i++].slice(2), slug, unresolved)}</li>`);
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i++].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
      }
      const [head, ...body] = rows;
      out.push(`<div class="table-scroll" tabindex="0" role="region" aria-label="Table"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c, slug, unresolved)}</th>`).join("")}</tr></thead>` +
        `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c, slug, unresolved)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3} |- |\|)/.test(lines[i])) para.push(lines[i++]);
    const html = inline(para.join(" "), slug, unresolved);
    if (html.trim()) out.push(`<p>${html}</p>`);
  }
  return out.join("\n");
}

export interface RenderedDoc { slug: string; title: string; version: string; html: string; unresolved: string[] }

export function renderDoc(slug: string): RenderedDoc | null {
  if (!(LEGAL_DOCS as readonly string[]).includes(slug)) return null;
  const meta = legal.documents[slug];
  const unresolved = new Set<string>();
  const html = render(source(slug), slug, unresolved);
  return { slug, title: meta.title, version: meta.version, html, unresolved: [...unresolved] };
}

/** Everything still unconfirmed across all documents, plus the overall status. */
const paymentsSwitchedOn = () => process.env.PAYMENTS === "moyasar";

/** Payment-only decisions still missing; payments stay off in production until this is empty. */
export function paymentTermsMissing(): string[] {
  return legal.paymentsOnly.filter((k) => legal.unresolved[k] === null);
}

/**
 * Transfers outside Saudi Arabia that a purpose depends on, still without a recorded mechanism and risk
 * assessment (PDPL Art 29; Transfer Regulation Arts 4 and 7). "accounts" covers hosting and account
 * email; "generation" covers sending photos and prompts to the video model.
 */
export function transfersMissing(purpose: "accounts" | "generation"): string[] {
  return Object.entries(compliance.transfers)
    .filter(([, t]) => t.purposes.includes(purpose) && (!t.mechanism || !t.riskAssessment))
    .map(([k]) => k);
}

/** Whether new accounts can be opened: published policies, and safeguards for where account data goes. */
export function accountsOpen(): boolean {
  return !legalEnforced() || (legalStatus().published && transfersMissing("accounts").length === 0);
}

/** Whether photos and prompts may be sent to the video model. */
export function generationAllowed(): boolean {
  return !legalEnforced() || transfersMissing("generation").length === 0;
}

export function legalStatus(): { published: boolean; unresolved: string[] } {
  const all = new Set<string>();
  for (const slug of LEGAL_DOCS) for (const u of renderDoc(slug)!.unresolved) all.add(u);
  return { published: legal.status === "published" && all.size === 0, unresolved: [...all].sort() };
}

/** Whether people can be asked to agree to the terms (and so whether accounts can open). */
export function termsAvailable(): boolean {
  return !legalEnforced() || legalStatus().published;
}

/** The HTML that goes inside <main> for /legal/<slug>. */
export function legalPage(slug: string): { title: string; html: string } | null {
  const doc = renderDoc(slug);
  if (!doc) return null;
  const nav = `<nav class="legal__nav" aria-label="Policies"><ul>${LEGAL_DOCS.map((s) =>
    `<li><a href="/legal/${s}"${s === slug ? ' aria-current="page"' : ""}>${esc(legal.documents[s].title)}</a></li>`).join("")}</ul></nav>`;
  if (legalEnforced() && !legalStatus().published) {
    return {
      title: doc.title,
      html: `<div class="wrap page legal"><article class="prose"><h1 class="h1">${esc(doc.title)}</h1>` +
        `<p class="lead">This policy is being prepared. It will be published here before ${esc(site.brandName)} opens accounts.</p></article>${nav}</div>`,
    };
  }
  const draft = legal.status !== "published" || doc.unresolved.length
    ? `<p class="legal__draft" role="note"><strong>Draft for review, not in force.</strong> Highlighted items still need to be confirmed.</p>` : "";
  const body = draft ? doc.html.replace("</h1>", `</h1>${draft}`) : doc.html;
  return { title: doc.title, html: `<div class="wrap page legal"><article class="prose">${body}</article>${nav}</div>` };
}
