// Router and page chrome (header, mobile menu, footer).
import { api } from "./api.js";
import { $, append, h } from "./dom.js";
import { credits } from "./copy.js";
import { loadSite, store } from "./state.js";
import { authView } from "./views/auth.js";
import { catalogueView } from "./views/catalogue.js";
import { createView } from "./views/create.js";
import { jobView } from "./views/job.js";
import { landingView } from "./views/landing.js";
import { templateView } from "./views/template.js";
import { videosView } from "./views/videos.js";

const routes = [
  [/^\/$/, landingView],
  [/^\/templates$/, catalogueView],
  [/^\/templates\/([a-z0-9-]+)$/, templateView],
  [/^\/create\/([a-z0-9-]+)$/, createView, { auth: true }],
  [/^\/videos$/, videosView, { auth: true }],
  [/^\/videos\/(\d+)$/, jobView, { auth: true }],
  [/^\/signin$/, (ctx) => authView(ctx, "signin")],
  [/^\/signup$/, (ctx) => authView(ctx, "signup")],
];

let cleanup = null;
let first = true;
const main = $("#main");

export function navigate(url, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", url); else history.pushState(null, "", url);
  return render();
}

export function announce(text) {
  const el = $("[data-announcer]");
  el.textContent = "";
  setTimeout(() => (el.textContent = text), 50);
}

async function render() {
  cleanup?.();
  cleanup = null;
  closeMenu();
  const url = new URL(location.href);
  let match = null, view = notFoundView, opts = {};
  for (const [re, v, o] of routes) {
    const m = re.exec(url.pathname);
    if (m) { match = m; view = v; opts = o ?? {}; break; }
  }
  if (opts.auth && !store.site?.user) {
    return navigate(`/signin?next=${encodeURIComponent(url.pathname + url.search)}`, { replace: true });
  }
  const ctx = { params: match ? match.slice(1) : [], query: url.searchParams, url, onCleanup: (fn) => { cleanup = fn; } };
  let result;
  try {
    result = await view(ctx);
  } catch (e) {
    console.error(e);
    result = errorView();
  }
  if (!result) return; // the view navigated elsewhere
  main.replaceChildren(result.node);
  document.title = result.title ? `${result.title} · ${store.site.brandName}` : `${store.site.brandName}: video templates for small businesses`;
  renderChrome(url.pathname);
  if (!first) {
    const h1 = main.querySelector("h1");
    if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
    if (!url.hash) window.scrollTo(0, 0);
    announce(result.title ?? store.site.brandName);
  }
  if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView();
  first = false;
}

// ---------------------------------------------------------------------------------------------
// Chrome

function navItems(path) {
  const u = store.site?.user;
  const items = [
    ["/templates", "Templates"],
    ["/#how-it-works", "How it works"],
  ];
  if (u) items.push(["/videos", "My videos"]);
  return items.map(([href, label]) => ({ href, label, current: href === path || (href === "/videos" && path.startsWith("/videos")) || (href === "/templates" && path.startsWith("/templates")) }));
}

async function signOut() {
  await api("POST", "/api/logout").catch(() => {});
  store.site.user = null;
  navigate("/");
}

function renderChrome(path) {
  const u = store.site?.user;
  const nav = $("[data-nav]");
  nav.replaceChildren(...[
    ...navItems(path).map((i) => h("a", { href: i.href, "aria-current": i.current ? "page" : null }, i.label)),
    u ? h("span", { class: "nav__credits" }, credits(u.credits)) : null,
    u ? h("button", { type: "button", class: "btn btn--quiet", onclick: signOut }, "Sign out") : h("a", { href: `/signin` }, "Sign in"),
    h("a", { class: "btn btn--primary", href: "/templates" }, "Create a video"),
  ].filter(Boolean));
  const mobile = $("[data-mobile-nav]");
  mobile.replaceChildren(h("ul", {},
    navItems(path).map((i) => h("li", {}, h("a", { href: i.href, "aria-current": i.current ? "page" : null }, i.label))),
    u ? h("li", { class: "mobile-nav__credits" }, `${u.email} · ${credits(u.credits)}`) : null,
    h("li", {}, u ? h("button", { type: "button", onclick: signOut }, "Sign out") : h("a", { href: "/signin" }, "Sign in")),
    h("li", {}, h("a", { class: "btn btn--primary", href: "/templates" }, "Create a video")),
  ));
  const foot = $("[data-footer-nav]");
  foot.replaceChildren(...[...navItems(path), u ? null : { href: "/signin", label: "Sign in" }, { href: "/templates", label: "Create a video" }]
    .filter(Boolean).map((i) => h("li", {}, h("a", { href: i.href }, i.label))));
  $("[data-legal]").textContent = `© ${new Date().getFullYear()} ${store.site.brandName}`;
  for (const el of document.querySelectorAll("[data-brand]")) el.textContent = store.site.brandName;
}

/** Called after anything that changes the balance or sign-in state. */
export function setUser(user) {
  store.site.user = user;
  renderChrome(location.pathname);
}

const toggle = $("[data-menu-toggle]");
const panel = $("#mobile-nav");
function closeMenu() {
  if (panel.hidden) return;
  panel.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  toggle.querySelector("[data-icon-open]").hidden = false;
  toggle.querySelector("[data-icon-close]").hidden = true;
}
toggle.addEventListener("click", () => {
  const open = panel.hidden;
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.querySelector("[data-icon-open]").hidden = open;
  toggle.querySelector("[data-icon-close]").hidden = !open;
  if (open) panel.querySelector("a, button")?.focus();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.hidden) { closeMenu(); toggle.focus(); }
});

// Same-origin links go through the router.
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("a[href]");
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (a.target || a.hasAttribute("download") || a.dataset.external !== undefined) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.preventDefault();
  if (url.pathname === location.pathname && url.search === location.search && url.hash) {
    history.pushState(null, "", url.href);
    document.getElementById(url.hash.slice(1))?.scrollIntoView();
    closeMenu();
    return;
  }
  navigate(url.pathname + url.search + url.hash);
});
window.addEventListener("popstate", () => render());

// ---------------------------------------------------------------------------------------------

function notFoundView() {
  return {
    title: "Page not found",
    node: h("div", { class: "wrap page" },
      h("div", { class: "page__head" },
        h("h1", { class: "h1" }, "We can't find that page"),
        h("p", { class: "lead" }, "The link may be out of date. The templates are a good place to start."),
      ),
      h("a", { class: "btn btn--primary", href: "/templates" }, "Explore templates"),
    ),
  };
}

function errorView() {
  return {
    title: "Something went wrong",
    node: h("div", { class: "wrap page" },
      h("div", { class: "page__head" },
        h("h1", { class: "h1" }, "This page didn't load"),
        h("p", { class: "lead" }, "We couldn't reach the server. Check your connection, then try again."),
      ),
      h("button", { type: "button", class: "btn btn--primary", onclick: () => render() }, "Try again"),
    ),
  };
}

(async function start() {
  try {
    await loadSite();
  } catch {
    store.site = { brandName: document.querySelector("[data-brand]").textContent, user: null, pricing: null };
    main.replaceChildren(errorView().node);
    return;
  }
  render();
})();

export { append };
