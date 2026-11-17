// Motion that needs JavaScript: scroll reveals, the grid stagger, the desktop cursor dot, magnetic
// primary actions and (dormant) parallax. Everything here is decoration: content is visible without
// it, reduced motion switches it off (also when the setting changes mid-visit), and each page's
// observers and listeners are removed when the page changes.
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const root = document.documentElement;
const IO_OPTIONS = { threshold: 0.12, rootMargin: "0px 0px -32px 0px" };
const STAGGER_STEP = 60, STAGGER_CAP = 240, STAGGER_MS = 500;

const active = () => !reduce.matches && "IntersectionObserver" in window;

// ---------------------------------------------------------------------------------------------
// First-load entrance: boot.js adds .motion-enter; it comes off once the hero has played, so a
// re-render or a later visit to the landing page never replays it.

export function endEntrance(delay = 0) {
  if (!root.classList.contains("motion-enter")) return;
  if (!delay) { root.classList.remove("motion-enter"); return; }
  setTimeout(() => root.classList.remove("motion-enter"), delay);
}

// ---------------------------------------------------------------------------------------------
// Reveals and stagger, per page. Returns a function that disconnects everything.

export function scan(container) {
  const reveals = [...container.querySelectorAll("[data-reveal], [data-stagger]")];
  if (!reveals.length) return () => {};
  if (!active()) { for (const el of reveals) el.classList.add("is-revealed"); return () => {}; }
  root.classList.add("motion-ready");
  const timers = new Set();
  const reveal = (el) => {
    if (el.classList.contains("is-revealed")) return;
    io.unobserve(el);
    if (el.hasAttribute("data-stagger")) {
      [...el.children].forEach((c, i) => c.style.setProperty("--stagger-delay", `${Math.min(i * STAGGER_STEP, STAGGER_CAP)}ms`));
      el.classList.add("is-staggering");
      // Once it has played, the children's own hover transitions run without the delay.
      const t = setTimeout(() => { el.classList.remove("is-staggering"); timers.delete(t); }, STAGGER_MS + STAGGER_CAP + 50);
      timers.add(t);
    }
    el.classList.add("is-revealed");
  };
  const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) reveal(e.target); }, IO_OPTIONS);
  for (const el of reveals) io.observe(el);
  // Keyboard users tabbing ahead of the scroll see what they focus straight away.
  const onFocus = (e) => { const el = e.target.closest?.("[data-reveal], [data-stagger]"); if (el && container.contains(el)) reveal(el); };
  container.addEventListener("focusin", onFocus);
  return () => {
    io.disconnect();
    container.removeEventListener("focusin", onFocus);
    for (const t of timers) clearTimeout(t);
  };
}

// ---------------------------------------------------------------------------------------------
// Magnetic primary actions: up to 3px towards the pointer. Only on buttons marked data-magnetic,
// which is never used on consent, payment, cancellation or deletion controls.

const MAGNET = 3;
function onMagnetMove(e) {
  const btn = e.target.closest?.("[data-magnetic]");
  if (!btn || btn.disabled || btn.dataset.busy !== undefined) return;
  const r = btn.getBoundingClientRect();
  const dx = ((e.clientX - r.left) / r.width - 0.5) * 2;
  const dy = ((e.clientY - r.top) / r.height - 0.5) * 2;
  btn.style.setProperty("--mx", `${(Math.max(-1, Math.min(1, dx)) * MAGNET).toFixed(2)}px`);
  btn.style.setProperty("--my", `${(Math.max(-1, Math.min(1, dy)) * MAGNET).toFixed(2)}px`);
}
function onMagnetLeave(e) {
  const btn = e.target.closest?.("[data-magnetic]");
  if (btn && !btn.contains(e.relatedTarget)) { btn.style.removeProperty("--mx"); btn.style.removeProperty("--my"); }
}

// ---------------------------------------------------------------------------------------------
// Desktop cursor dot: 10px, following with light smoothing. It grows to 64px with a label only over
// media that will really play. Hidden over form fields, selected text, policy text, dialogs and
// consent or deletion controls. The loop stops whenever the dot has caught up.

const HIDE_OVER = "input, textarea, select, [contenteditable], .prose, .consent, .danger-zone, dialog, [role=dialog], [role=alertdialog], .check, .legal__nav";
let dot = null, label = null, raf = 0, x = 0, y = 0, tx = 0, ty = 0, shown = false, last = 0;
const SMOOTH_MS = 70;

function playLabel(target) {
  const el = target.closest?.("[data-cursor]");
  if (!el) return null;
  if (el.dataset.cursor === "play") {
    const v = el.matches("video") ? el : el.querySelector("video");
    return v && v.paused && v.readyState >= 1 && !v.error ? "Play" : null;
  }
  return el.dataset.cursor === "preview" ? "Preview" : null;
}

function step(now) {
  // Eases towards the pointer with a 70ms time constant, whatever the frame rate.
  const k = 1 - Math.exp(-Math.min(64, now - (last || now - 16)) / SMOOTH_MS);
  last = now;
  x += (tx - x) * k; y += (ty - y) * k;
  dot.style.setProperty("transform", `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`);
  if (Math.abs(tx - x) + Math.abs(ty - y) > 0.2) raf = requestAnimationFrame(step);
  else { raf = 0; last = 0; }
}

function onCursorMove(e) {
  if (e.pointerType && e.pointerType !== "mouse") return;
  tx = e.clientX; ty = e.clientY;
  const over = e.target;
  const selecting = String(getSelection?.() ?? "").length > 0;
  const hide = selecting || Boolean(over.closest?.(HIDE_OVER));
  const text = hide ? null : playLabel(over);
  dot.classList.toggle("is-hidden", hide);
  dot.classList.toggle("is-media", Boolean(text));
  if (label.textContent !== (text ?? "")) label.textContent = text ?? "";
  if (!shown) { x = tx; y = ty; shown = true; dot.classList.add("is-on"); }
  if (!raf) raf = requestAnimationFrame(step);
}
function onCursorOut(e) { if (!e.relatedTarget) { dot.classList.remove("is-on"); shown = false; } }

function cursorOn() {
  if (dot) return;
  dot = document.createElement("div");
  dot.className = "cursor-dot";
  dot.setAttribute("aria-hidden", "true");
  label = document.createElement("span");
  dot.append(label);
  document.body.append(dot);
  document.addEventListener("pointermove", onCursorMove, { passive: true });
  document.addEventListener("pointerout", onCursorOut, { passive: true });
}
function cursorOff() {
  if (!dot) return;
  document.removeEventListener("pointermove", onCursorMove);
  document.removeEventListener("pointerout", onCursorOut);
  cancelAnimationFrame(raf); raf = 0; shown = false;
  dot.remove(); dot = null;
}

// ---------------------------------------------------------------------------------------------
// Parallax: at most 10px, only on approved hero media marked data-parallax. No media is approved,
// so nothing uses it today.

let parallaxEls = [];
function onScroll() {
  for (const el of parallaxEls) {
    const r = el.getBoundingClientRect();
    const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight));
    el.style.setProperty("transform", `translate3d(0, ${(p * -10).toFixed(1)}px, 0)`);
  }
}
export function parallax(container) {
  parallaxEls = active() ? [...container.querySelectorAll("[data-parallax]")] : [];
  if (!parallaxEls.length) return () => {};
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  return () => { removeEventListener("scroll", onScroll); parallaxEls = []; };
}

// ---------------------------------------------------------------------------------------------

function apply() {
  const on = !reduce.matches;
  root.classList.toggle("motion-ok", on);
  if (!on) {
    root.classList.remove("motion-enter", "motion-ready");
    for (const el of document.querySelectorAll("[data-reveal], [data-stagger]")) el.classList.add("is-revealed");
    for (const el of document.querySelectorAll("[data-parallax]")) el.style.removeProperty("transform");
  }
  if (on && fine.matches) cursorOn(); else cursorOff();
  if (on && fine.matches) {
    document.addEventListener("pointermove", onMagnetMove, { passive: true });
    document.addEventListener("pointerout", onMagnetLeave, { passive: true });
  } else {
    document.removeEventListener("pointermove", onMagnetMove);
    document.removeEventListener("pointerout", onMagnetLeave);
  }
}

export function startMotion() {
  apply();
  reduce.addEventListener("change", apply);
  fine.addEventListener("change", apply);
}
