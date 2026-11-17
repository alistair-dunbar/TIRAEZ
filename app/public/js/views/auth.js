// Sign in and create an account. Errors appear under their field and are announced.
// Sign-up asks for name, email, password and age, with two separate unticked boxes (the terms, and
// being 18 or over). The privacy notice is shown as information, not bundled into either box.
import { api, ApiError } from "../api.js";
import { h } from "../dom.js";
import { errorText } from "../copy.js";
import { navigate, setUser } from "../main.js";
import { store } from "../state.js";
import { notice, setBusy } from "./parts.js";
import { ageValue, checkEligibilityFields, clearErrors, eligibilityBody, eligibilityFields, field, privacyNotice, showFieldErrors } from "./forms.js";

export function authView(ctx, mode) {
  const next = safeNext(ctx.query.get("next"));
  const signup = mode === "signup";
  const brand = store.site.brandName;
  const panel = h("div", { class: "auth__panel" });

  const switchTo = signup
    ? h("p", {}, "Already have an account? ", h("a", { class: "link", href: `/signin${next !== "/templates" ? `?next=${encodeURIComponent(next)}` : ""}` }, "Sign in"))
    : h("p", {}, "New here? ", h("a", { class: "link", href: `/signup${next !== "/templates" ? `?next=${encodeURIComponent(next)}` : ""}` }, "Create an account"));

  if (signup && !store.site.signupsOpen) {
    panel.append(notice(errorText.signups_closed, "You can browse the templates in the meantime.",
      { actions: [h("a", { class: "btn btn--secondary", href: "/templates" }, "Explore templates")] }), h("div", { class: "page__foot" }, switchTo));
    return page(signup, panel);
  }

  const elig = signup ? eligibilityFields(brand, { name: true, age: true, terms: true }) : {};
  const email = field("Email", { name: "email", type: "email", autocomplete: "email", required: true, dir: "ltr" });
  const password = field("Password", { name: "password", type: "password", autocomplete: signup ? "new-password" : "current-password",
    required: true, minlength: 8, dir: "ltr", help: signup ? "At least 8 characters." : "" });
  const all = { ...elig, email, password };
  const status = h("p", { class: "form-status", role: "status" });
  const submit = h("button", { class: "btn btn--primary btn--lg btn--block", type: "submit" }, signup ? "Create account" : "Sign in");

  /** Under 18: the form goes away and nothing else is suggested. */
  function ineligible() {
    panel.replaceChildren(h("div", { class: "stack", role: "alert" },
      h("h2", { class: "title" }, errorText.age_ineligible)));
    panel.querySelector("h2").setAttribute("tabindex", "-1");
    panel.querySelector("h2").focus();
  }

  const form = h("form", { class: "form-narrow", novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    clearErrors(all); status.textContent = "";
    // A valid age under 18 ends here, the same way the server ends it.
    if (signup && ageValue(elig.age.input.value) !== null && ageValue(elig.age.input.value) < 18) { ineligible(); return; }
    const problems = signup ? checkEligibilityFields(elig) : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.input.value.trim())) { email.setError(errorText.invalid_email); problems.push(email.input); }
    if (password.input.value.length < 8) { password.setError(signup ? errorText.weak_password : "Write your password."); problems.push(password.input); }
    if (problems.length) {
      status.textContent = problems.length === 1 ? "One field needs attention." : `${problems.length} fields need attention.`;
      problems.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0].focus();
      return;
    }
    setBusy(submit, true);
    status.textContent = signup ? "Creating your account" : "Signing in";
    try {
      const body = { email: email.input.value.trim(), password: password.input.value,
        ...(signup ? { ...eligibilityBody(elig), termsVersion: store.site.legal.termsVersion, privacyVersion: store.site.legal.privacyVersion } : {}) };
      const u = await api("POST", signup ? "/api/signup" : "/api/login", body);
      setUser(u);
      const needs = u.needs && (u.needs.name || u.needs.age || u.needs.terms);
      navigate(needs ? `/welcome?next=${encodeURIComponent(next)}` : next, { replace: true });
    } catch (err) {
      setBusy(submit, false);
      const code = err instanceof ApiError ? err.code : "offline";
      status.textContent = "";
      if (code === "age_ineligible") { ineligible(); return; }
      if (code === "invalid_request" && showFieldErrors(err.fields, all)) { status.textContent = "Some fields need attention."; return; }
      if (code === "invalid_email" || code === "email_taken") { email.setError(errorText[code]); email.input.focus(); }
      else if (code === "weak_password") { password.setError(errorText[code]); password.input.focus(); }
      else if (code === "terms_changed") { status.textContent = errorText.terms_changed; setTimeout(() => location.reload(), 2500); }
      else status.textContent = errorText[code] ?? errorText.server_error;
    }
  } },
    elig.name?.el, email.el, password.el, elig.age?.el,
    signup ? h("div", { class: "consent" }, elig.agreeTerms.el, elig.confirmAdult.el, privacyNotice()) : null,
    h("div", { class: "field" }, submit, status),
  );

  panel.append(form, h("div", { class: "page__foot" }, switchTo));
  return page(signup, panel);
}

function page(signup, panel) {
  return {
    title: signup ? "Create an account" : "Sign in",
    node: h("div", { class: "wrap page" },
      h("div", { class: "auth" },
        h("div", { class: "page__head" },
          h("h1", { class: "h1" }, signup ? "Create an account" : "Sign in"),
          h("p", { class: "lead" }, signup
            ? "An account keeps your videos together so you can watch and download them again."
            : "Sign in to create videos and see the ones you've made."),
        ),
        panel,
      ),
    ),
  };
}

export function safeNext(v) {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/templates";
}
