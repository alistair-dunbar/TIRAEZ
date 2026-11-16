// Sign in and create an account. Errors appear under their field and are announced.
import { api, ApiError } from "../api.js";
import { h, id } from "../dom.js";
import { errorText } from "../copy.js";
import { navigate, setUser } from "../main.js";

export function authView(ctx, mode) {
  const next = safeNext(ctx.query.get("next"));
  const signup = mode === "signup";
  const emailId = id("email"), passId = id("password"), emailErr = id("email-error"), passErr = id("password-error");
  const email = h("input", { class: "input", id: emailId, type: "email", autocomplete: "email", required: true, "aria-describedby": emailErr, dir: "ltr" });
  const password = h("input", { class: "input", id: passId, type: "password", autocomplete: signup ? "new-password" : "current-password", required: true, minlength: 8, "aria-describedby": `${passErr} ${passId}-help`, dir: "ltr" });
  const emailError = h("p", { class: "field__error", id: emailErr });
  const passError = h("p", { class: "field__error", id: passErr });
  const status = h("p", { class: "form-status", role: "status" });
  const submit = h("button", { class: "btn btn--primary btn--lg", type: "submit" }, signup ? "Create account" : "Sign in");

  function setError(input, el, text) {
    el.textContent = text ?? "";
    if (text) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
  }

  const form = h("form", { class: "form-narrow", novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    setError(email, emailError, null); setError(password, passError, null); status.textContent = "";
    const problems = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setError(email, emailError, errorText.invalid_email); problems.push(email); }
    if (password.value.length < 8) { setError(password, passError, signup ? errorText.weak_password : "Write your password."); problems.push(password); }
    if (problems.length) { status.textContent = `${problems.length === 1 ? "One field needs" : "Two fields need"} attention.`; problems[0].focus(); return; }
    submit.disabled = true;
    status.textContent = signup ? "Creating your account" : "Signing in";
    try {
      const u = await api("POST", signup ? "/api/signup" : "/api/login", { email: email.value.trim(), password: password.value });
      setUser(u);
      navigate(next, { replace: true });
    } catch (err) {
      submit.disabled = false;
      const code = err instanceof ApiError ? err.code : "offline";
      if (code === "invalid_email" || code === "email_taken") { setError(email, emailError, errorText[code]); email.focus(); status.textContent = ""; }
      else if (code === "weak_password") { setError(password, passError, errorText[code]); password.focus(); status.textContent = ""; }
      else status.textContent = errorText[code] ?? errorText.server_error;
    }
  } },
    h("div", { class: "field" }, h("label", { class: "field__label", for: emailId }, "Email"), email, emailError),
    h("div", { class: "field" }, h("label", { class: "field__label", for: passId }, "Password"),
      h("p", { class: "field__help", id: `${passId}-help` }, signup ? "At least 8 characters." : ""),
      password, passError),
    h("div", { class: "field" }, submit, status),
  );

  const switchTo = signup
    ? h("p", {}, "Already have an account? ", h("a", { class: "link", href: `/signin${next !== "/templates" ? `?next=${encodeURIComponent(next)}` : ""}` }, "Sign in"))
    : h("p", {}, "New here? ", h("a", { class: "link", href: `/signup${next !== "/templates" ? `?next=${encodeURIComponent(next)}` : ""}` }, "Create an account"));

  return {
    title: signup ? "Create an account" : "Sign in",
    node: h("div", { class: "wrap page" },
      h("div", { class: "page__head" },
        h("h1", { class: "h1" }, signup ? "Create an account" : "Sign in"),
        h("p", { class: "lead" }, signup
          ? "An account keeps your videos together so you can watch and download them again."
          : "Sign in to create videos and see the ones you've made."),
      ),
      form,
      h("div", { class: "page__foot" }, switchTo),
    ),
  };
}

function safeNext(v) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/templates";
}
