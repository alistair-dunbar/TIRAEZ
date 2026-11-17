// The creation workspace: Template -> Your details -> Generate.
import { api, ApiError, uploadPhoto } from "../api.js";
import { cropper, framingFromPixels } from "../crop.js";
import { h, id } from "../dom.js";
import { credits, errorText, formatName, tooLarge, tooSmall } from "../copy.js";
import { navigate, setUser } from "../main.js";
import { getDraft, loadCatalogue, newKey, nicheLabel, setDraft, store } from "../state.js";
import { notice, progress, setBusy, spinner } from "./parts.js";
import { policyLink } from "./forms.js";

const ACCEPT = "image/jpeg,image/png,image/webp";

export async function createView(ctx) {
  const [slug] = ctx.params;
  const cat = await loadCatalogue();
  const t = cat.templates.find((x) => x.slug === slug);
  if (!t) {
    return { title: "Template not found", node: h("div", { class: "wrap page" },
      h("div", { class: "page__head" }, h("h1", { class: "h1" }, "We can't find that template")),
      h("a", { class: "btn btn--primary", href: "/templates" }, "Explore templates")) };
  }
  if (!t.ready) {
    return { title: t.name, node: h("div", { class: "wrap page" },
      h("div", { class: "page__head" }, h("h1", { class: "h1" }, t.name), notice("This template can't be used yet", errorText[t.unavailableReason])),
      h("div", { class: "btn-row" }, h("a", { class: "btn btn--secondary", href: `/templates/${t.slug}` }, "See template details"), h("a", { class: "link", href: "/templates" }, "Back to templates"))) };
  }

  // ---- Draft: restore, carry over from another template, or prefill from an earlier video ----
  const notes = [];
  let draft = getDraft();
  const fromId = ctx.query.get("from");
  if (fromId) {
    try {
      const { job } = await api("GET", `/api/jobs/${fromId}`);
      draft = {
        templateId: job.template.id, photo: job.photo ? { ...job.photo, name: "Photo from your earlier video" } : null,
        framings: job.photo ? { [job.settings.aspectRatio]: framingFromPixels(job.photo, job.settings.aspectRatio, job.crop) } : {},
        inputs: job.inputs, settings: job.settings, clientKey: newKey(), fromJob: job.id,
      };
      notes.push(notice("Your earlier details are filled in", `Check them, change anything you like, then generate. A new version uses ${credits(t.cost[job.settings.duration] ?? 1)}.`));
      if (!job.photo) notes.push(notice("Your earlier photo is no longer available", "Upload a photo to continue."));
      if (job.template.id === t.id && !job.template.current) notes.push(notice("This template has changed", "It has been updated since your earlier video, so the new version may look different."));
      history.replaceState(null, "", `/create/${t.slug}`);
    } catch { /* fall back to whatever draft there is */ }
  }
  if (!draft) draft = { templateId: t.id, photo: null, framings: {}, inputs: {}, settings: {}, clientKey: newKey() };
  if (draft.templateId !== t.id) {
    const reset = [];
    const inputs = {};
    for (const i of t.inputs) {
      const v = draft.inputs?.[i.id];
      if (v === undefined || v === "") continue;
      if (i.type === "select" ? i.options.some((o) => o.value === v) : String(v).length <= i.maxLength) inputs[i.id] = v;
    }
    const s = draft.settings ?? {};
    const settings = {};
    if (t.output.aspectRatios.includes(s.aspectRatio)) settings.aspectRatio = s.aspectRatio; else if (s.aspectRatio) reset.push(`format (${formatName[s.aspectRatio]} isn't available here, so it's now ${formatName[t.output.defaultAspectRatio]})`);
    if (t.output.durations.includes(Number(s.duration))) settings.duration = Number(s.duration); else if (s.duration) reset.push(`length (now ${t.output.defaultDuration} seconds)`);
    if (t.output.resolutions.includes(s.resolution)) settings.resolution = s.resolution; else if (s.resolution) reset.push(`resolution (now ${t.output.defaultResolution})`);
    const dropped = Object.keys(draft.inputs ?? {}).filter((k) => draft.inputs[k] && !(k in inputs));
    if (reset.length || dropped.length) {
      notes.push(notice("Some choices didn't carry over",
        [reset.length ? `We reset the ${reset.join(", and the ")}.` : "", dropped.length ? `This template doesn't use ${dropped.length === 1 ? "one of your earlier details" : "some of your earlier details"}.` : ""].join(" ").trim()));
    } else if (draft.photo) {
      notes.push(notice("Your photo and details came with you", "Check them for this template, then generate."));
    }
    draft = { ...draft, templateId: t.id, inputs, settings, clientKey: newKey() };
  }
  const settings = {
    aspectRatio: t.output.aspectRatios.includes(draft.settings?.aspectRatio) ? draft.settings.aspectRatio : t.output.defaultAspectRatio,
    duration: t.output.durations.includes(Number(draft.settings?.duration)) ? Number(draft.settings.duration) : t.output.defaultDuration,
    resolution: t.output.resolutions.includes(draft.settings?.resolution) ? draft.settings.resolution : t.output.defaultResolution,
  };
  draft.settings = settings;
  draft.framings ??= {};
  draft.clientKey ??= newKey();
  const save = () => setDraft(draft);
  save();

  // ---- Summary (right column) ----
  const sumFormat = h("dd"), sumLength = h("dd"), sumRes = h("dd"), sumCost = h("dd");
  const summary = h("section", { class: "sheet summary", "aria-labelledby": "summary-title" },
    h("div", { class: "panel__head" }, h("p", { class: "label" }, nicheLabel(t.niche)), h("a", { class: "link small", href: "/templates?change=1" }, "Change template")),
    h("h2", { class: "title", id: "summary-title" }, t.name),
    h("p", { class: "muted" }, t.summary),
    h("dl", { class: "rows" }, h("dt", {}, "Format"), sumFormat, h("dt", {}, "Length"), sumLength, h("dt", {}, "Resolution"), sumRes, h("dt", {}, "Cost"), sumCost),
  );
  const photoPanel = h("section", { class: "panel", "aria-labelledby": "photo-title", hidden: true },
    h("div", { class: "panel__head" }, h("h2", { class: "h3", id: "photo-title" }, "Your photo"), h("span", { class: "small muted", "data-format": "" })),
  );
  const cropError = h("p", { class: "field__error", id: id("crop-error") });
  let crop = null;

  function drawCrop() {
    photoPanel.querySelectorAll(".crop").forEach((n) => n.remove());
    photoPanel.hidden = !draft.photo;
    if (!draft.photo) { crop = null; return; }
    photoPanel.querySelector("[data-format]").textContent = `Framed for ${formatName[settings.aspectRatio]}`;
    crop = cropper({
      photo: draft.photo, src: `/api/photos/${draft.photo.id}.jpg`, aspect: settings.aspectRatio,
      framing: draft.framings[settings.aspectRatio],
      onChange: (f) => { draft.framings[settings.aspectRatio] = f; cropError.textContent = ""; save(); },
    });
    photoPanel.append(crop.node, cropError);
  }

  // ---- Upload ----
  const fileId = id("photo"), uploadErrId = id("photo-error");
  const fileInput = h("input", { type: "file", id: fileId, accept: ACCEPT, class: "sr-only", "aria-describedby": uploadErrId });
  const uploadError = h("p", { class: "field__error", id: uploadErrId, role: "alert" });
  const uploadArea = h("div");
  const maxMb = Math.round(store.site.upload.maxBytes / 1048576);
  let uploading = false;

  function drawUpload(progress = null) {
    if (uploading) {
      const pct = progress ?? 0;
      uploadArea.replaceChildren(h("div", { class: "file-row upload-progress", role: "status" },
        h("span", { class: "status-line" }, spinner(), h("span", {}, progress === null ? "Uploading your photo" : `Uploading your photo, ${pct}%`)),
        h("span", { class: "upbar", "aria-hidden": "true" }, h("span", { style: { transform: `scaleX(${pct / 100})` } }))));
      return;
    }
    if (draft.photo) {
      uploadArea.replaceChildren(h("div", { class: "file-row" },
        h("div", {}, h("p", { class: "file-row__name" }, draft.photo.name), h("p", { class: "small muted" }, `${draft.photo.width} × ${draft.photo.height} px`)),
        h("div", { class: "btn-row" },
          h("button", { type: "button", class: "btn btn--secondary btn--sm", onclick: () => fileInput.click() }, "Replace"),
          h("button", { type: "button", class: "btn btn--quiet btn--danger", onclick: () => { draft.photo = null; draft.framings = {}; save(); drawUpload(); drawCrop(); refresh(); uploadArea.querySelector("label")?.focus(); } }, "Remove"),
        ),
      ));
      return;
    }
    const zone = h("div", { class: "dropzone", "aria-invalid": uploadError.textContent ? "true" : null },
      h("div", { class: "dropzone__idle stack" },
        h("p", { class: "dropzone__title" }, "Drop a photo here"),
        h("div", { class: "btn-row" },
          h("label", { class: "btn btn--secondary", for: fileId, tabindex: "0", role: "button",
            onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } } }, "Choose a photo"),
          h("span", { class: "small muted" }, `JPG, PNG or WebP, up to ${maxMb} MB`)),
      ),
      h("p", { class: "dropzone__title dropzone__drop", "aria-hidden": "true" }, "Release to upload your photo"),
    );
    // Count enter/leave so moving over the zone's own children doesn't flicker the state.
    let depth = 0;
    zone.addEventListener("dragenter", (e) => { e.preventDefault(); depth++; zone.dataset.over = "true"; });
    zone.addEventListener("dragover", (e) => { e.preventDefault(); });
    zone.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) zone.dataset.over = "false"; });
    zone.addEventListener("drop", (e) => { e.preventDefault(); depth = 0; zone.dataset.over = "false"; const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); });
    uploadArea.replaceChildren(zone);
  }

  async function handleFile(file) {
    uploadError.textContent = "";
    if (file.size > store.site.upload.maxBytes) { uploadError.textContent = tooLarge(maxMb); drawUpload(); return; }
    if (file.type && !ACCEPT.split(",").includes(file.type)) {
      uploadError.textContent = /hei[cf]/i.test(file.type + file.name) ? errorText.heic_not_supported : errorText.not_an_image;
      drawUpload(); return;
    }
    uploading = true; drawUpload(); refresh();
    try {
      const p = await uploadPhoto(file, (pct) => drawUpload(pct));
      draft.photo = { id: p.id, width: p.width, height: p.height, name: file.name };
      draft.framings = {};
      save();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "offline";
      uploadError.textContent = code === "too_large" ? tooLarge(maxMb) : code === "image_too_small" ? tooSmall(store.site.upload.minShortSide) : errorText[code] ?? errorText.server_error;
    } finally {
      uploading = false; fileInput.value = "";
      drawUpload(); drawCrop(); refresh();
    }
  }
  fileInput.addEventListener("change", () => { const f = fileInput.files?.[0]; if (f) handleFile(f); });

  const uploadSection = h("section", { class: "form-section", "aria-labelledby": "upload-title" },
    h("div", { class: "form-section__head" }, h("h2", { id: "upload-title" }, "Upload your photo")),
    h("ul", { class: "plain-list small" }, t.photoGuidance.map((g) => h("li", {}, g))),
    h("p", { class: "small muted" }, `At least ${store.site.upload.minShortSide} pixels on the shortest side.`),
    fileInput, uploadArea, uploadError,
    h("p", { class: "notice-text" }, "Only upload photos you have the right to use, and don't include people without their permission. See the ",
      policyLink("acceptableUse", "Acceptable Use Policy"), " and how we handle your photo in the ", policyLink("privacy", "Privacy Policy"), "."),
  );

  // ---- Template fields, built from its schema ----
  const fieldErrors = {};
  const fieldEls = {};
  const fields = t.inputs.map((i) => {
    const fid = id(`f-${i.id}`), errId = `${fid}-error`, helpId = `${fid}-help`;
    const err = h("p", { class: "field__error", id: errId });
    fieldErrors[i.id] = err;
    const label = h("span", {}, i.label, i.required ? null : h("span", { class: "opt" }, " (optional)"));
    if (i.type === "select") {
      const value = draft.inputs[i.id] ?? i.default ?? i.options[0].value;
      draft.inputs[i.id] = value;
      const group = h("fieldset", { class: "options", "aria-describedby": errId },
        h("legend", {}, label),
        i.options.map((o) => h("label", { class: "option" },
          h("input", { type: "radio", name: fid, value: o.value, checked: o.value === value, onchange: () => { draft.inputs[i.id] = o.value; save(); } }),
          h("span", {}, o.label))));
      fieldEls[i.id] = group.querySelector("input");
      return h("div", { class: "field" }, group, err);
    }
    const input = h("input", { class: "input", id: fid, type: "text", maxlength: String(i.maxLength), value: draft.inputs[i.id] ?? "",
      autocomplete: "off", "aria-describedby": `${i.help ? helpId : ""} ${errId}`.trim(), "aria-required": i.required ? "true" : null });
    const counter = h("span", { class: "counter", "aria-hidden": "true" });
    const count = () => { counter.textContent = `${input.value.length} / ${i.maxLength}`; counter.dataset.near = String(input.value.length > i.maxLength * 0.85); };
    input.addEventListener("input", () => { draft.inputs[i.id] = input.value; save(); count(); if (input.value.trim()) clearFieldError(i.id); });
    count();
    fieldEls[i.id] = input;
    return h("div", { class: "field" },
      h("label", { class: "field__label", for: fid }, label),
      i.help ? h("p", { class: "field__help", id: helpId }, i.help) : null,
      input, h("div", { class: "field__meta" }, err, counter));
  });
  function clearFieldError(k) { fieldErrors[k].textContent = ""; fieldEls[k]?.removeAttribute("aria-invalid"); }
  const detailsSection = h("section", { class: "form-section", "aria-labelledby": "details-title" },
    h("div", { class: "form-section__head" }, h("h2", { id: "details-title" }, "Tell us about your product")), fields);

  // ---- Output settings: only what this template and the model support ----
  const settingsError = h("p", { class: "field__error", id: id("settings-error") });
  function radios(name, legend, values, current, render, onPick) {
    if (values.length === 1) return h("div", { class: "field" }, h("p", { class: "field__label" }, legend), h("p", {}, render(values[0])));
    return h("fieldset", { class: "options" }, h("legend", {}, legend),
      values.map((v) => h("label", { class: "option" },
        h("input", { type: "radio", name, value: String(v), checked: String(v) === String(current), onchange: () => onPick(v) }),
        h("span", {}, render(v)))));
  }
  const settingsSection = h("section", { class: "form-section", "aria-labelledby": "settings-title" },
    h("div", { class: "form-section__head" }, h("h2", { id: "settings-title" }, "Video settings")),
    radios(id("ar"), "Format", t.output.aspectRatios, settings.aspectRatio,
      (r) => [h("span", { class: "ratio", dataset: { r }, "aria-hidden": "true" }), formatName[r]],
      (r) => { settings.aspectRatio = r; save(); drawCrop(); refresh(); }),
    radios(id("dur"), "Length", t.output.durations, settings.duration, (d) => `${d} seconds`, (d) => { settings.duration = Number(d); save(); refresh(); }),
    radios(id("res"), "Resolution", t.output.resolutions, settings.resolution, (r) => r, (r) => { settings.resolution = r; save(); refresh(); }),
    h("p", { class: "small muted" }, "Videos have no sound. Add music when you post them on TikTok or Instagram."),
    settingsError,
  );

  // ---- Review and generate ----
  const revPhoto = h("dd"), revFormat = h("dd"), revCost = h("dd");
  const creditNote = h("div");
  const status = h("p", { class: "form-status", role: "status", "aria-live": "polite" });
  const generate = h("button", { type: "button", class: "btn btn--primary btn--lg", "data-magnetic": "" }, "Generate video");
  const setGenerating = (on) => { setBusy(generate, on); if (!on) refresh(); };
  let submitting = false;
  const reviewSection = h("section", { class: "form-section review", "aria-labelledby": "review-title" },
    h("div", { class: "form-section__head" }, h("h2", { id: "review-title" }, "Check and generate")),
    h("dl", { class: "details" },
      h("dt", {}, "Template"), h("dd", {}, t.name),
      h("dt", {}, "Photo"), revPhoto,
      h("dt", {}, "Settings"), revFormat,
      h("dt", {}, "Cost"), revCost),
    creditNote,
    h("div", { class: "review__bar" }, generate, status),
  );

  function cost() { return t.cost[settings.duration]; }
  function refresh() {
    const c = cost();
    sumFormat.textContent = formatName[settings.aspectRatio];
    sumLength.textContent = `${settings.duration} seconds`;
    sumRes.textContent = settings.resolution;
    sumCost.textContent = credits(c);
    revPhoto.textContent = uploading ? "Uploading" : draft.photo ? `${draft.photo.name}, framed for ${formatName[settings.aspectRatio]}` : "Not added yet";
    revFormat.textContent = `${formatName[settings.aspectRatio]}, ${settings.duration} seconds, ${settings.resolution}`;
    const have = store.site.user?.credits ?? 0;
    revCost.textContent = `${credits(c)}. You have ${credits(have)}.`;
    creditNote.replaceChildren(have < c ? notice(errorText.no_credits,
      store.site.paymentsOn ? `This video needs ${credits(c)}. Buy credits from My videos.` : `This video needs ${credits(c)}. ${errorText.payments_not_configured}`) : "");
    if (!submitting) generate.disabled = uploading || have < c;
    if (have < c) generate.setAttribute("aria-describedby", "credit-note"); else generate.removeAttribute("aria-describedby");
    creditNote.id = "credit-note";
  }

  generate.addEventListener("click", async () => {
    if (submitting) return;
    status.textContent = "";
    // Check before sending, and say exactly what's missing beside each field.
    const problems = [];
    if (!draft.photo) { uploadError.textContent = "Upload a photo to continue."; problems.push(uploadArea.querySelector("label, button")); }
    for (const i of t.inputs) {
      clearFieldError(i.id);
      if (i.type === "text" && i.required && !String(draft.inputs[i.id] ?? "").trim()) {
        fieldErrors[i.id].textContent = `Write a few words for ${i.label.toLowerCase()}.`;
        fieldEls[i.id].setAttribute("aria-invalid", "true");
        problems.push(fieldEls[i.id]);
      }
    }
    if (problems.length) {
      status.textContent = problems.length === 1 ? "One thing needs attention before you generate." : `${problems.length} things need attention before you generate.`;
      problems[0]?.focus();
      return;
    }
    submitting = true;
    setGenerating(true);
    status.textContent = "Sending your request";
    try {
      const r = await api("POST", "/api/jobs", {
        templateId: t.id, clientKey: draft.clientKey, photoId: draft.photo.id,
        crop: crop.fractions(), inputs: draft.inputs, settings,
      });
      setUser({ ...store.site.user, credits: r.credits });
      draft.clientKey = newKey(); // the next request is a new video
      draft.fromJob = null;
      save();
      navigate(`/videos/${r.job.id}`);
      return;
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "offline";
      if (code === "invalid_request" && e.fields) {
        let first = null;
        for (const [k, msg] of Object.entries(e.fields)) {
          if (fieldErrors[k]) { fieldErrors[k].textContent = msg; fieldEls[k]?.setAttribute("aria-invalid", "true"); first ??= fieldEls[k]; }
          else if (k === "photo") { uploadError.textContent = msg; draft.photo = null; save(); drawUpload(); drawCrop(); }
          else if (k === "crop") { cropError.textContent = msg; first ??= photoPanel.querySelector(".crop__frame"); }
          else settingsError.textContent = msg;
        }
        status.textContent = "Some details need attention. Nothing was charged.";
        first?.focus();
      } else {
        status.textContent = (errorText[code] ?? errorText.server_error) + (code === "offline" ? " If it went through, it will be in My videos." : "");
      }
      if (code === "no_credits") api("GET", "/api/site").then((s) => setUser(s.user)).catch(() => {});
    } finally {
      submitting = false;
      setGenerating(false);
    }
  });

  drawUpload(); drawCrop(); refresh();

  const node = h("div", { class: "wrap page" },
    progress(1, { templateHref: `/templates/${t.slug}` }),
    h("div", { class: "page__head" },
      h("h1", { class: "h1" }, draft.fromJob ? "Create another version" : "Create a video"),
      notes,
    ),
    h("div", { class: "workspace" },
      h("aside", { class: "workspace__aside", "aria-label": "Your template and photo" }, summary, photoPanel),
      h("div", { class: "workspace__form" }, uploadSection, detailsSection, settingsSection, reviewSection),
    ),
  );
  return { title: draft.fromJob ? `Another version: ${t.name}` : `Create: ${t.name}`, node };
}
