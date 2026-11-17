// My videos: the logged-in customer's real jobs only, newest first.
import { api, ApiError } from "../api.js";
import { h } from "../dom.js";
import { credits, dateText, errorText } from "../copy.js";
import { setUser } from "../main.js";
import { store } from "../state.js";
import { loading, notice, setBusy, spinner } from "./parts.js";

const statusText = { queued: "Queued", generating: "Being made", completed: "Ready", failed: "Didn't work" };

export async function videosView(ctx) {
  const node = h("div", { class: "wrap page" });
  const balance = h("p", { class: "lead" });
  const buy = h("div");
  const body = h("div", {}, loading("Loading your videos"));
  node.append(h("div", { class: "page__head" }, h("h1", { class: "h1" }, "My videos"), balance, buy), body);

  let timer = null, stopped = false;
  ctx.onCleanup(() => { stopped = true; clearTimeout(timer); });

  async function load() {
    if (stopped) return;
    let data;
    try { data = await api("GET", "/api/jobs"); }
    catch (e) {
      body.replaceChildren(notice("We couldn't load your videos", errorText[e instanceof ApiError ? e.code : "offline"], { error: true,
        actions: [h("button", { type: "button", class: "btn btn--secondary", onclick: () => { body.replaceChildren(loading("Loading your videos")); load(); } }, "Try again")] }));
      return;
    }
    setUser({ ...store.site.user, credits: data.credits });
    balance.textContent = `You have ${credits(data.credits)}.`;
    drawBuy(data.credits);
    if (!data.jobs.length) {
      body.replaceChildren(h("div", { class: "empty" },
        h("h2", { class: "title" }, "Your videos will appear here."),
        h("a", { class: "btn btn--primary", href: "/templates" }, "Explore templates")));
      return;
    }
    body.replaceChildren(h("ul", { class: "video-grid" }, data.jobs.map(card)));
    if (data.jobs.some((j) => j.stage === "queued" || j.stage === "generating")) timer = setTimeout(load, 5000);
  }

  function drawBuy(have) {
    const p = store.site.pricing;
    if (!p) { buy.replaceChildren(); return; }
    if (!store.site.paymentsOn) {
      buy.replaceChildren(h("p", { class: "muted" }, `Credits come in a pack of ${p.pack.credits} for ${p.currency} ${p.pack.priceSar}. ${errorText.payments_not_configured}`));
      return;
    }
    const status = h("p", { class: "form-status", role: "status" });
    const btn = h("button", { type: "button", class: have > 0 ? "btn btn--secondary" : "btn btn--primary", onclick: async () => {
      setBusy(btn, true); status.textContent = "Opening the payment page";
      try {
        const r = await api("POST", "/api/purchases", { packId: p.pack.id });
        if (r.status === "redirect") { location.assign(r.url); return; }
        setUser({ ...store.site.user, credits: r.credits });
        load();
      } catch (e) { status.textContent = errorText[e instanceof ApiError ? e.code : "offline"] ?? errorText.server_error; setBusy(btn, false); }
    } }, `Pay ${p.currency} ${p.pack.priceSar} for ${p.pack.credits} credits`);
    buy.replaceChildren(h("div", { class: "btn-row" }, btn), status,
      h("p", { class: "notice-text" }, `Pressing "Pay" takes you to Moyasar's secure page to pay ${p.currency} ${p.pack.priceSar}, the total price. It's a one-off payment with no subscription. Within 7 days, you can cancel a pack you haven't used any credits from. See `,
        h("a", { class: "link", href: "/legal/billing" }, "Billing, credits and refunds"), "."));
  }

  load();
  return { title: "My videos", node };
}

function card(job) {
  const href = `/videos/${job.id}`;
  // The customer's own media only: the finished video's still, else their framed photo.
  const thumb = job.poster ?? (job.photo ? `/api/jobs/${job.id}/source.jpg` : null);
  const img = thumb ? h("img", { src: thumb, alt: "", loading: "lazy", decoding: "async" }) : null;
  if (img && !job.poster) img.addEventListener("error", () => { img.src = `/api/photos/${job.photo.id}.jpg`; }, { once: true });
  const ready = job.stage === "completed" && job.output?.available;
  const tagClass = { completed: "tag--ready", queued: "", generating: "tag--active", failed: "tag--failed" }[job.stage];
  const active = job.stage === "queued" || job.stage === "generating";
  return h("li", { class: "video-card" },
    h("a", { class: "video-card__thumb", href, tabindex: "-1", "aria-hidden": "true" }, img),
    h("div", { class: "video-card__body" },
      h("span", { class: `tag ${tagClass}` }, active ? spinner() : null, statusText[job.stage],
        job.stage === "completed" && !job.output?.available ? " · file unavailable" : ""),
      h("h2", { class: "entry__name" }, h("a", { href, "aria-label": `${job.template.name}, ${statusText[job.stage]}` }, job.template.name)),
      h("p", { class: "small muted" }, dateText(job.createdAt)),
    ),
    h("div", { class: "video-card__actions" },
      h("a", { class: "link", href }, ready ? "Watch" : "See status"),
      ready ? h("a", { class: "link", href: `/api/jobs/${job.id}/video.mp4?download=1`, download: "" }, "Download") : null,
    ),
  );
}
