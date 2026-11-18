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
  if (u.ageRestricted) return restrictedPage();
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

  function closed(user) {
    if (user) setUser(user);
    navigate("/welcome", { replace: true });
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
      if (code === "age_restricted" || code === "age_ineligible") { closed(err.data?.user); return; }
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

/** An existing account that declared an age under 18: what has stopped, what happens next, and the
 *  reviewed route for a genuine mistake. Re-entering an age here is deliberately not possible. */
function restrictedPage() {
  const days = store.site.ageRestrictedDays ?? 30;
  return {
    title: "Account restricted",
    node: h("div", { class: "wrap page" },
      h("div", { class: "auth" },
        h("div", { class: "page__head" },
          h("h1", { class: "h1", role: "alert" }, "Tiraez is available to people aged 18 and over."),
          h("p", { class: "lead" }, "Uploads, video creation and buying credits are switched off for this account.")),
        h("div", { class: "auth__panel" },
          h("div", { class: "stack flow" },
            h("ul", { class: "plain-list" },
              h("li", {}, "Videos already with the video model will finish and stay in My videos. Videos that hadn't started were cancelled and their credits returned."),
              h("li", {}, "If you bought credits, we've opened a refund request for them."),
              h("li", {}, `Unless this is corrected, the account and its data will be deleted after ${days} days. You can download your data or delete the account sooner from your account page.`)),
            h("div", { class: "btn-row" },
              h("a", { class: "btn btn--secondary", href: "/account" }, "Your account"),
              h("a", { class: "link", href: "/report?kind=age_correction" }, "I entered my age by mistake")),
            h("p", { class: "notice-text" }, "A mistake is reviewed by a person before anything changes. We won't ask for identity documents unless it's genuinely needed."))))),
  };
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
