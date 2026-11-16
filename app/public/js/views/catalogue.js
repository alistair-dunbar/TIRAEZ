// Catalogue: search, niche and format filters, kept in the URL so Back returns to the same view.
import { ApiError } from "../api.js";
import { h, id } from "../dom.js";
import { errorText, formatName } from "../copy.js";
import { getDraft, loadCatalogue, rememberCatalogue, store } from "../state.js";
import { entry, loading, notice } from "./parts.js";

export async function catalogueView(ctx) {
  const node = h("div", { class: "wrap page" });
  const head = h("div", { class: "page__head" },
    h("h1", { class: "h1" }, "Templates"),
    h("p", { class: "lead" }, "Each template is a creative direction for one kind of business. Choose one to see what it needs from your photo."),
  );
  node.append(head);
  const body = h("div", {}, loading("Loading templates"));
  node.append(body);

  let cat;
  try { cat = await loadCatalogue(); }
  catch (e) {
    body.replaceChildren(notice("We couldn't load the templates", errorText[e instanceof ApiError ? e.code : "offline"],
      { error: true, actions: [h("button", { type: "button", class: "btn btn--secondary", onclick: () => location.reload() }, "Try again")] }));
    return { title: "Templates", node };
  }

  const draft = getDraft();
  const changing = ctx.query.get("change") === "1" && draft?.templateId;
  if (changing) {
    head.append(notice("Choose a new template",
      "Your photo and the details you entered stay with you. Anything the new template doesn't use is set aside, and we'll tell you what changed."));
  }
  if (!store.site.generationOn) head.append(h("p", { class: "status-note" }, errorText.generation_not_configured));

  const state = {
    q: ctx.query.get("q") ?? "",
    niche: cat.niches.some((n) => n.id === ctx.query.get("niche")) ? ctx.query.get("niche") : "all",
    format: formatName[ctx.query.get("format")] ? ctx.query.get("format") : "any",
  };
  const searchId = id("search"), formatId = id("format");
  const search = h("input", { class: "input", id: searchId, type: "search", value: state.q, autocomplete: "off", spellcheck: "false" });
  const format = h("select", { class: "select", id: formatId },
    h("option", { value: "any" }, "Any format"),
    Object.entries(formatName).map(([v, l]) => h("option", { value: v }, l)));
  format.value = state.format;
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Filter by business" });
  const reset = h("button", { type: "button", class: "btn btn--quiet" }, "Reset filters");
  const count = h("p", { class: "result-count", role: "status", "aria-live": "polite" });
  const list = h("div", { class: "entries" });
  const empty = h("div", { class: "empty", hidden: true });

  function matches(t) {
    if (state.niche !== "all" && t.niche !== state.niche) return false;
    if (state.format !== "any" && !t.output.aspectRatios.includes(state.format)) return false;
    const q = state.q.trim().toLowerCase();
    if (!q) return true;
    return [t.name, t.summary, t.outcome, cat.niches.find((n) => n.id === t.niche)?.label].join(" ").toLowerCase().includes(q);
  }

  function sync() {
    const params = new URLSearchParams();
    if (state.q.trim()) params.set("q", state.q.trim());
    if (state.niche !== "all") params.set("niche", state.niche);
    if (state.format !== "any") params.set("format", state.format);
    if (changing) params.set("change", "1");
    const url = `/templates${params.size ? `?${params}` : ""}`;
    history.replaceState(null, "", url);
    rememberCatalogue(url);
  }

  function draw() {
    const shown = cat.templates.filter(matches);
    const filtered = state.q.trim() || state.niche !== "all" || state.format !== "any";
    chips.replaceChildren(...[{ id: "all", label: "All" }, ...cat.niches].map((n) =>
      h("button", { type: "button", class: "chip", "aria-pressed": String(state.niche === n.id), onclick: () => { state.niche = n.id; update(); } }, n.label)));
    reset.hidden = !filtered;
    count.textContent = filtered ? `Showing ${shown.length} of ${cat.templates.length} templates` : `${cat.templates.length} templates`;
    list.replaceChildren(...shown.map((t) => entry(t, { headingLevel: "h2" })));
    list.hidden = shown.length === 0;
    empty.hidden = shown.length !== 0;
    if (!shown.length) {
      const niche = cat.niches.find((n) => n.id === state.niche)?.label;
      empty.replaceChildren(
        h("h2", { class: "h3" }, "No templates match"),
        h("p", { class: "muted" }, [state.q.trim() ? `Nothing matches "${state.q.trim()}"` : "Nothing matches these filters",
          niche ? ` in ${niche}` : "", state.format !== "any" ? ` in ${formatName[state.format]}` : "", "."].join("")),
        h("button", { type: "button", class: "btn btn--secondary", onclick: resetAll }, "Reset filters"),
      );
    }
  }
  function update() { sync(); draw(); }
  function resetAll() { state.q = ""; state.niche = "all"; state.format = "any"; search.value = ""; format.value = "any"; update(); search.focus(); }

  search.addEventListener("input", () => { state.q = search.value; update(); });
  format.addEventListener("change", () => { state.format = format.value; update(); });
  reset.addEventListener("click", resetAll);

  body.replaceChildren(
    h("div", { class: "filters" },
      h("div", { class: "filters__row" },
        h("div", { class: "field" }, h("label", { class: "field__label", for: searchId }, "Search templates"), search),
        h("div", { class: "field" }, h("label", { class: "field__label", for: formatId }, "Format"), format),
        reset,
      ),
      chips,
    ),
    count, list, empty,
  );
  sync();
  draw();
  return { title: "Templates", node };
}
