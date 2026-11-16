// One generation: live status while it runs, the playable result when it's done, a plain
// explanation when it fails. Only reports what the server has confirmed.
import { api, ApiError } from "../api.js";
import { h } from "../dom.js";
import { bytesText, credits, dateText, errorText, failureText, formatName } from "../copy.js";
import { setUser } from "../main.js";
import { store } from "../state.js";
import { loading, notice, spinner } from "./parts.js";

export async function jobView(ctx) {
  const jobId = Number(ctx.params[0]);
  const node = h("div", { class: "wrap page" });
  const steps = h("ol", { class: "steps-bar", "aria-label": "Progress" },
    h("li", {}, "Template"), h("li", {}, "Your details"), h("li", { "aria-current": "step" }, "Generate"));
  const body = h("div", {}, loading("Loading your video"));
  node.append(steps, body);

  let timer = null, failures = 0, lastKey = "", stopped = false;
  ctx.onCleanup(() => { stopped = true; clearTimeout(timer); });

  async function poll() {
    if (stopped) return;
    let data;
    try {
      data = await api("GET", `/api/jobs/${jobId}`);
      failures = 0;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) { body.replaceChildren(missing()); return; }
      if (e instanceof ApiError && e.status === 401) { location.assign(`/signin?next=/videos/${jobId}`); return; }
      failures++;
      // Keep the last known state on screen; just say we can't update it right now.
      if (!lastKey) body.replaceChildren(heading("We can't load this video right now"), unavailable(true));
      else body.querySelector("[data-live]")?.replaceChildren(unavailable(true));
      timer = setTimeout(poll, Math.min(30000, 3000 * 2 ** failures));
      return;
    }
    const job = data.job;
    if (store.site.user && store.site.user.credits !== data.credits) setUser({ ...store.site.user, credits: data.credits });
    const key = JSON.stringify([job.stage, job.saving, job.queuePosition, job.statusUnavailable, job.output?.available, job.failure]);
    if (key !== lastKey) { render(job); lastKey = key; }
    if (job.stage === "queued" || job.stage === "generating") timer = setTimeout(poll, 3000);
  }

  function render(job) {
    steps.querySelector("[aria-current]").textContent = job.stage === "completed" ? "Generated" : "Generate";
    const template = job.template.slug;
    const again = template ? h("a", { class: "btn btn--secondary", href: `/create/${template}?from=${job.id}` }, "Create another version") : null;
    const choose = h("a", { class: "link", href: "/templates" }, "Choose another template");

    if (job.stage === "completed" && job.output?.available) {
      const src = `/api/jobs/${job.id}/video.mp4`;
      const video = h("video", { src, controls: true, playsinline: true, preload: "metadata", poster: job.poster ?? null,
        muted: true, "aria-label": `Your video: ${job.template.name}` });
      video.muted = true; // never plays with sound unless the viewer turns it on
      // Fill the column at the video's own shape, whatever its pixel size.
      const [rw, rh] = job.settings.aspectRatio.split(":").map(Number);
      video.style.setProperty("width", `min(100%, calc(78vh * ${rw / rh}))`);
      video.style.setProperty("aspect-ratio", `${rw} / ${rh}`);
      body.replaceChildren(
        heading("Your video is ready", job.template.name),
        h("div", { class: "result" },
          h("div", { class: "player" }, video),
          h("div", { class: "stack" },
            h("div", { class: "btn-row" },
              h("a", { class: "btn btn--primary btn--lg", href: `${src}?download=1`, download: "" }, "Download video"),
              again),
            choose,
            h("section", { class: "panel" }, h("h2", { class: "h3" }, "Details"), details(job)),
          ),
        ),
      );
      document.title = `Your video is ready · ${store.site.brandName}`;
      return;
    }
    if (job.stage === "completed") {
      body.replaceChildren(heading("This video file is no longer available", job.template.name),
        notice("The file can't be found", "You can make a new version with the same photo and details.", { error: true }),
        h("div", { class: "btn-row" }, again, choose));
      return;
    }
    if (job.stage === "failed") {
      const refund = job.failure?.refunded ? `The ${credits(job.credits)} for this video ${job.credits === 1 ? "has" : "have"} been returned to your account.` : null;
      body.replaceChildren(heading("This video didn't work", job.template.name),
        notice(failureText[job.failure?.code] ?? failureText.failed, refund, { error: true }),
        h("p", { class: "lead" }, "Your photo and details are saved, so you can try again or adjust them first."),
        h("div", { class: "btn-row" }, again, choose));
      return;
    }
    // Queued or generating: real states only, no invented progress.
    const title = job.stage === "generating" ? "Your video is being made" : "Your video is queued";
    const line = job.stage === "generating"
      ? (job.saving ? "The video model has finished. We're saving your video." : "The video model is working on your video.")
      : job.queuePosition ? `Waiting for the video model to start. It is number ${job.queuePosition} in the queue.` : "Waiting for the video model to start.";
    body.replaceChildren(
      heading(title, job.template.name),
      h("div", { class: "result" },
        h("div", { class: "stack" },
          h("div", { "data-live": "", role: "status" },
            job.statusUnavailable ? unavailable(false) : h("p", { class: "status-line lead" }, spinner(), h("span", {}, line))),
          h("p", {}, "You can leave this page. The video will be in My videos when it's ready."),
          h("div", { class: "btn-row" }, h("a", { class: "btn btn--secondary", href: "/videos" }, "Go to My videos"), choose),
        ),
        h("section", { class: "panel" }, h("h2", { class: "h3" }, "Details"), details(job)),
      ),
    );
  }

  function heading(text, sub) {
    return h("div", { class: "page__head" }, h("h1", { class: "h1" }, text), sub ? h("p", { class: "lead muted" }, sub) : null);
  }
  function unavailable(ourSide) {
    return notice("Status temporarily unavailable", ourSide
      ? "We can't reach the server right now. This page will keep trying."
      : "We can't get an update from the video model right now. Your video is still in progress and this page keeps checking.");
  }
  function missing() {
    return h("div", {}, heading("We can't find this video"), h("p", { class: "lead" }, errorText.not_found),
      h("a", { class: "btn btn--primary", href: "/videos" }, "Go to My videos"));
  }

  poll();
  return { title: "Your video", node };
}

function details(job) {
  const o = job.output;
  return h("dl", { class: "details" },
    h("dt", {}, "Template"), h("dd", {}, `${job.template.name}${job.template.current ? "" : " (an earlier version)"}`),
    h("dt", {}, "Format"), h("dd", {}, formatName[job.settings.aspectRatio]),
    o?.width ? [h("dt", {}, "Size"), h("dd", {}, `${o.width} × ${o.height} px`)] : [h("dt", {}, "Resolution"), h("dd", {}, job.settings.resolution)],
    h("dt", {}, "Length"), h("dd", {}, o?.duration ? `${o.duration.toFixed(1)} seconds` : `${job.settings.duration} seconds`),
    o?.bytes ? [h("dt", {}, "File"), h("dd", {}, `MP4, ${bytesText(o.bytes)}`)] : null,
    h("dt", {}, "Cost"), h("dd", {}, credits(job.credits)),
    h("dt", {}, "Created"), h("dd", {}, dateText(job.createdAt)),
  );
}
