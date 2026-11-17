// Confirming an email address, asking for a password reset and choosing a new password.
// Tokens arrive in the link's query string; each page takes it out of the address bar straight away.
import { api, ApiError } from "../api.js";
import { h } from "../dom.js";
import { errorText } from "../copy.js";
import { navigate, setUser } from "../main.js";
import { store } from "../state.js";
import { notice, setBusy } from "./parts.js";
import { safeNext } from "./auth.js";
import { clearErrors, field, showFieldErrors } from "./forms.js";

const NEUTRAL = "If an account exists for this email, we'll send password reset instructions.";

function page(title, lead, ...body) {
  return {
    title,
    node: h("div", { class: "wrap page" },
      h("div", { class: "auth" },
        h("div", { class: "page__head" }, h("h1", { class: "h1" }, title), lead ? h("p", { class: "lead" }, lead) : null),
        h("div", { class: "auth__panel" }, h("div", { class: "stack flow" }, ...body)))),
  };
}

function takeToken(ctx) {
  const token = ctx.query.get("token");
  if (token) {
    const u = new URL(location.href);
    u.searchParams.delete("token");
    history.replaceState(null, "", u.pathname + u.search); // keep the token out of history and screenshots
  }
  return token;
}

const linkProblem = {
  link_invalid: "This link isn't valid. It may have been copied incompletely.",
  link_expired: "This link has expired.",
  link_used: "This link has already been used.",
};

// ---------------------------------------------------------------------------------------------
// /verify-email: uses a link, or (signed in, unconfirmed) explains what to do next.

export async function verifyEmailView(ctx) {
  const token = takeToken(ctx);
  const next = safeNext(ctx.query.get("next"));
  const u = store.site.user;

  if (token) {
    try {
      const r = await api("POST", "/api/email/verify", { token });
      if (r.user) setUser(r.user);
      return page(r.changed ? "Your new email is confirmed" : "Your email is confirmed",
        r.changed ? `You now sign in with ${r.email}.` : `Thank you. ${r.email} is confirmed.`,
        h("div", { class: "btn-row" }, h("a", { class: "btn btn--primary", href: store.site.user ? next : "/signin" }, store.site.user ? "Continue" : "Sign in")));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "offline";
      return page("We couldn't confirm your email", null,
        notice(linkProblem[code] ?? errorText[code] ?? errorText.server_error, u && !u.emailVerified ? "You can send yourself a new link below." : null, { error: true }),
        u && !u.emailVerified ? resend(u) : h("p", {}, "Sign in to send yourself a new link."));
    }
  }

  if (!u) { navigate(`/signin?next=${encodeURIComponent("/verify-email")}`, { replace: true }); return null; }
  if (u.emailVerified && !u.pendingEmail) { navigate(next, { replace: true }); return null; }
  if (u.emailVerified && u.pendingEmail) {
    return page("Confirm your new email", `We've sent a link to ${u.pendingEmail}. Until you use it, you keep signing in with ${u.email}.`,
      h("a", { class: "btn btn--secondary", href: "/account" }, "Back to your account"));
  }
  return page("Confirm your email", `We've sent a link to ${u.email}. Open it to confirm the address, then you can upload photos and create videos.`,
    h("ul", { class: "plain-list small" },
      h("li", {}, "The link works once and expires in 24 hours."),
      h("li", {}, "If it hasn't arrived after a few minutes, check your spam folder or send a new one.")),
    resend(u),
    h("p", { class: "notice-text" }, "Wrong address? Change it in ", h("a", { class: "link", href: "/account" }, "your account"), "."));
}

function resend(u) {
  const status = h("p", { class: "form-status", role: "status" });
  const btn = h("button", { type: "button", class: "btn btn--secondary", onclick: async () => {
    setBusy(btn, true); status.textContent = "";
    try {
      const r = await api("POST", "/api/email/resend");
      status.textContent = `We've sent a new link to ${r.sentTo}. Earlier links no longer work.`;
    } catch (e) { status.textContent = errorText[e instanceof ApiError ? e.code : "offline"] ?? errorText.server_error; }
    finally { setBusy(btn, false); }
  } }, "Send a new link");
  return h("div", { class: "stack" }, h("div", { class: "btn-row" }, btn), status);
}

// ---------------------------------------------------------------------------------------------
// /forgot-password

export function forgotView(ctx) {
  if (!store.site.mailOn) {
    return page("Reset your password", null,
      notice("Password reset by email isn't switched on yet.", "Contact us from the Contact page and we'll help you get back in."),
      h("p", {}, h("a", { class: "link", href: "/legal/contact" }, "Contact and support")));
  }
  const email = field("Email", { name: "email", type: "email", autocomplete: "email", required: true, dir: "ltr", value: ctx.query.get("email") ?? "" });
  const status = h("p", { class: "form-status", role: "status" });
  const submit = h("button", { type: "submit", class: "btn btn--primary btn--lg btn--block" }, "Send reset instructions");
  const panelBody = h("div", { class: "stack" });
  const form = h("form", { class: "form-narrow", novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); clearErrors({ email }); status.textContent = "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.input.value.trim())) { email.setError(errorText.invalid_email); email.input.focus(); return; }
    setBusy(submit, true);
    try {
      await api("POST", "/api/password/forgot", { email: email.input.value.trim() });
      panelBody.replaceChildren(
        h("p", { class: "title", role: "status", tabindex: "-1" }, NEUTRAL),
        h("p", {}, "The link works once and expires in 1 hour. Check your spam folder if it doesn't arrive in a few minutes."),
        h("p", {}, h("a", { class: "link", href: "/signin" }, "Back to sign in")));
      panelBody.querySelector("[tabindex]").focus();
    } catch (err) {
      setBusy(submit, false);
      const code = err instanceof ApiError ? err.code : "offline";
      if (code === "invalid_request" && showFieldErrors(err.fields, { email })) return;
      status.textContent = errorText[code] ?? errorText.server_error;
    }
  } }, email.el, h("div", { class: "field" }, submit, status));
  panelBody.append(form, h("p", { class: "page__foot" }, "Remembered it? ", h("a", { class: "link", href: "/signin" }, "Sign in")));
  return page("Reset your password", "Tell us the email you sign in with, and we'll send you a link to choose a new password.", panelBody);
}

// ---------------------------------------------------------------------------------------------
// /reset-password

export async function resetView(ctx) {
  const token = takeToken(ctx);
  const again = h("a", { class: "btn btn--secondary", href: "/forgot-password" }, "Request a new link");
  if (!token) return page("Choose a new password", null, notice(linkProblem.link_invalid, null, { error: true }), again);
  let check;
  try { check = await api("GET", `/api/password/reset?token=${encodeURIComponent(token)}`); }
  catch (e) { return page("Choose a new password", null, notice(errorText[e instanceof ApiError ? e.code : "offline"] ?? errorText.server_error, null, { error: true })); }
  if (!check.ok) return page("Choose a new password", null, notice(linkProblem[`link_${check.reason}`], "Reset links work once and expire after 1 hour.", { error: true }), again);

  // A username field (read-only) lets password managers save the new password against the right account.
  const username = h("input", { type: "email", name: "username", autocomplete: "username", value: check.email, readonly: true, class: "sr-only", tabindex: "-1", "aria-hidden": "true" });
  const password = field("New password", { name: "password", type: "password", autocomplete: "new-password", required: true, minlength: 8, dir: "ltr", help: "At least 8 characters." });
  const confirm = field("Confirm new password", { name: "confirm", type: "password", autocomplete: "new-password", required: true, dir: "ltr" });
  const status = h("p", { class: "form-status", role: "status" });
  const submit = h("button", { type: "submit", class: "btn btn--primary btn--lg btn--block" }, "Save new password");
  const body = h("div", { class: "stack" });
  const all = { password, confirm };
  const form = h("form", { class: "form-narrow", novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); clearErrors(all); status.textContent = "";
    const problems = [];
    if (password.input.value.length < 8) { password.setError(errorText.weak_password); problems.push(password.input); }
    else if (password.input.value !== confirm.input.value) { confirm.setError("The two passwords don't match."); problems.push(confirm.input); }
    if (problems.length) { problems[0].focus(); return; }
    setBusy(submit, true);
    try {
      await api("POST", "/api/password/reset", { token, password: password.input.value, confirm: confirm.input.value });
      setUser(null);
      body.replaceChildren(
        h("p", { class: "title", role: "status", tabindex: "-1" }, "Your password has been changed."),
        h("p", {}, "You've been signed out everywhere. Sign in again with your new password."),
        h("a", { class: "btn btn--primary", href: "/signin" }, "Sign in"));
      body.querySelector("[tabindex]").focus();
    } catch (err) {
      setBusy(submit, false);
      const code = err instanceof ApiError ? err.code : "offline";
      if (code === "invalid_request" && showFieldErrors(err.fields, all)) return;
      if (linkProblem[code]) { body.replaceChildren(notice(linkProblem[code], null, { error: true }), again); return; }
      status.textContent = errorText[code] ?? errorText.server_error;
    }
  } }, username, password.el, confirm.el, h("div", { class: "field" }, submit, status));
  body.append(form);
  return page("Choose a new password", `For ${check.email}.`, body);
}
