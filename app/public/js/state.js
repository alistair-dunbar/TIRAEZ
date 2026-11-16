// Shared state: site facts, the catalogue, and the customer's unsent draft.
import { api } from "./api.js";

export const store = { site: null, catalogue: null };

export async function loadSite() {
  store.site = await api("GET", "/api/site");
  return store.site;
}

let cataloguePromise = null;
export function loadCatalogue() {
  if (store.catalogue) return Promise.resolve(store.catalogue);
  cataloguePromise ??= api("GET", "/api/templates")
    .then((c) => (store.catalogue = c))
    .finally(() => { cataloguePromise = null; });
  return cataloguePromise;
}

export const nicheLabel = (id) => store.catalogue?.niches.find((n) => n.id === id)?.label ?? id;

// The draft lives in this tab only (sessionStorage): it survives a refresh, not other devices.
const KEY = "video-draft";
export function getDraft() {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "null"); } catch { return null; }
}
export function setDraft(d) {
  try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage full or blocked: the form still works */ }
}
export function clearDraft() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function newKey() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9-]/g, "");
}

// Where the catalogue was (search and filters), so "Back to templates" returns to it.
export function rememberCatalogue(url) { try { sessionStorage.setItem("catalogue-url", url); } catch { /* ignore */ } }
export function catalogueUrl() { try { return sessionStorage.getItem("catalogue-url") ?? "/templates"; } catch { return "/templates"; } }
