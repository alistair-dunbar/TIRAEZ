// One template: what it makes, what it needs, its settings and cost. No preview frame until media is approved.
import { api, ApiError } from "../api.js";
import { h } from "../dom.js";
import { credits, errorText, formatName } from "../copy.js";
import { catalogueUrl, loadCatalogue, nicheLabel, store } from "../state.js";
import { notice, previewMedia } from "./parts.js";

export async function templateView(ctx) {
  const [slug] = ctx.params;
  let t;
  try {
    await loadCatalogue();
    t = await api("GET", `/api/templates/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return notFound();
    throw e;
  }
  const back = catalogueUrl();
  const cost = Object.entries(t.cost).map(([d, c]) => `${credits(c)} for a ${d}-second video`).join(", ");

  const action = t.ready
    ? h("a", { class: "btn btn--primary btn--lg", href: `/create/${t.slug}` }, "Use this template")
    : notice("Not available to use yet", errorText[t.unavailableReason] ?? errorText.template_unavailable);

  const node = h("div", { class: "wrap page" },
    h("nav", { "aria-label": "Breadcrumb" }, h("ol", { class: "crumbs" },
      h("li", {}, h("a", { href: back }, "Templates")), h("li", { "aria-hidden": "true" }, "/"),
      h("li", {}, h("a", { href: `/templates?niche=${t.niche}` }, nicheLabel(t.niche))))),
    h("div", { class: "page__head" },
      h("h1", { class: "h1" }, t.name),
      h("p", { class: "lead" }, t.outcome),
    ),
    t.preview ? previewMedia(t) : null,
    h("div", { class: "result" },
      h("div", { class: "stack" },
        h("section", { class: "panel" }, h("h2", { class: "h3" }, "Your photo"),
          h("ul", { class: "plain-list" }, t.photoGuidance.map((g) => h("li", {}, g)))),
        h("section", { class: "panel" }, h("h2", { class: "h3" }, "What you'll be asked for"),
          h("ul", { class: "plain-list" }, t.inputs.map((i) => h("li", {}, i.label, h("span", { class: "muted" }, i.required ? " (required)" : " (optional)"))))),
        h("section", { class: "panel" }, h("h2", { class: "h3" }, "Good to know"),
          h("ul", { class: "plain-list" }, t.limitations.map((l) => h("li", {}, l)))),
      ),
      h("aside", { class: "panel summary", "aria-label": "Settings and cost" },
        h("h2", { class: "h3" }, "Settings"),
        h("dl", {},
          h("dt", {}, "Formats"), h("dd", {}, t.output.aspectRatios.map((r) => formatName[r]).join(", ")),
          h("dt", {}, "Length"), h("dd", {}, `${t.output.durations.join(" or ")} seconds`),
          h("dt", {}, "Resolution"), h("dd", {}, t.output.resolutions.join(" or ")),
          h("dt", {}, "Sound"), h("dd", {}, "None. Add music in TikTok or Instagram."),
          h("dt", {}, "Cost"), h("dd", {}, cost),
        ),
        action,
        store.site.user ? null : t.ready ? h("p", { class: "small muted" }, "You'll be asked to sign in first.") : null,
        h("a", { class: "link", href: back }, "Back to templates"),
      ),
    ),
  );
  return { title: t.name, node };
}

function notFound() {
  return {
    title: "Template not found",
    node: h("div", { class: "wrap page" },
      h("div", { class: "page__head" }, h("h1", { class: "h1" }, "We can't find that template"),
        h("p", { class: "lead" }, "It may have been renamed or removed.")),
      h("a", { class: "btn btn--primary", href: "/templates" }, "Explore templates")),
  };
}
