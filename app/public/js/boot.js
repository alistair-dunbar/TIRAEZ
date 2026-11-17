// Runs before the first paint (a classic script in <head>; the CSP allows no inline script).
// Marks a fresh landing-page load so the header and hero can play their entrance once.
// Not on back/forward or reload, not with reduced motion, and if this file fails nothing is hidden.
(function () {
  try {
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    var fresh = !nav || nav.type === "navigate";
    var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (location.pathname === "/" && fresh && !calm) document.documentElement.classList.add("motion-enter");
  } catch (e) { /* no entrance, everything visible */ }
})();
