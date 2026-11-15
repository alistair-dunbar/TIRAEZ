// Single-page front end. Plain JavaScript, no framework.
// All visible text is in STRINGS (Arabic first, English second) so it can be reviewed in one place.
const STRINGS = {
  ar: {
    langOther: "English", logout: "تسجيل خروج",
    heroTitle: "فيديو إعلاني لمحلك في دقيقة",
    heroText: "اختر الستايل، ارفع صورة منتجك إذا حبيت، واستلم فيديو طولي جاهز لتيك توك وإنستقرام وسناب.",
    signup: "حساب جديد", login: "دخول", email: "الإيميل", password: "كلمة المرور (٨ أحرف أو أكثر)",
    signupBtn: "أنشئ الحساب", loginBtn: "ادخل",
    credits: (n) => `رصيدك: ${n} فيديو`,
    buyTitle: "ما عندك رصيد", packText: (c, p) => `باقة ${c} فيديو بـ ${p} ريال. دفعة وحدة، بدون اشتراك.`,
    buyBtn: (p) => `اشترِ الباقة · ${p} ريال`,
    step1: "١. اختر الستايل", step2: "٢. صورة منتجك (اختياري)",
    photoHint: "صورة واضحة للمنتج كامل، من الجنب، بدون يد. JPG أو PNG، لين ١٠ ميجا.",
    choosePhoto: "اختر صورة", removePhoto: "احذف الصورة",
    make: "سوِّ الفيديو · ينخصم ١ من رصيدك", making: "جاري الطلب…",
    myVideos: "فيديوهاتك", noVideos: "ما عندك فيديوهات لسا.",
    queued: "في الانتظار…", processing: "نجهّز فيديوك… تقريباً دقيقة", failed: "ما ضبط الفيديو. رجّعنا لك الرصيد.",
    download: "تحميل",
    errors: {
      invalid_email: "الإيميل مو صحيح.", weak_password: "كلمة المرور لازم ٨ أحرف أو أكثر.",
      email_taken: "هذا الإيميل مسجّل. جرّب تدخل.", bad_login: "الإيميل أو كلمة المرور غلط.",
      no_credits: "رصيدك خلص. اشترِ باقة عشان تكمّل.", not_an_image: "الملف مو صورة. ارفع JPG أو PNG.",
      too_large: "الصورة أكبر من ١٠ ميجا.", payments_not_configured: "الدفع مو مفعّل لسا. جرّب بعدين.",
      login_required: "سجّل دخولك أول.", too_many_attempts: "محاولات كثيرة. جرّب بعد ربع ساعة.",
      payment_failed: "ما قدرنا نفتح صفحة الدفع. جرّب مرة ثانية.", not_paid: "الدفع ما اكتمل. ما انخصم منك شي.", default: "صار خطأ. جرّب مرة ثانية.",
    },
  },
  en: {
    langOther: "العربية", logout: "Log out",
    heroTitle: "A video ad for your shop in a minute",
    heroText: "Pick a style, add a photo of your product if you like, and get a vertical video ready for TikTok, Instagram and Snapchat.",
    signup: "New account", login: "Log in", email: "Email", password: "Password (8 characters or more)",
    signupBtn: "Create account", loginBtn: "Log in",
    credits: (n) => `Credits: ${n}`,
    buyTitle: "You have no credits", packText: (c, p) => `${c} videos for SAR ${p}. One payment, no subscription.`,
    buyBtn: (p) => `Buy the pack · SAR ${p}`,
    step1: "1. Pick a style", step2: "2. Your product photo (optional)",
    photoHint: "A clear photo of the whole product, from the side, no hands. JPG or PNG, up to 10 MB.",
    choosePhoto: "Choose a photo", removePhoto: "Remove photo",
    make: "Make the video · uses 1 credit", making: "Placing order…",
    myVideos: "Your videos", noVideos: "No videos yet.",
    queued: "Waiting…", processing: "Making your video… about a minute", failed: "The video didn't work. Your credit was refunded.",
    download: "Download",
    errors: {
      invalid_email: "That email doesn't look right.", weak_password: "Password needs 8 characters or more.",
      email_taken: "That email is already registered. Try logging in.", bad_login: "Wrong email or password.",
      no_credits: "You're out of credits. Buy a pack to continue.", not_an_image: "That file isn't an image. Upload a JPG or PNG.",
      too_large: "The photo is larger than 10 MB.", payments_not_configured: "Payments aren't switched on yet. Try again later.",
      login_required: "Please log in first.", too_many_attempts: "Too many attempts. Try again in 15 minutes.",
      payment_failed: "We couldn't open the payment page. Please try again.", not_paid: "The payment wasn't completed. You haven't been charged.", default: "Something went wrong. Please try again.",
    },
  },
};

let lang = localStorage.getItem("lang") === "en" ? "en" : "ar";
const t = () => STRINGS[lang];
const $ = (id) => document.getElementById(id);
const state = { user: null, templates: [], packs: [], selected: null, file: null, mode: "signup", busy: false, timer: null };

async function api(method, path, body, raw) {
  const res = await fetch(path, {
    method,
    headers: { "X-Requested-With": "app", ...(raw ? { "Content-Type": raw.type } : body ? { "Content-Type": "application/json" } : {}) },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "default");
  return data;
}
const errText = (e) => t().errors[e.message] ?? t().errors.default;

function render() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t()[el.dataset.t]; });
  $("lang").textContent = t().langOther;
  $("landing").hidden = !!state.user;
  $("dash").hidden = !state.user;
  $("logout").hidden = !state.user;
  $("credits").hidden = !state.user;
  $("tabSignup").classList.toggle("on", state.mode === "signup");
  $("tabLogin").classList.toggle("on", state.mode === "login");
  $("authSubmit").textContent = state.mode === "signup" ? t().signupBtn : t().loginBtn;
  $("password").autocomplete = state.mode === "signup" ? "new-password" : "current-password";
  if (!state.user) return;

  $("credits").textContent = t().credits(state.user.credits);
  const pack = state.packs[0];
  $("buy").hidden = state.user.credits > 0 || !pack;
  if (pack) { $("packText").textContent = t().packText(pack.credits, pack.priceSar); $("buyBtn").textContent = t().buyBtn(pack.priceSar); }
  $("photoName").textContent = state.file ? state.file.name : t().choosePhoto;
  $("clearPhoto").hidden = !state.file;
  $("make").textContent = state.busy ? t().making : t().make;
  $("make").disabled = state.busy || !state.selected || state.user.credits < 1;

  $("templates").replaceChildren(...state.templates.map((tp) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tpl"; b.setAttribute("aria-pressed", String(state.selected === tp.id));
    const img = Object.assign(document.createElement("img"), { src: tp.preview, alt: "", loading: "lazy" });
    const d = document.createElement("div");
    d.append(Object.assign(document.createElement("b"), { textContent: tp.name[lang] }),
      Object.assign(document.createElement("span"), { textContent: tp.description[lang] }));
    b.append(img, d);
    b.onclick = () => { state.selected = tp.id; render(); };
    return b;
  }));
}

function renderVideos(videos) {
  $("noVideos").hidden = videos.length > 0;
  const have = new Map([...$("videos").children].map((el) => [el.dataset.key, el]));
  $("videos").replaceChildren(...videos.map((v) => {
    const key = `${v.id}:${v.status}:${lang}`;
    if (have.has(key)) return have.get(key); // keep a playing video from restarting on every refresh
    const el = document.createElement("div"); el.className = "vid"; el.dataset.key = key;
    const name = state.templates.find((x) => x.id === v.templateId)?.name[lang] ?? v.templateId;
    const foot = document.createElement("footer");
    foot.append(Object.assign(document.createElement("span"), { textContent: name }));
    if (v.status === "done") {
      const src = `/api/videos/${v.id}/file`;
      el.append(Object.assign(document.createElement("video"), { src, controls: true, muted: true, loop: true, playsInline: true, preload: "metadata" }));
      foot.append(Object.assign(document.createElement("a"), { href: src, download: `video-${v.id}.mp4`, textContent: t().download }));
    } else {
      el.append(Object.assign(document.createElement("div"), { className: `wait ${v.status}`, textContent: t()[v.status] }));
    }
    el.append(foot);
    return el;
  }));
}

async function refresh() {
  if (!state.user) return;
  const data = await api("GET", "/api/videos");
  state.user.credits = data.credits;
  render(); renderVideos(data.videos);
  clearTimeout(state.timer);
  // Poll only while something is still being made.
  if (data.videos.some((v) => v.status === "queued" || v.status === "processing")) state.timer = setTimeout(refresh, 2500);
}

$("lang").onclick = () => { lang = lang === "ar" ? "en" : "ar"; localStorage.setItem("lang", lang); render(); refresh().catch(() => {}); };
$("tabSignup").onclick = () => { state.mode = "signup"; $("authError").textContent = ""; render(); };
$("tabLogin").onclick = () => { state.mode = "login"; $("authError").textContent = ""; render(); };
$("auth").onsubmit = async (e) => {
  e.preventDefault();
  $("authError").textContent = "";
  try {
    state.user = await api("POST", `/api/${state.mode}`, { email: $("email").value, password: $("password").value });
    $("password").value = "";
    render(); await refresh();
  } catch (err) { $("authError").textContent = errText(err); }
};
$("logout").onclick = async () => { await api("POST", "/api/logout"); clearTimeout(state.timer); state.user = null; state.selected = null; state.file = null; render(); };
$("buyBtn").onclick = async () => {
  $("buyError").textContent = "";
  try {
    const r = await api("POST", "/api/purchases", { packId: state.packs[0].id });
    if (r.status === "redirect") { location.href = r.url; return; }
    state.user.credits = r.credits; render();
  } catch (err) { $("buyError").textContent = errText(err); }
};
$("photo").onchange = () => { state.file = $("photo").files[0] ?? null; render(); };
$("clearPhoto").onclick = () => { state.file = null; $("photo").value = ""; render(); };
$("make").onclick = async () => {
  $("makeError").textContent = ""; state.busy = true; render();
  try {
    let uploadId;
    if (state.file) uploadId = (await api("PUT", "/api/uploads", null, state.file)).uploadId;
    await api("POST", "/api/videos", { templateId: state.selected, uploadId });
    state.file = null; $("photo").value = "";
  } catch (err) { $("makeError").textContent = errText(err); }
  state.busy = false;
  await refresh().catch(() => render());
};

(async () => {
  [state.user, state.templates, state.packs] = await Promise.all([
    api("GET", "/api/me"), api("GET", "/api/templates"), api("GET", "/api/packs")]);
  render();
  await refresh();
  // Back from the checkout page.
  const paid = new URLSearchParams(location.search).get("paid");
  if (paid === "0") $("buyError").textContent = t().errors.not_paid;
  if (paid) history.replaceState(null, "", "/");
})().catch(() => render());
