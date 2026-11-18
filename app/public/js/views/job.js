// One generation: live status while it runs, the playable result when it's done, a plain
// explanation when it fails. Only reports what the server has confirmed.
import { api, ApiError } from "../api.js";
import { h } from "../dom.js";
import { bytesText, credits, dateText, dayText, errorText, failureText, formatName } from "../copy.js";
import { announce, navigate, setUser } from "../main.js";
import { store } from "../state.js";
import { loading, notice, progress, setBusy, spinner } from "./parts.js";

export async function jobView(ctx) {
  const jobId = Number(ctx.params[0]);
  const node = h("div", { class: "wrap page" });
  let steps = progress(2);
  const body = h("div", {}, loading("Loading your video"));
  node.append(steps, body);

  let timer = null, failures = 0, lastKey = "", lastStage = null, stopped = false;
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
    if (key !== lastKey) {
      render(job, lastStage !== null && lastStage !== job.stage);
      if (lastStage !== null && lastStage !== job.stage) announce(body.querySelector("h1")?.textContent ?? "");
      lastKey = key; lastStage = job.stage;
    }
    if (job.stage === "queued" || job.stage === "generating") timer = setTimeout(poll, 3000);
  }

  function render(job, changed) {
    const next = progress(job.stage === "completed" ? 3 : 2);
    steps.replaceWith(next); steps = next;
    const template = job.template.slug;
    const again = template ? h("a", { class: "btn btn--secondary", href: `/create/${template}?from=${job.id}` }, "Create another version") : null;
    const choose = h("a", { class: "link", href: "/templates" }, "Choose another template");
    // A crossfade marks a genuine change of state, never a routine refresh.
    const swap = (...children) => body.replaceChildren(h("div", { class: changed ? "swap" : "" }, children));

    if (job.stage === "completed" && job.output?.available) {
      const src = `/api/jobs/${job.id}/video.mp4`;
      const video = h("video", { src, controls: true, playsinline: true, preload: "metadata", poster: job.poster ?? null,
        muted: true, "aria-label": `Your video: ${job.template.name}` });
      video.muted = true; // never plays with sound unless the viewer turns it on
      // Fill the column at the video's own shape, whatever its pixel size.
      const [rw, rh] = job.settings.aspectRatio.split(":").map(Number);
      video.style.setProperty("width", `min(100%, calc(78vh * ${rw / rh}))`);
      video.style.setProperty("aspect-ratio", `${rw} / ${rh}`);
      const download = downloadButton(job, src);
      swap(
        heading("Your video is ready", job.template.name),
        h("div", { class: "result" },
          h("div", { class: `player${changed ? " is-in" : ""}`, "data-cursor": "play" }, video),
          h("div", { class: "stack" },
            rail("completed"),
            job.expiresAt ? h("p", { class: "expiry", "data-soon": job.expiringSoon ? "true" : null }, `Available to download until ${dayText(job.expiresAt)}.`) : null,
            job.expiringSoon ? notice("This video will be deleted soon", `Download a copy before ${dayText(job.expiresAt)}. After that it can't be recovered. Downloading doesn't change the date.`) : null,
            h("div", { class: "btn-row" }, download.button, again),
            download.status,
            h("p", { class: "notice-text" }, "Made by an AI model, so check the details before you post. Some platforms, including TikTok, require AI-generated ads to be labelled."),
            choose,
            h("section", { class: "panel" }, h("h2", { class: "h3" }, "Details"), details(job)),
            removeControl(job),
          ),
        ),
      );
      document.title = `Your video is ready · ${store.site.brandName}`;
      return;
    }
    if (job.stage === "completed" && job.expired) {
      swap(heading("This video has expired", job.template.name),
        h("div", { class: "stack" },
          notice(`The video file was deleted on ${dayText(job.expiredAt)}`, "We keep generated videos for 90 days. An expired video can't be recovered, but you can make a new one.", { error: true }),
          h("div", { class: "btn-row" }, again, choose), removeControl(job)));
      return;
    }
    if (job.stage === "completed") {
      swap(heading("This video file is no longer available", job.template.name),
        h("div", { class: "stack" },
          notice("The file can't be found", "You can make a new version with the same photo and details.", { error: true }),
          h("div", { class: "btn-row" }, again, choose), removeControl(job)));
      return;
    }
    if (job.stage === "failed") {
      const refund = job.failure?.refunded ? `The ${credits(job.credits)} for this video ${job.credits === 1 ? "has" : "have"} been returned to your account.` : null;
      swap(heading("This video didn't work", job.template.name),
        h("div", { class: "result" },
          h("div", { class: "stack" },
            rail("failed"),
            notice(failureText[job.failure?.code] ?? failureText.failed, refund, { error: true }),
            h("p", { class: "lead" }, "Your photo and details are saved, so you can try again or adjust them first."),
            h("div", { class: "btn-row" }, again, choose),
            removeControl(job)),
          h("section", { class: "panel" }, h("h2", { class: "h3" }, "Details"), details(job))));
      return;
    }
    // Queued or generating: real states only, no invented progress.
    const title = job.stage === "generating" ? "Your video is being made" : "Your video is queued";
    const line = job.stage === "generating"
      ? (job.saving ? "The video model has finished. We're saving your video." : "The video model is working on your video.")
      : job.queuePosition ? `Waiting for the video model to start. It is number ${job.queuePosition} in the queue.` : "Waiting for the video model to start.";
    swap(
      heading(title, job.template.name),
      h("div", { class: "result" },
        h("div", { class: "stack" },
          rail(job.stage),
          h("div", { "data-live": "", role: "status" },
            job.statusUnavailable ? unavailable(false) : h("p", { class: "status-line lead" }, spinner(), h("span", {}, line))),
          h("p", { class: "muted" }, "You can leave this page. The video will be in My videos when it's ready."),
          h("div", { class: "btn-row" }, h("a", { class: "btn btn--secondary", href: "/videos" }, "Go to My videos"), choose),
        ),
        h("section", { class: "panel" }, h("h2", { class: "h3" }, "Details"), details(job)),
      ),
    );
  }

  /** Deleting a finished video: one quiet link, then a plain confirmation of what goes. */
  function removeControl(job) {
    const box = h("div", { class: "remove" });
    const draw = () => box.replaceChildren(h("button", { type: "button", class: "btn btn--quiet btn--danger", onclick: ask }, "Delete this video"));
    function ask() {
      const status = h("p", { class: "form-status", role: "status" });
      const yes = h("button", { type: "button", class: "btn btn--destroy btn--sm", onclick: async () => {
        setBusy(yes, true);
        try {
          await api("DELETE", `/api/jobs/${job.id}`);
          stopped = true;
          await navigate("/videos", { replace: true });
          announce("The video has been deleted.");
        } catch (e) { setBusy(yes, false); status.textContent = errorText[e instanceof ApiError ? e.code : "offline"] ?? errorText.server_error; }
      } }, "Delete video");
      box.replaceChildren(h("div", { class: "danger-zone stack", role: "group", "aria-label": "Delete this video" },
        h("p", {}, "This deletes the video from our servers, and the photo it was made from unless another of your videos uses it. It can't be undone."),
        h("div", { class: "btn-row" }, yes, h("button", { type: "button", class: "btn btn--quiet", onclick: draw }, "Keep it")), status));
      yes.focus();
    }
    draw();
    return box;
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
    return h("div", { class: "stack" }, heading("We can't find this video"), h("p", { class: "lead" }, errorText.not_found),
      h("div", {}, h("a", { class: "btn btn--primary", href: "/videos" }, "Go to My videos")));
  }

  poll();
  return { title: "Your video", node };
}

/** Queued -> Being made -> Ready: the three states the server actually reports. */
function rail(stage) {
  const order = ["queued", "generating", "completed"];
  const at = stage === "failed" ? -1 : order.indexOf(stage);
  const labels = { queued: "Queued", generating: "Being made", completed: "Ready" };
  return h("ol", { class: "rail", "aria-label": "Video status" }, order.map((s, i) => {
    const state = stage === "failed" ? (i === 0 ? "failed" : "todo") : stage === "completed" && i === at ? "ready" : i < at ? "done" : i === at ? "current" : "todo";
    const label = stage === "failed" && i === 0 ? "Didn't work" : labels[s];
    return h("li", { "data-state": state, "aria-current": state === "current" ? "step" : null }, label);
  }));
}

/**
 * Downloads by fetching the file first, so we can say it actually arrived ("Downloaded ... 4.2 MB")
 * instead of guessing. Falls back to a plain link if the browser can't.
 */
function downloadButton(job, src) {
  const name = `${job.template.slug ?? "video"}-${job.id}.mp4`;
  const status = h("p", { class: "form-status", role: "status" });
  const button = h("a", { class: "btn btn--primary btn--lg", href: `${src}?download=1`, download: name, "data-magnetic": "" });
  button.textContent = "Download video";
  button.addEventListener("click", async (e) => {
    if (!window.fetch || !URL.createObjectURL) return; // let the link do it
    e.preventDefault();
    if (button.dataset.busy !== undefined) return;
    setBusy(button, true);
    status.textContent = "Preparing your download";
    try {
      const res = await fetch(`${src}?download=1`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = h("a", { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = `Downloaded ${name} (${bytesText(blob.size)}).`;
    } catch (err) {
      status.textContent = err.message === "410" ? errorText.file_unavailable : "The download didn't work. Try again.";
    } finally {
      setBusy(button, false);
    }
  });
  return { button, status };
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
