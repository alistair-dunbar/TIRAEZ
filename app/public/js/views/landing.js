// Landing page: typography-led, built from the real catalogue. No sample media.
import { h } from "../dom.js";
import { errorText, pricingSentences } from "../copy.js";
import { loadCatalogue, store } from "../state.js";
import { entry, notice } from "./parts.js";

const numberWord = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const count = (n) => numberWord[n] ?? String(n);

export async function landingView(ctx) {
  const cat = await loadCatalogue();
  const site = store.site;
  const byNiche = (id) => cat.templates.filter((t) => t.niche === id);
  let filter = "all";

  const paid = ctx.query.get("paid");
  const paymentNotice = paid === "1"
    ? notice("Payment received", "Your credits are in your account.")
    : paid === "0" ? notice("The payment wasn't completed", "You haven't been charged.", { error: true }) : null;
  if (paid) history.replaceState(null, "", "/");

  // Hero
  const hero = h("section", { class: "hero", "aria-labelledby": "hero-title" },
    h("div", { class: "wrap hero__grid" },
      h("div", { class: "hero__copy" },
        paymentNotice,
        h("p", { class: "hero__fact" }, `${cat.templates.length} video templates for ${count(cat.niches.length)} kinds of business`),
        h("h1", { class: "display", id: "hero-title" }, "Your next video starts with a photo."),
        h("p", { class: "lead" }, "Choose a template for your business, add your photo and a few details, and create a video ready to share."),
        h("div", { class: "btn-row" },
          h("a", { class: "btn btn--primary btn--lg", href: "/templates" }, "Explore templates"),
          h("a", { class: "link", href: "#how-it-works" }, "See how it works"),
        ),
      ),
      h("nav", { class: "niche-picker", "aria-labelledby": "niche-picker-title" },
        h("p", { class: "niche-picker__title", id: "niche-picker-title" }, "Choose your niche"),
        h("ul", {}, cat.niches.map((n) => h("li", {},
          h("a", { href: `/templates?niche=${n.id}` },
            h("span", {}, n.label),
            h("span", {}, `${byNiche(n.id).length} templates`),
          )))),
      ),
    ),
  );

  // Template discovery
  const list = h("div", { class: "entries" });
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Filter by business" });
  const more = h("a", { class: "link" });
  function draw() {
    const shown = (filter === "all" ? cat.templates : byNiche(filter)).slice(0, 6);
    list.replaceChildren(...shown.map((t) => entry(t)));
    chips.replaceChildren(...[{ id: "all", label: "All" }, ...cat.niches].map((n) =>
      h("button", { type: "button", class: "chip", "aria-pressed": String(filter === n.id), onclick: () => { filter = n.id; draw(); } }, n.label)));
    const total = filter === "all" ? cat.templates.length : byNiche(filter).length;
    more.href = filter === "all" ? "/templates" : `/templates?niche=${filter}`;
    more.textContent = filter === "all" ? `See all ${total} templates` : `See all ${total} ${cat.niches.find((n) => n.id === filter).label.toLowerCase()} templates`;
  }
  draw();
  const discovery = h("section", { class: "section", id: "templates", "aria-labelledby": "templates-title" },
    h("div", { class: "wrap" },
      h("div", { class: "section__head" },
        h("h2", { class: "h2", id: "templates-title" }, "Find a look for your business."),
        h("p", { class: "lead" }, "Each template is a creative direction written for one kind of business. Pick one, and it guides the camera, the light and the movement."),
        site.generationOn ? null : h("p", { class: "status-note" }, errorText.generation_not_configured),
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
    h("div", { class: "wrap" },
      h("div", { class: "section__head" }, h("h2", { class: "h2", id: "value-title" }, "Built around how businesses post")),
      h("dl", { class: "facts" },
        fact("Templates by business type", "Coffee shops, fashion, real estate, restaurants, beauty and products, each with templates written for what that business needs to show."),
        fact("A short form for your details", "Describe your product in a few words and choose from a handful of options. The detailed instructions for the video model are written for you."),
        fact("Settings for social video", "Vertical, square or landscape, at 1080p or 720p. You frame your photo yourself before anything is generated."),
        fact("Your videos in one place", "Finished videos are saved to your account under My videos, where you can watch and download them again."),
      ),
    ),
  );

  const priceLines = pricingSentences(site.pricing, site.paymentsOn);
  const pricing = priceLines.length ? h("section", { class: "section", id: "pricing", "aria-labelledby": "pricing-title" },
    h("div", { class: "wrap" },
      h("div", { class: "rule-top pricing-line" },
        h("h2", { class: "h2", id: "pricing-title" }, "Pricing"),
        priceLines.map((p) => h("p", { class: "lead" }, p)),
      ),
    ),
  ) : null;

  const closing = h("section", { class: "closing", "aria-labelledby": "closing-title" },
    h("div", { class: "wrap" },
      h("div", { class: "closing__inner" },
        h("h2", { class: "h2", id: "closing-title" }, "Start with a photo you already have."),
        h("a", { class: "btn btn--primary btn--lg", href: "/templates" }, "Explore templates"),
      ),
    ),
  );

  return { title: null, node: h("div", {}, hero, discovery, how, value, pricing, closing) };
}

function step(n, title, text) {
  return h("li", { class: "step" },
    h("span", { class: "step__num", "aria-hidden": "true" }, String(n)),
    h("h3", { class: "title" }, h("span", { class: "sr-only" }, `Step ${n}: `), title),
    h("p", {}, text),
  );
}

function fact(term, text) {
  return h("div", {}, h("dt", {}, term), h("dd", {}, text));
}
