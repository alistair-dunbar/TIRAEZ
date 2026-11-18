// Framing control: the customer chooses which part of their photo becomes the video.
// Drag with a pointer, or use the arrow keys, the zoom slider and the "Centre" button (no drag needed).
import { h, id } from "./dom.js";

const RATIOS = { "9:16": 9 / 16, "1:1": 1, "16:9": 16 / 9 };
const MIN_PX = 300; // the video model's smallest accepted side

export function baseFrame(photo, aspect) {
  const R = photo.width / photo.height, r = RATIOS[aspect];
  return r / R <= 1 ? { fw: r / R, fh: 1 } : { fw: 1, fh: R / r };
}

export function maxZoom(photo, aspect) {
  const b = baseFrame(photo, aspect);
  return Math.max(1, Math.min(3, (b.fw * photo.width) / MIN_PX, (b.fh * photo.height) / MIN_PX));
}

/** Fractions {x,y,w,h} of the photo for a framing {cx, cy, zoom}. */
export function frameFractions(photo, aspect, f) {
  const b = baseFrame(photo, aspect);
  const z = Math.min(Math.max(1, f.zoom), maxZoom(photo, aspect));
  const w = b.fw / z, hh = b.fh / z;
  const x = Math.min(Math.max(0, f.cx - w / 2), 1 - w);
  const y = Math.min(Math.max(0, f.cy - hh / 2), 1 - hh);
  return { x, y, w, h: hh };
}

/** A framing {cx, cy, zoom} from a stored pixel crop (used for "Create another version"). */
export function framingFromPixels(photo, aspect, crop) {
  const b = baseFrame(photo, aspect);
  return { cx: (crop.x + crop.w / 2) / photo.width, cy: (crop.y + crop.h / 2) / photo.height, zoom: Math.max(1, (b.fw * photo.width) / crop.w) };
}

export function cropper({ photo, src, aspect, framing, onChange }) {
  let f = { cx: 0.5, cy: 0.5, zoom: 1, ...(framing ?? {}) };
  const zoomId = id("zoom"), helpId = id("crop-help");
  const img = h("img", { class: "crop__img", src, alt: "Your photo", draggable: "false", decoding: "async" });
  const frame = h("div", { class: "crop__frame", tabindex: "0", role: "group",
    "aria-label": "Video framing. Use the arrow keys to move it.", "aria-describedby": helpId },
    ["tl", "tr", "bl", "br"].map((c) => h("span", { class: `crop__corner crop__corner--${c}`, "aria-hidden": "true" })));
  const stage = h("div", { class: "crop__stage" }, img, frame);
  stage.style.setProperty("aspect-ratio", `${photo.width} / ${photo.height}`);
  stage.style.setProperty("width", `min(100%, calc(70vh * ${photo.width / photo.height}))`);
  const zoom = h("input", { type: "range", id: zoomId, min: "1", max: String(maxZoom(photo, aspect)), step: "0.05", value: String(f.zoom) });

  function draw() {
    const c = frameFractions(photo, aspect, f);
    f.cx = c.x + c.w / 2; f.cy = c.y + c.h / 2;
    frame.style.setProperty("left", `${c.x * 100}%`);
    frame.style.setProperty("top", `${c.y * 100}%`);
    frame.style.setProperty("width", `${c.w * 100}%`);
    frame.style.setProperty("height", `${c.h * 100}%`);
    onChange?.({ ...f });
  }

  let drag = null;
  frame.addEventListener("pointerdown", (e) => {
    frame.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, cx: f.cx, cy: f.cy };
    frame.dataset.dragging = "";
  });
  frame.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = stage.getBoundingClientRect();
    f.cx = drag.cx + (e.clientX - drag.x) / r.width;
    f.cy = drag.cy + (e.clientY - drag.y) / r.height;
    draw();
  });
  const end = () => { drag = null; delete frame.dataset.dragging; };
  frame.addEventListener("pointerup", end);
  frame.addEventListener("pointercancel", end);
  frame.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    f.cx += d[0]; f.cy += d[1];
    draw();
  });
  zoom.addEventListener("input", () => { f.zoom = Number(zoom.value); draw(); });
  const centre = h("button", { type: "button", class: "btn btn--quiet", onclick: () => { f = { cx: 0.5, cy: 0.5, zoom: 1 }; zoom.value = "1"; draw(); } }, "Centre");

  const node = h("div", { class: "crop" },
    stage,
    h("p", { class: "small muted", id: helpId }, "The bright area is what goes into the video. Drag it, or select it and use the arrow keys."),
    h("div", { class: "crop__controls" },
      h("label", { for: zoomId }, "Zoom", zoom),
      centre,
    ),
  );
  // The photo eases in once it has actually loaded (instantly if it was cached).
  const shown = () => { img.classList.add("is-loaded"); draw(); };
  if (img.complete && img.naturalWidth) queueMicrotask(shown); else img.addEventListener("load", shown, { once: true });
  queueMicrotask(draw);
  return { node, fractions: () => frameFractions(photo, aspect, f), framing: () => ({ ...f }) };
}
