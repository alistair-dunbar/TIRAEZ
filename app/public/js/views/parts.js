// Pieces shared by several views.
import { h } from "../dom.js";
import { credits, formatName } from "../copy.js";
import { nicheLabel } from "../state.js";

export const formatsText = (t) =>
  `${t.output.aspectRatios.map((r) => formatName[r]).join(", ")} · ${t.output.durations.join(" or ")} seconds`;

/** Small aspect-ratio glyphs plus the length, e.g. [▯][□] 5 s. */
export function formatGlyphs(t) {
  return h("span", { class: "entry__formats", "aria-label": formatsText(t) },
    t.output.aspectRatios.map((r) => h("span", { class: "ratio", dataset: { r }, title: formatName[r], "aria-hidden": "true" })),
    h("span", { "aria-hidden": "true" }, `${t.output.durations.join("/")} s`));
}

/**
 * A catalogue entry: a paper sheet that opens the template anywhere you click, with its main action
 * as a separate button. Approved preview media, when there is some, goes above the name.
 */
export function entry(t, { headingLevel = "h3", animate = false } = {}) {
  const detail = `/templates/${t.slug}`;
  return h("article", { class: `entry${animate ? " is-in" : ""}` },
    t.preview ? previewMedia(t) : null,
    h("div", { class: "entry__top" },
      h("span", { class: "entry__niche" }, nicheLabel(t.niche)),
      formatGlyphs(t)),
    h(headingLevel, { class: "entry__name" }, h("a", { href: detail }, t.name)),
    h("p", { class: "entry__desc" }, t.outcome),
    h("div", { class: "entry__foot" },
      t.ready
        ? h("a", { class: "btn btn--secondary btn--sm", href: `/create/${t.slug}`, "aria-label": `Use this template: ${t.name}` }, "Use this template")
        : h("a", { class: "btn btn--secondary btn--sm", href: detail, "aria-label": `See details: ${t.name}` }, "See details"),
      t.ready ? h("span", { class: "note" }, credits(Object.values(t.cost)[0])) : null,
    ),
  );
}

/**
 * Approved template preview (poster first, video only on request). Nothing is approved yet, so
 * this never renders today; it is here so approved media can be added without rebuilding the list.
 */
export function previewMedia(t) {
  if (!t.preview) return null;
  return h("img", { src: t.preview.poster, alt: "", loading: "lazy", decoding: "async", class: "entry__preview" });
}

export function spinner() {
  return h("span", { class: "spinner", "aria-hidden": "true" });
}

export function loading(text) {
  return h("div", { class: "state", role: "status" }, spinner(), h("span", {}, text));
}

export function notice(title, body, { error = false, ok = false, actions = [] } = {}) {
  return h("div", { class: `notice${error ? " notice--error" : ""}${ok ? " notice--ok" : ""}`, role: error ? "alert" : null },
    h("p", { class: "notice__title" }, title),
    body ? h("p", {}, body) : null,
    actions.length ? h("div", { class: "btn-row" }, actions) : null,
  );
}

/** Busy state: the label stays (so the width never changes), a spinner covers it, clicks are ignored. */
export function setBusy(btn, busy) {
  if (busy) { btn.dataset.busy = ""; btn.setAttribute("aria-busy", "true"); btn.disabled = true; }
  else { delete btn.dataset.busy; btn.removeAttribute("aria-busy"); btn.disabled = false; }
}

/** Template -> Your details -> Generate, marking what's done and where you are. */
export function progress(current, { templateHref = null } = {}) {
  const steps = ["Template", "Your details", "Generate"];
  return h("ol", { class: "progress", "aria-label": "Progress" }, steps.map((label, i) => {
    const state = i < current ? "done" : i === current ? "current" : "todo";
    const inner = [h("span", { class: "dot", "aria-hidden": "true" }, String(i + 1)), h("span", {}, label),
      state === "done" ? h("span", { class: "sr-only" }, " (done)") : null];
    return h("li", { "data-state": state, "aria-current": state === "current" ? "step" : null },
      i === 0 && templateHref && state === "done" ? h("a", { href: templateHref }, inner) : inner);
  }));
}
