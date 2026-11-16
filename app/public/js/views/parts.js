// Pieces shared by several views.
import { h } from "../dom.js";
import { formatName } from "../copy.js";
import { nicheLabel } from "../state.js";

export const formatsText = (t) =>
  `${t.output.aspectRatios.map((r) => formatName[r]).join(", ")} · ${t.output.durations.join(" or ")} seconds`;

/** A text-only catalogue entry. Approved preview media, when there is some, goes above the name. */
export function entry(t, { headingLevel = "h3", from = "" } = {}) {
  const detail = `/templates/${t.slug}${from}`;
  return h("article", { class: "entry" },
    t.preview ? previewMedia(t) : null,
    h("p", { class: "entry__niche" }, nicheLabel(t.niche)),
    h(headingLevel, { class: "title entry__name" }, h("a", { href: detail }, t.name)),
    h("p", {}, t.outcome),
    h("div", { class: "entry__meta" },
      h("span", { class: "entry__formats" }, formatsText(t)),
      t.ready
        ? h("a", { class: "link entry__action", href: `/create/${t.slug}`, "aria-label": `Use this template: ${t.name}` }, "Use this template")
        : h("a", { class: "link entry__action", href: detail, "aria-label": `See details: ${t.name}` }, "See details"),
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

export function notice(title, body, { error = false, actions = [] } = {}) {
  return h("div", { class: `notice${error ? " notice--error" : ""}`, role: error ? "alert" : null },
    h("p", { class: "notice__title" }, title),
    body ? h("p", {}, body) : null,
    actions.length ? h("div", { class: "btn-row" }, actions) : null,
  );
}
