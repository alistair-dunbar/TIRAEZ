// Catalogue: search, niche and format filters, kept in the URL so Back returns to the same view.
import { ApiError } from "../api.js";
import { h, id, svg } from "../dom.js";
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
  // Format: a segmented control whose indicator slides to the chosen option.
  const indicator = h("span", { class: "segmented__ind", "aria-hidden": "true" });
  const formatButtons = [["any", "Any", null], ...Object.entries(formatName).map(([v, l]) => [v, l.split(" ")[1], v])].map(([v, label, r]) =>
    h("button", { type: "button", "aria-pressed": String(state.format === v), dataset: { v }, title: v === "any" ? "Any format" : formatName[v],
      "aria-label": v === "any" ? "Any format" : formatName[v], onclick: () => { state.format = v; update(true); } },
      r ? h("span", { class: "ratio", dataset: { r }, "aria-hidden": "true" }) : null, label));
  const format = h("div", { class: "segmented", role: "group", "aria-labelledby": formatId }, indicator, formatButtons);
  function placeIndicator(instant) {
    const on = formatButtons.find((b) => b.dataset.v === state.format);
    if (!on) return;
    if (instant) indicator.style.setProperty("transition", "none");
    indicator.style.setProperty("width", `${on.offsetWidth}px`);
    indicator.style.setProperty("transform", `translateX(${on.offsetLeft}px)`);
    if (instant) requestAnimationFrame(() => indicator.style.removeProperty("transition"));
  }
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Filter by business" });
  const reset = h("button", { type: "button", class: "btn btn--quiet" }, "Reset filters");
  const count = h("p", { class: "result-count", role: "status", "aria-live": "polite" });
  const list = h("div", { class: "entries", "data-stagger": "" });
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

  function draw(animate = false) {
    const shown = cat.templates.filter(matches);
    const filtered = state.q.trim() || state.niche !== "all" || state.format !== "any";
    const focused = document.activeElement?.dataset?.id;
    chips.replaceChildren(...[{ id: "all", label: "All" }, ...cat.niches].map((n) =>
      h("button", { type: "button", class: "chip", "aria-pressed": String(state.niche === n.id), dataset: { id: n.id },
        onclick: () => { if (state.niche !== n.id) { state.niche = n.id; update(true); } } },
        n.label, h("span", { class: "count" }, String(n.id === "all" ? cat.templates.length : cat.templates.filter((t) => t.niche === n.id).length)))));
    if (focused) chips.querySelector(`[data-id="${focused}"]`)?.focus();
    for (const b of formatButtons) b.setAttribute("aria-pressed", String(b.dataset.v === state.format));
    placeIndicator(!animate);
    reset.hidden = !filtered;
    count.textContent = filtered ? `Showing ${shown.length} of ${cat.templates.length} templates` : `${cat.templates.length} templates`;
    list.replaceChildren(...shown.map((t) => entry(t, { headingLevel: "h2", animate })));
    list.hidden = shown.length === 0;
    empty.hidden = shown.length !== 0;
    if (!shown.length) {
      const niche = cat.niches.find((n) => n.id === state.niche)?.label;
      empty.replaceChildren(
        h("h2", { class: "title" }, "No templates match"),
        h("p", { class: "muted" }, [state.q.trim() ? `Nothing matches "${state.q.trim()}"` : "Nothing matches these filters",
          niche ? ` in ${niche}` : "", state.format !== "any" ? ` in ${formatName[state.format]}` : "", "."].join("")),
        h("button", { type: "button", class: "btn btn--secondary", onclick: resetAll }, "Reset filters"),
      );
    }
  }
  function update(animate = false) { sync(); draw(animate); }
  function resetAll() { state.q = ""; state.niche = "all"; state.format = "any"; search.value = ""; update(true); search.focus(); }

  search.addEventListener("input", () => { state.q = search.value; update(false); });
  reset.addEventListener("click", resetAll);

  body.replaceChildren(
    h("div", { class: "filters" },
      h("div", { class: "filters__row" },
        h("div", { class: "field" }, h("label", { class: "field__label", for: searchId }, "Search templates"),
          h("div", { class: "search" }, svg('<svg viewBox="0 0 17 17" aria-hidden="true"><circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M11 11l4.5 4.5" stroke="currentColor" stroke-width="1.5"/></svg>'), search)),
        h("div", { class: "field" }, h("p", { class: "field__label", id: formatId }, "Format"), format),
        reset,
      ),
      chips,
    ),
    count, list, empty,
  );
  sync();
  draw();
  // Measure the segmented control once it is on the page and its font has loaded.
  requestAnimationFrame(() => placeIndicator(true));
  document.fonts?.ready.then(() => placeIndicator(true));
  const onResize = () => placeIndicator(true);
  window.addEventListener("resize", onResize);
  ctx.onCleanup(() => window.removeEventListener("resize", onResize));
  return { title: "Templates", node };
}
