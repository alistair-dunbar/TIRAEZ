// Account: change details and password, sign out other devices, download your data, delete the account.
// Every effect is described as it really happens; nothing says "deleted" unless it was deleted.
import { api, ApiError } from "../api.js";
import { h } from "../dom.js";
import { credits, dateText, errorText } from "../copy.js";
import { announce, setUser } from "../main.js";
import { store } from "../state.js";
import { loading, notice, setBusy } from "./parts.js";
import { clearErrors, field, policyLink, showFieldErrors } from "./forms.js";

export async function accountView() {
  let data;
  try { data = await api("GET", "/api/account"); }
  catch (e) {
    return { title: "Account", node: h("div", { class: "wrap page" }, h("div", { class: "page__head" }, h("h1", { class: "h1" }, "Account")),
      notice("We couldn't load your account", errorText[e instanceof ApiError ? e.code : "offline"] ?? errorText.server_error, { error: true })) };
  }
  setUser(data.user);
  const u = data.user;
  const needs = u.needs.name || u.needs.age || u.needs.terms;

  return {
    title: "Account",
    node: h("div", { class: "wrap page" },
      h("div", { class: "page__head" },
        h("h1", { class: "h1" }, "Account"),
        h("p", { class: "lead" }, `Signed in as ${u.email}. You have ${credits(u.credits)}.`)),
      needs ? notice(errorText.onboarding_required, "You'll need to do this before uploading a photo or creating a video.",
        { actions: [h("a", { class: "btn btn--secondary", href: "/welcome?next=/account" }, "Finish setting up")] }) : null,
      h("div", { class: "account" },
        detailsSection(u),
        passwordSection(),
        sessionsSection(data),
        dataSection(data),
        deleteSection(data),
      ),
    ),
  };
}

/** Shown once the server has confirmed the deletion. */
function deleted(page, r) {
  document.title = `Account deleted · ${store.site.brandName}`;
  page.replaceChildren(
    h("div", { class: "page__head" },
      h("h1", { class: "h1", tabindex: "-1" }, "Your account has been deleted"),
      h("p", { class: "lead" }, "Your name, email, photos, videos and agreement records have been removed from our servers, and you've been signed out.")),
    h("ul", { class: "plain-list measure" },
      h("li", {}, "Copies sent to the video model are set to expire within about a day."),
      r.purchaseRecordsKept ? h("li", {}, `Records of ${r.purchaseRecordsKept} purchase${r.purchaseRecordsKept === 1 ? "" : "s"} are kept for accounting, without your name or email.`) : null),
    h("div", { class: "page__foot" }, h("a", { class: "btn btn--secondary", href: "/" }, "Go to the home page")));
  page.querySelector("h1").focus();
  announce("Your account has been deleted.");
}

function section(id, title, ...body) {
  return h("section", { class: "form-section account__section", "aria-labelledby": id },
    h("div", { class: "form-section__head" }, h("h2", { id }, title)), ...body);
}

function detailsSection(u) {
  const name = field("Name", { name: "name", autocomplete: "name", maxlength: 100, dir: "auto", value: u.name ?? "" });
  const email = field("Email", { name: "email", type: "email", autocomplete: "email", dir: "ltr", value: u.email });
  const password = field("Current password", { name: "password", type: "password", autocomplete: "current-password", dir: "ltr",
    help: "Needed to change the email you sign in with." });
  password.el.hidden = true;
  email.input.addEventListener("input", () => { password.el.hidden = email.input.value.trim().toLowerCase() === u.email; });
  const status = h("p", { class: "form-status", role: "status" });
  const save = h("button", { type: "submit", class: "btn btn--secondary" }, "Save details");
  const all = { name, email, password };
  const form = h("form", { class: "form-narrow", novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); clearErrors(all); status.textContent = "";
    setBusy(save, true);
    try {
      const body = { name: name.input.value, email: email.input.value, ...(password.el.hidden ? {} : { password: password.input.value }) };
      const r = await api("POST", "/api/account/profile", body);
      setUser({ ...store.site.user, ...r.user });
      password.input.value = ""; password.el.hidden = true;
      if (r.pendingEmail) {
        email.input.value = u.email;
        status.textContent = `Your name is saved. We've sent a confirmation link to ${r.pendingEmail}; your email changes when you open it.`;
        drawPending(r.user.pendingEmail);
      } else status.textContent = "Your details are saved.";
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "offline";
      if (code === "invalid_request" && showFieldErrors(err.fields, all)) status.textContent = "Some fields need attention.";
      else if (code === "email_taken") { email.setError(errorText.email_taken.replace(" Sign in instead.", "")); email.input.focus(); }
      else status.textContent = errorText[code] ?? errorText.server_error;
    } finally { setBusy(save, false); }
  } }, name.el, email.el, password.el, h("div", { class: "btn-row" }, save), status);
  const pending = h("div");
  function drawPending(addr) {
    if (!addr) { pending.replaceChildren(); return; }
    const cancel = h("button", { type: "button", class: "btn btn--quiet", onclick: async () => {
      setBusy(cancel, true);
      try { const r = await api("POST", "/api/account/email/cancel"); setUser({ ...store.site.user, ...r.user }); drawPending(null); status.textContent = "The email change was cancelled."; }
      catch (e) { setBusy(cancel, false); status.textContent = errorText[e instanceof ApiError ? e.code : "offline"] ?? errorText.server_error; }
    } }, "Cancel the change");
    pending.replaceChildren(notice(`Waiting for ${addr} to be confirmed`, `You still sign in with ${u.email} until the link we sent to ${addr} is opened.`, { actions: [cancel] }));
  }
  drawPending(u.pendingEmail);
  const verify = u.emailVerified ? null : notice("Your email isn't confirmed yet", "Confirm it to upload photos, create videos and buy credits.",
    { actions: [h("a", { class: "btn btn--secondary", href: "/verify-email" }, "Confirm your email")] });
  return section("details-title", "Your details", verify, form, pending,
    h("p", { class: "notice-text" }, "We don't send marketing emails, so there's nothing to switch off."));
}

function passwordSection() {
  const current = field("Current password", { name: "currentPassword", type: "password", autocomplete: "current-password", dir: "ltr" });
  const next = field("New password", { name: "newPassword", type: "password", autocomplete: "new-password", dir: "ltr", minlength: 8, help: "At least 8 characters." });
  const status = h("p", { class: "form-status", role: "status" });
  const save = h("button", { type: "submit", class: "btn btn--secondary" }, "Change password");
  const all = { password: current, currentPassword: current, newPassword: next };
  const form = h("form", { class: "form-narrow", novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); clearErrors({ current, next }); status.textContent = "";
    if (next.input.value.length < 8) { next.setError(errorText.weak_password); next.input.focus(); return; }
    setBusy(save, true);
    try {
      await api("POST", "/api/account/password", { currentPassword: current.input.value, newPassword: next.input.value });
      current.input.value = ""; next.input.value = "";
      status.textContent = "Your password is changed. Other browsers and devices have been signed out.";
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "offline";
      if (code === "invalid_request" && showFieldErrors(err.fields, all)) status.textContent = "";
      else status.textContent = errorText[code] ?? errorText.server_error;
    } finally { setBusy(save, false); }
  } }, current.el, next.el, h("div", { class: "btn-row" }, save), status);
  return section("password-title", "Password", h("p", { class: "notice-text" }, "Changing your password signs you out everywhere else."), form);
}

function sessionsSection(data) {
  const others = Math.max(0, data.sessions - 1);
  const text = h("p", {}, others === 0 ? "You're only signed in here." : `You're signed in here and on ${others} other browser${others === 1 ? "" : "s"} or device${others === 1 ? "" : "s"}.`);
  const status = h("p", { class: "form-status", role: "status" });
  const btn = h("button", { type: "button", class: "btn btn--secondary", disabled: others === 0, onclick: async () => {
    setBusy(btn, true);
    try {
      const r = await api("POST", "/api/account/sessions/revoke");
      text.textContent = "You're only signed in here.";
      status.textContent = r.ended ? `Signed out of ${r.ended} other session${r.ended === 1 ? "" : "s"}.` : "There were no other sessions.";
      setBusy(btn, false); btn.disabled = true;
    } catch (err) { setBusy(btn, false); status.textContent = errorText[err instanceof ApiError ? err.code : "offline"] ?? errorText.server_error; }
  } }, "Sign out of other devices");
  return section("sessions-title", "Where you're signed in", text, h("div", { class: "btn-row" }, btn), status);
}

function dataSection(data) {
  return section("data-title", "Your data",
    h("p", {}, "Download a file with your account details, your agreements, your credit history and a list of your photos and videos with links to them."),
    h("div", { class: "btn-row" }, h("a", { class: "btn btn--secondary", href: "/api/account/export", download: "" }, "Download your data")),
    data.termsAcceptedAt ? h("p", { class: "notice-text" }, `You agreed to the Terms of Service (version ${data.termsVersion}) on ${dateText(data.termsAcceptedAt)}.`,
      data.ageConfirmedAt ? ` You confirmed you are 18 or over on ${dateText(data.ageConfirmedAt)}.` : "") : null,
    h("p", { class: "notice-text" }, "To correct your name or email, change them above. For any other request about your data, ",
      h("a", { class: "link", href: "/report?kind=privacy" }, "send us a privacy request"), ". The ", policyLink("privacy", "Privacy Policy"), " explains your rights."),
  );
}

function deleteSection(data) {
  const box = h("div", { class: "stack" });
  const effects = [
    "Your account, name and email, photos, videos and agreement records are deleted from our servers straight away.",
    "Copies sent to the video model are set to expire within about a day.",
    data.purchases ? `Records of your ${data.purchases} purchase${data.purchases === 1 ? "" : "s"} are kept for accounting, with your name and email removed.` : null,
    "Unused credits are lost, and this can't be undone.",
  ].filter(Boolean);

  function start() {
    if (data.activeVideos) {
      box.replaceChildren(notice(errorText.jobs_active, "You can delete your account once every video has finished.", { error: true }));
      return;
    }
    const password = field("Password", { name: "password", type: "password", autocomplete: "current-password", dir: "ltr", help: "To confirm it's you." });
    const status = h("p", { class: "form-status", role: "status" });
    const confirm = h("button", { type: "submit", class: "btn btn--destroy" }, "Delete my account");
    const cancel = h("button", { type: "button", class: "btn btn--quiet", onclick: () => draw() }, "Keep my account");
    const form = h("form", { class: "form-narrow danger-zone", novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); password.setError(null); status.textContent = "";
      if (!password.input.value) { password.setError("Write your password."); password.input.focus(); return; }
      setBusy(confirm, true);
      try {
        const r = await api("POST", "/api/account/delete", { password: password.input.value, confirm: "delete" });
        setUser(null);
        deleted(form.closest(".page"), r);
      } catch (err) {
        setBusy(confirm, false);
        const code = err instanceof ApiError ? err.code : "offline";
        if (code === "invalid_request" && err.fields?.password) { password.setError(err.fields.password); password.input.focus(); }
        else status.textContent = errorText[code] ?? errorText.server_error;
      }
    } }, h("p", { class: "notice__title" }, "Delete your account?"), h("ul", { class: "plain-list" }, effects.map((t) => h("li", {}, t))),
      password.el, h("div", { class: "btn-row" }, confirm, cancel), status);
    box.replaceChildren(form);
    password.input.focus();
  }
  function draw() {
    box.replaceChildren(h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn--quiet btn--danger", onclick: start }, "Delete account")));
  }
  draw();
  return section("delete-title", "Delete your account",
    h("p", {}, `Deleting your account removes everything you've made with ${store.site.brandName}. If you only want to remove one video, open it from My videos.`), box);
}
