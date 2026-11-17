// Landing page: typography-led, built from the real catalogue. No sample media.
import { h } from "../dom.js";
import { credits, errorText, formatName } from "../copy.js";
import { loadCatalogue, store } from "../state.js";
import { entry, notice } from "./parts.js";

const numberWord = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const count = (n) => numberWord[n] ?? String(n);
const pad = (n) => String(n).padStart(2, "0");

export async function landingView(ctx) {
  const cat = await loadCatalogue();
  const site = store.site;
  const byNiche = (id) => cat.templates.filter((t) => t.niche === id);
  const ratios = [...new Set(cat.templates.flatMap((t) => t.output.aspectRatios))].sort((a, b) => ["9:16", "1:1", "16:9"].indexOf(a) - ["9:16", "1:1", "16:9"].indexOf(b));
  const durations = [...new Set(cat.templates.flatMap((t) => t.output.durations))];
  const resolutions = [...new Set(cat.templates.flatMap((t) => t.output.resolutions))];
  let filter = "all";

  const paid = ctx.query.get("paid");
  const paymentNotice = paid === "1"
    ? notice("Payment received", "Your credits are in your account.", { ok: true })
    : paid === "0" ? notice("The payment wasn't completed", "You haven't been charged.", { error: true }) : null;
  if (paid) history.replaceState(null, "", "/");

  // Hero: the headline carries the page; the niche index beside it is a real way in.
  const hero = h("section", { class: "hero", "aria-labelledby": "hero-title" },
    h("div", { class: "wrap" },
      h("div", { class: "hero__grid" },
        h("div", { class: "hero__copy" },
          paymentNotice,
          h("p", { class: "hero__fact" }, `${cat.templates.length} video templates for ${count(cat.niches.length)} kinds of business`),
          h("h1", { class: "hero__title", id: "hero-title" }, "Your next video starts with ", h("em", {}, "a photo.")),
          h("p", { class: "hero__lead" }, "Choose a template for your business, add your photo and a few details, and create a video ready to share."),
          h("div", { class: "btn-row" },
            h("a", { class: "btn btn--primary btn--lg", href: "/templates" }, "Explore templates"),
            h("a", { class: "link", href: "#how-it-works" }, "See how it works"),
          ),
        ),
        h("nav", { class: "niche-picker hero__index", "aria-labelledby": "niche-picker-title" },
          h("p", { class: "niche-picker__title", id: "niche-picker-title" }, "Choose your niche", h("span", {}, `${cat.niches.length} kinds`)),
          h("ul", {}, cat.niches.map((n, i) => h("li", {},
            h("a", { href: `/templates?niche=${n.id}` },
              h("span", { class: "n", "aria-hidden": "true" }, pad(i + 1)),
              h("span", { class: "l" }, n.label),
              h("span", { class: "c" }, `${byNiche(n.id).length} templates`),
            )))),
        ),
      ),
      h("dl", { class: "specs" },
        h("div", {}, h("dt", {}, "Formats"), h("dd", {}, ratios.map((r) => h("span", { class: "entry__formats" }, h("span", { class: "ratio", dataset: { r }, "aria-hidden": "true" }), formatName[r])))),
        h("div", {}, h("dt", {}, "Length"), h("dd", {}, `${durations.join(" or ")} seconds`)),
        h("div", {}, h("dt", {}, "Resolution"), h("dd", {}, resolutions.join(" or "))),
        h("div", {}, h("dt", {}, "Sound"), h("dd", {}, "Silent, ready for your own music")),
      ),
    ),
  );

  // Template discovery, on its own surface
  const list = h("div", { class: "entries" });
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Filter by business" });
  const more = h("a", { class: "link" });
  function draw(animate) {
    const shown = (filter === "all" ? cat.templates : byNiche(filter)).slice(0, 6);
    list.replaceChildren(...shown.map((t) => entry(t, { animate })));
    chips.replaceChildren(...[{ id: "all", label: "All" }, ...cat.niches].map((n) =>
      h("button", { type: "button", class: "chip", "aria-pressed": String(filter === n.id), onclick: (e) => {
        if (filter === n.id) return;
        filter = n.id; draw(true);
        chips.querySelector(`[data-id="${n.id}"]`)?.focus();
      }, dataset: { id: n.id } }, n.label, h("span", { class: "count" }, String(n.id === "all" ? cat.templates.length : byNiche(n.id).length)))));
    const total = filter === "all" ? cat.templates.length : byNiche(filter).length;
    more.href = filter === "all" ? "/templates" : `/templates?niche=${filter}`;
    more.textContent = filter === "all" ? `See all ${total} templates` : `See all ${total} ${cat.niches.find((n) => n.id === filter).label.toLowerCase()} templates`;
  }
  draw(false);
  const discovery = h("section", { class: "band", id: "templates", "aria-labelledby": "templates-title" },
    h("div", { class: "wrap" },
      h("div", { class: "section__head section__head--split" },
        h("h2", { class: "h2", id: "templates-title" }, "Find a look for your business."),
        h("div", { class: "stack" },
          h("p", { class: "lead" }, "Each template is a creative direction written for one kind of business. Pick one, and it guides the camera, the light and the movement."),
          site.generationOn ? null : h("p", { class: "status-note" }, errorText.generation_not_configured),
        ),
      ),
      h("div", { class: "filters" }, chips),
      list,
      h("p", { class: "section__more" }, more),
    ),
  );

  const how = h("section", { class: "section", id: "how-it-works", "aria-labelledby": "how-title" },
    h("div", { class: "wrap" },
      h("div", { class: "section__head" }, h("h2", { class: "h2", id: "how-title" }, "How it works")),
      h("ol", { class: "steps" },
        step(1, "Choose your look", "Pick your kind of business, then a template. Each one says what kind of photo it needs and what the video will show."),
        step(2, "Add your photo and details", "Upload one photo and frame it for vertical, square or landscape video. Describe your product in a few words and choose a couple of options."),
        step(3, "Generate and download", "We turn your choices into a detailed brief for the video model. When your video is ready, watch it and download the file."),
      ),
    ),
  );

  const value = h("section", { class: "section", "aria-labelledby": "value-title" },
    h("div", { class: "wrap split" },
      h("div", { class: "stack" },
        h("h2", { class: "h2", id: "value-title" }, "Built around how businesses post"),
        h("p", { class: "lead" }, "Everything in a template is set up for short social video, so the choices you make are the ones that matter."),
      ),
      h("dl", { class: "facts" },
        fact("Templates by business type", "Coffee shops, fashion, real estate, restaurants, beauty and products, each with templates written for what that business needs to show."),
        fact("A short form for your details", "Describe your product in a few words and choose from a handful of options. The detailed instructions for the video model are written for you."),
        fact("Settings for social video", "Vertical, square or landscape, at 1080p or 720p. You frame your photo yourself before anything is generated."),
        fact("Your videos in one place", "Finished videos are saved to your account under My videos, where you can watch and download them again."),
      ),
    ),
  );

  const p = site.pricing;
  const [dur, cost] = p ? Object.entries(p.creditsByDuration)[0] ?? [] : [];
  const pricing = p ? h("section", { class: "section", id: "pricing", "aria-labelledby": "pricing-title" },
    h("div", { class: "wrap split" },
      h("div", { class: "stack" },
        h("h2", { class: "h2", id: "pricing-title" }, "Pricing"),
        h("p", { class: "lead" }, "Videos are paid for with credits, bought in advance. There is no subscription."),
      ),
      h("dl", { class: "facts" },
        fact("Each video", `${credits(cost)} for a ${dur}-second video.`),
        fact("Credits", `A pack of ${p.pack.credits} credits costs ${p.currency} ${p.pack.priceSar}.`),
        site.paymentsOn ? null : fact("Buying credits", "Buying credits isn't available on the site yet."),
      ),
    ),
  ) : null;

  const closing = h("section", { class: "closing", "aria-labelledby": "closing-title" },
    h("div", { class: "wrap" },
      h("div", { class: "closing__inner" },
        h("div", { class: "stack" },
          h("h2", { class: "h2", id: "closing-title" }, "Start with a photo you already have."),
          h("p", {}, `Pick from ${cat.templates.length} templates and make a video for your business.`),
        ),
        h("a", { class: "btn btn--inverse btn--lg", href: "/templates" }, "Explore templates"),
      ),
    ),
  );

  return { title: null, node: h("div", {}, hero, discovery, how, value, pricing, closing) };
}

function step(n, title, text) {
  return h("li", { class: "step" },
    h("span", { class: "step__num", "aria-hidden": "true" }, pad(n)),
    h("h3", { class: "title" }, h("span", { class: "sr-only" }, `Step ${n}: `), title),
    h("p", {}, text),
  );
}

function fact(term, text) {
  return h("div", {}, h("dt", {}, term), h("dd", {}, text));
}
