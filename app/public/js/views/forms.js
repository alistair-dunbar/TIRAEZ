// Form pieces shared by sign-up, onboarding, account and report pages: labelled fields with help
// and an error line, real checkboxes (never pre-ticked), and server field errors placed under fields.
import { h, id } from "../dom.js";
import { policyLinks } from "../copy.js";

/** A labelled input (or textarea). Returns { el, input, setError }. */
export function field(label, { name, type = "text", help = "", optional = false, textarea = false, ...attrs } = {}) {
  const inputId = id(name), errId = id(`${name}-error`), helpId = help ? id(`${name}-help`) : null;
  const input = h(textarea ? "textarea" : "input", {
    class: "input", id: inputId, name, ...(textarea ? {} : { type }), "aria-describedby": [helpId, errId].filter(Boolean).join(" "), ...attrs,
  });
  const error = h("p", { class: "field__error", id: errId });
  const el = h("div", { class: "field" },
    h("label", { class: "field__label", for: inputId }, label, optional ? h("span", { class: "opt" }, " (optional)") : null),
    help ? h("p", { class: "field__help", id: helpId }, help) : null,
    input, error);
  return { el, input, setError: (text) => setError(input, error, text) };
}

/** An unticked checkbox with its sentence as the label. Returns { el, input, setError }. */
export function checkbox(name, ...label) {
  const inputId = id(name), errId = id(`${name}-error`);
  const input = h("input", { type: "checkbox", id: inputId, name, "aria-describedby": errId });
  const error = h("p", { class: "field__error", id: errId });
  const el = h("div", { class: "field" },
    h("label", { class: "check", for: inputId }, input, h("span", { class: "check__text" }, ...label)),
    error);
  return { el, input, setError: (text) => setError(input, error, text) };
}

export function setError(input, el, text) {
  el.textContent = text ?? "";
  if (text) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
}

/** Opens a policy in a new tab, so a half-filled form isn't lost. */
export function policyLink(key, text) {
  return h("a", { class: "link", href: policyLinks[key], target: "_blank", rel: "noopener" }, text, h("span", { class: "sr-only" }, " (opens in a new tab)"));
}

/**
 * Places the server's per-field messages under the matching fields and focuses the first.
 * Returns true when at least one field was marked.
 */
export function showFieldErrors(fields, map) {
  let first = null;
  for (const [key, msg] of Object.entries(fields ?? {})) {
    const f = map[key];
    if (!f) continue;
    f.setError(msg);
    first ??= f.input;
  }
  first?.focus();
  return Boolean(first);
}

export function clearErrors(map) {
  for (const f of Object.values(map)) f?.setError(null);
}

/** Whole years, digits only. Mirrors the server's rule; the server decides. */
export function ageValue(text) {
  const t = String(text ?? "").trim();
  return /^\d{1,3}$/.test(t) && Number(t) <= 120 ? Number(t) : null;
}

/** The fields sign-up and onboarding share. `need` says which to include. */
export function eligibilityFields(brand, need) {
  const f = {};
  if (need.name) f.name = field("Name", { name: "name", autocomplete: "name", maxlength: 100, dir: "auto", help: "The name you'd like us to use, in any language." });
  if (need.age) f.age = field("Age", { name: "age", inputmode: "numeric", autocomplete: "off", maxlength: 3, class: "input input--short", help: `In whole years. ${brand} is for people aged 18 and over.` });
  if (need.terms) f.agreeTerms = checkbox("agreeTerms", "I agree to the ", policyLink("terms", "Terms of Service"), ", including the ", policyLink("acceptableUse", "Acceptable Use and AI Content Policy"), ".");
  if (need.age) f.confirmAdult = checkbox("confirmAdult", "I confirm that I am at least 18 years old.");
  return f;
}

/** Client-side checks for the eligibility fields; the server repeats every one of them. */
export function checkEligibilityFields(f) {
  const problems = [];
  if (f.name && !f.name.input.value.trim()) { f.name.setError("Write your name, as you'd like us to use it."); problems.push(f.name.input); }
  if (f.age && ageValue(f.age.input.value) === null) { f.age.setError("Write your age in years, as a whole number."); problems.push(f.age.input); }
  if (f.agreeTerms && !f.agreeTerms.input.checked) { f.agreeTerms.setError("To create an account, you need to agree to the Terms of Service."); problems.push(f.agreeTerms.input); }
  if (f.confirmAdult && !f.confirmAdult.input.checked) { f.confirmAdult.setError("Confirm that you are at least 18 years old."); problems.push(f.confirmAdult.input); }
  return problems;
}

export function eligibilityBody(f) {
  return {
    ...(f.name ? { name: f.name.input.value } : {}),
    ...(f.age ? { age: f.age.input.value.trim(), confirmAdult: f.confirmAdult.input.checked } : {}),
    ...(f.agreeTerms ? { agreeTerms: f.agreeTerms.input.checked } : {}),
  };
}

/** The privacy notice: information, not a box to tick. */
export function privacyNotice() {
  return h("p", { class: "notice-text" }, "We use your name, email and age confirmation to run your account, confirm your email and keep the service secure. Our ",
    policyLink("privacy", "Privacy Policy"), " explains how, who we share data with and your rights.");
}
