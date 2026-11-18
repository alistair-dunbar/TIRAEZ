// Report a problem: misuse of someone's photo, likeness or brand, harmful content, or a security issue.
// Goes into a queue the team reviews; the page promises nothing beyond that.
import { api, ApiError } from "../api.js";
import { h, id } from "../dom.js";
import { errorText } from "../copy.js";
import { store } from "../state.js";
import { setBusy } from "./parts.js";
import { clearErrors, field, policyLink, setError, showFieldErrors } from "./forms.js";

export function reportView(ctx) {
  const signedIn = Boolean(store.site.user);
  const kinds = store.site.reportKinds ?? {};
  const kindErr = id("kind-error");
  const kindError = h("p", { class: "field__error", id: kindErr });
  const radios = Object.entries(kinds).map(([value, label]) =>
    h("label", { class: "option" }, h("input", { type: "radio", name: "kind", value, checked: ctx.query.get("kind") === value }), h("span", {}, label)));
  const group = h("fieldset", { class: "field report__kinds", "aria-describedby": kindErr },
    h("legend", { class: "field__label" }, "What is the problem?"), radios, kindError);
  const kind = { input: radios[0]?.querySelector("input"), setError: (t) => { setError(group, kindError, t); } };

  const target = field("Where is it?", { name: "target", optional: true, maxlength: 500, value: ctx.query.get("video") ? `Video ${ctx.query.get("video")}` : "",
    help: "A link, a video number, or where you saw it." });
  const details = field("What happened", { name: "details", textarea: true, maxlength: 4000, rows: 6,
    help: "Tell us what you saw and, if it's about your own photo, likeness or brand, how it's yours." });
  const email = signedIn ? null : field("Your email", { name: "email", type: "email", optional: true, autocomplete: "email", dir: "ltr",
    help: "Only if you'd like us to be able to reply." });
  const all = { kind, target, details, ...(email ? { email } : {}) };
  const status = h("p", { class: "form-status", role: "status" });
  const submit = h("button", { type: "submit", class: "btn btn--primary" }, "Send report");
  const panel = h("div", { class: "auth__panel" });

  const form = h("form", { class: "form-narrow", novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); clearErrors(all); status.textContent = "";
    const chosen = form.querySelector("input[name=kind]:checked")?.value;
    const problems = [];
    if (!chosen) { kind.setError("Choose what the problem is."); problems.push(kind.input); }
    if (details.input.value.trim().length < 10) { details.setError("Tell us what happened, in a sentence or two."); problems.push(details.input); }
    if (problems.length) { problems[0].focus(); return; }
    setBusy(submit, true);
    try {
      const r = await api("POST", "/api/reports", { kind: chosen, target: target.input.value, details: details.input.value, email: email?.input.value ?? "" });
      panel.replaceChildren(h("div", { class: "stack", role: "status" },
        h("h2", { class: "title", tabindex: "-1" }, "Thank you. We've received your report."),
        h("p", {}, `Your reference is ${r.id}. The team reviews every report${signedIn || email?.input.value ? " and will contact you if we need more information" : ""}.`)));
      panel.querySelector("h2").focus();
    } catch (err) {
      setBusy(submit, false);
      const code = err instanceof ApiError ? err.code : "offline";
      if (code === "invalid_request" && showFieldErrors(err.fields, all)) return;
      status.textContent = errorText[code] ?? errorText.server_error;
    }
  } }, group, target.el, details.el, email?.el, h("div", { class: "field" }, h("div", { class: "btn-row" }, submit), status));
  panel.append(form);

  return {
    title: "Report a problem",
    node: h("div", { class: "wrap page" },
      h("div", { class: "auth" },
        h("div", { class: "page__head" },
          h("h1", { class: "h1" }, "Report a problem"),
          h("p", { class: "lead" }, "Tell us about content made with ", store.site.brandName,
            " that breaks our rules or uses your photo, likeness or brand without permission, or about a security problem."),
          h("p", { class: "notice-text" }, "Read what isn't allowed in our ", policyLink("acceptableUse", "Acceptable Use Policy"),
            ". If someone is in immediate danger, contact the police first.")),
        panel)),
  };
}
