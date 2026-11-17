// Every customer-facing sentence the app writes itself, in UK English, in one place.

export const errorText = {
  offline: "We can't reach the server. Check your connection and try again.",
  server_error: "Something went wrong on our side. Try again in a moment.",
  invalid_email: "Write an email address with an @, such as name@example.com.",
  weak_password: "Use a password of at least 8 characters.",
  email_taken: "There's already an account with this email. Sign in instead.",
  bad_login: "That email and password don't match an account.",
  too_many_attempts: "Too many attempts for this email. Try again in 15 minutes.",
  login_required: "Sign in to continue.",
  not_an_image: "This file isn't a photo we can use. Choose a JPG, PNG or WebP file.",
  heic_not_supported: "HEIC photos aren't supported yet. Export the photo as JPG and try again.",
  unreadable_image: "We couldn't read this photo. Try saving it again as JPG or PNG.",
  empty_file: "This file is empty. Choose another photo.",
  too_many_active: "You already have 3 videos in progress. Wait for one to finish, then try again.",
  generation_paused: "Video generation is paused at the moment. Your credits haven't been used. Try again later.",
  generation_not_configured: "Video generation isn't switched on yet. You can browse the templates in the meantime.",
  template_unavailable: "This template isn't available at the moment. Choose another template.",
  unknown_template: "This template no longer exists. Choose another template.",
  no_credits: "You don't have enough credits for this video.",
  payments_not_configured: "Buying credits isn't available on the site yet.",
  payment_failed: "We couldn't open the payment page. Try again.",
  not_found: "We couldn't find that.",
  file_unavailable: "This file is no longer available.",
  rate_limited: "Too many requests in a short time. Wait a few minutes, then try again.",
  age_ineligible: "Tiraez is available to people aged 18 and over.",
  signups_closed: "We aren't opening new accounts yet.",
  onboarding_required: "Finish setting up your account to continue.",
  account_suspended: "This account is suspended. Contact us if you think this is a mistake.",
  terms_changed: "Our Terms of Service changed while this page was open. Read the current version, then try again.",
  terms_unavailable: "Our Terms of Service are being updated. Try again later.",
  jobs_active: "A video is still being made. Wait for it to finish, then try again.",
  job_active: "This video is still being made. You can delete it once it has finished.",
  invalid_request: "Some details need attention.",
  email_unverified: "Confirm your email address to continue. We've sent you a link.",
  mail_not_configured: "We can't send emails yet, so this isn't available. Contact us for help.",
  link_invalid: "This link isn't valid.",
  link_expired: "This link has expired.",
  link_used: "This link has already been used.",
};

export const policyLinks = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  acceptableUse: "/legal/acceptable-use",
  billing: "/legal/billing",
  cookies: "/legal/cookies",
  contact: "/legal/contact",
  report: "/report",
};

export const tooLarge = (mb) => `This photo is larger than ${mb} MB. Choose a smaller file or export it at a lower size.`;
export const tooSmall = (px) => `This photo is too small. Use one that is at least ${px} pixels on its shortest side.`;

export const failureText = {
  rejected: "The video model couldn't use this photo with these details. Try a different photo, or change the details you entered.",
  unavailable: "Video generation isn't available right now, so this video wasn't made.",
  busy: "The video model was too busy to take this video, so it wasn't made.",
  unconfirmed: "We couldn't confirm that the video model received this request, so we stopped it to avoid making it twice.",
  lost: "The video model lost track of this request, so the video wasn't made.",
  timeout: "The video took too long to finish, so we stopped waiting for it.",
  failed: "The video model ran into a problem and didn't finish this video.",
  cancelled: "This video was cancelled before it finished.",
  expired: "The video finished, but we couldn't collect it from the video model in time.",
  save_failed: "The video finished, but we couldn't save it.",
  prepare_failed: "We couldn't prepare your photo for the video model.",
  photo_missing: "We couldn't find the photo for this video.",
};

export const formatName = { "9:16": "Vertical 9:16", "1:1": "Square 1:1", "16:9": "Landscape 16:9" };

export const credits = (n) => `${n} credit${n === 1 ? "" : "s"}`;

export function dateText(sqlUtc) {
  const d = new Date(`${String(sqlUtc).replace(" ", "T")}Z`);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function bytesText(n) {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** "1 credit" / "15 credits for SAR 250" from the configured pricing. */
export function pricingSentences(p, paymentsOn) {
  if (!p) return [];
  const [duration, cost] = Object.entries(p.creditsByDuration)[0] ?? [];
  const out = [`Videos are paid for with credits. A ${duration}-second video uses ${credits(cost)}.`,
    `Credits come in a pack of ${p.pack.credits} for ${p.currency} ${p.pack.priceSar}.`];
  if (!paymentsOn) out.push("Buying credits isn't available on the site yet.");
  return out;
}
