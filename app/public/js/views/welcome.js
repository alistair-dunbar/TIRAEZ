// Finishing an account: for accounts made before we asked for name and age, and whenever the Terms of
// Service change. Only the missing items are asked for.
import { api, ApiError } from "../api.js";
import { h } from "../dom.js";
import { errorText } from "../copy.js";
import { navigate, setUser } from "../main.js";
import { store } from "../state.js";
import { notice, setBusy } from "./parts.js";
import { safeNext } from "./auth.js";
import { ageValue, checkEligibilityFields, clearErrors, eligibilityBody, eligibilityFields, privacyNotice, showFieldErrors } from "./forms.js";

export function welcomeView(ctx) {
  const u = store.site.user;
  const next = safeNext(ctx.query.get("next"));
  const need = u.needs ?? { name: false, age: false, terms: false };
  if (!need.name && !need.age && !need.terms) return navigate(next, { replace: true }).then(() => null);

  const onlyTerms = need.terms && !need.name && !need.age;
  const title = onlyTerms ? "We've updated our Terms of Service" : "Finish setting up your account";
  const lead = onlyTerms
    ? "Read the new version, then agree to it to keep creating videos. Your videos and credits are unchanged."
    : "We now ask everyone for a few details before they upload photos or create videos. You can still watch and download your videos without them.";
  const panel = h("div", { class: "auth__panel" });

  if (need.terms && !store.site.signupsOpen) {
    panel.append(notice(errorText.terms_unavailable, "You can still watch and download your videos.",
      { actions: [h("a", { class: "btn btn--secondary", href: "/videos" }, "My videos")] }));
    return page(title, lead, panel);
  }

  const f = eligibilityFields(store.site.brandName, need);
  const status = h("p", { class: "form-status", role: "status" });
  const submit = h("button", { class: "btn btn--primary btn--lg btn--block", type: "submit" }, onlyTerms ? "Agree and continue" : "Continue");

  function closed() {
    setUser(null);
    panel.replaceChildren(h("div", { class: "stack", role: "alert" },
      h("h2", { class: "title", tabindex: "-1" }, errorText.age_ineligible),
      h("p", {}, "Your account has been closed, and its photos and videos have been deleted.")));
    panel.querySelector("h2").focus();
  }

  const form = h("form", { class: "form-narrow", novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    clearErrors(f); status.textContent = "";
    const age = f.age ? ageValue(f.age.input.value) : null;
    const problems = age !== null && age < 18 ? [] : checkEligibilityFields(f);
    if (problems.length) { status.textContent = problems.length === 1 ? "One field needs attention." : `${problems.length} fields need attention.`; problems[0].focus(); return; }
    setBusy(submit, true);
    try {
      const user = await api("POST", "/api/onboarding", { ...eligibilityBody(f), termsVersion: store.site.legal.termsVersion, privacyVersion: store.site.legal.privacyVersion });
      setUser(user);
      navigate(user.needs?.email ? `/verify-email?next=${encodeURIComponent(next)}` : next, { replace: true });
    } catch (err) {
      setBusy(submit, false);
      const code = err instanceof ApiError ? err.code : "offline";
      if (code === "age_ineligible") { closed(); return; }
      if (code === "invalid_request" && showFieldErrors(err.fields, f)) { status.textContent = "Some fields need attention."; return; }
      if (code === "terms_changed") { status.textContent = errorText.terms_changed; setTimeout(() => location.reload(), 2500); return; }
      status.textContent = errorText[code] ?? errorText.server_error;
    }
  } },
    f.name?.el, f.age?.el,
    h("div", { class: "consent" }, f.agreeTerms?.el, f.confirmAdult?.el, need.terms ? privacyNotice() : null),
    h("div", { class: "field" }, submit, status),
  );
  panel.append(form);
  return page(title, lead, panel);
}

function page(title, lead, panel) {
  return {
    title,
    node: h("div", { class: "wrap page" },
      h("div", { class: "auth" },
        h("div", { class: "page__head" }, h("h1", { class: "h1" }, title), h("p", { class: "lead" }, lead)),
        panel)),
  };
}
