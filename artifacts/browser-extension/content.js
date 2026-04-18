const STORAGE_KEY = "tripprofile";

function showToast(message) {
  const existing = document.getElementById("tripprofile-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "tripprofile-toast";
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    background: "#1a56db",
    color: "#fff",
    padding: "10px 18px",
    borderRadius: "8px",
    fontSize: "14px",
    fontFamily: "system-ui, sans-serif",
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
    transition: "opacity 0.4s",
    opacity: "1",
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function setNativeValue(element, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  nativeInputValueSetter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fillExpedia(profile) {
  const { adults, children, childAges } = profile.autoFillPayload;
  const picker = document.querySelector(
    '[data-stid="open-hotel-guest-picker"]'
  );
  if (!picker) return false;
  picker.click();
  await sleep(600);

  const minusButtons = document.querySelectorAll(
    '[data-stid="stepper-decrease"]'
  );
  const plusButtons = document.querySelectorAll(
    '[data-stid="stepper-increase"]'
  );

  if (minusButtons.length >= 2 && plusButtons.length >= 2) {
    for (let i = 0; i < 10; i++) minusButtons[0].click();
    for (let i = 0; i < adults; i++) plusButtons[0].click();
    await sleep(200);
    for (let i = 0; i < 10; i++) minusButtons[1].click();
    for (let i = 0; i < children; i++) plusButtons[1].click();
    await sleep(400);

    const ageSelects = document.querySelectorAll(
      'select[data-stid*="age"], select[name*="childAge"]'
    );
    ageSelects.forEach((select, i) => {
      const age = childAges[i];
      if (age !== undefined) {
        select.value = String(age);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  return true;
}

async function fillBooking(profile) {
  const { adults, children, childAges } = profile.autoFillPayload;

  const adultsInput = document.querySelector(
    ".sb-group__input--adults, input[name='group_adults']"
  );
  const childrenInput = document.querySelector(
    ".sb-group__input--children, input[name='group_children']"
  );
  if (!adultsInput && !childrenInput) return false;

  if (adultsInput) setNativeValue(adultsInput, adults);
  if (childrenInput) setNativeValue(childrenInput, children);
  await sleep(400);

  const ageSelects = document.querySelectorAll(
    "select[name*='age_child'], .sb-group__field--age select"
  );
  ageSelects.forEach((select, i) => {
    const age = childAges[i];
    if (age !== undefined) {
      select.value = String(age);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  return true;
}

async function fillGoogleHotels(profile) {
  const { adults, children } = profile.autoFillPayload;
  const travelersBtn = document.querySelector('[data-label="Travelers"]');
  if (!travelersBtn) return false;
  travelersBtn.click();
  await sleep(600);

  const increaseButtons = document.querySelectorAll(
    '[aria-label*="Increase"], button[data-label*="increase"]'
  );
  if (increaseButtons.length >= 2) {
    for (let i = 0; i < 10; i++) increaseButtons[0].click();
    for (let i = 0; i < adults; i++) increaseButtons[0].click();
    await sleep(200);
    for (let i = 0; i < children; i++) increaseButtons[1].click();
  }

  return true;
}

const CONFIG_KEY = "tripprofile_config";
const DEFAULT_API_BASE = "https://travelcompaniontool.replit.app/api";

async function getApiBase() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return (result[CONFIG_KEY] && result[CONFIG_KEY].apiBase) || DEFAULT_API_BASE;
}

function detectSource(hostname) {
  if (hostname.includes("google.com")) return "google";
  /* `/reviews/score` only accepts "tripadvisor" | "google" — default to google for everything else */
  return "google";
}

async function scoreAndBadgeReviews(profile) {
  const reviewEls = document.querySelectorAll(
    "[data-review-text], .review-text, .reviewText, .bui-review-badge__description, .reviews-text"
  );
  if (!reviewEls.length) return;

  const reviews = Array.from(reviewEls).map((el) => el.textContent.trim());
  const propertyId = encodeURIComponent(window.location.pathname + window.location.search);
  const apiBase = await getApiBase();
  const source = detectSource(window.location.hostname);

  let scored;
  try {
    const resp = await fetch(`${apiBase}/reviews/score`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, source, reviews }),
    });
    if (!resp.ok) return;
    scored = await resp.json();
  } catch {
    return;
  }

  reviewEls.forEach((el, i) => {
    const score = scored[i];
    if (!score) return;

    const topTags = (score.tags || []).slice(0, 2);
    const badge = document.createElement("span");
    badge.textContent = `★ ${score.luxuryValueScore}/10${topTags.length ? " · " + topTags.join(", ") : ""}`;
    Object.assign(badge.style, {
      display: "inline-block",
      marginLeft: "8px",
      background: "#eff6ff",
      border: "1px solid #93c5fd",
      color: "#1d4ed8",
      borderRadius: "4px",
      padding: "2px 7px",
      fontSize: "12px",
      fontFamily: "system-ui, sans-serif",
      verticalAlign: "middle",
    });
    el.insertAdjacentElement("afterend", badge);
  });
}

async function run() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const profile = result[STORAGE_KEY];
  if (!profile) return;

  const hostname = window.location.hostname;
  const { adults, children } = profile.autoFillPayload;

  let filled = false;
  if (hostname.includes("expedia.com")) {
    filled = await fillExpedia(profile);
  } else if (hostname.includes("booking.com")) {
    filled = await fillBooking(profile);
  } else if (hostname.includes("google.com")) {
    filled = await fillGoogleHotels(profile);
  }

  if (filled) {
    showToast(
      `TripProfile filled — ${adults} adult${adults !== 1 ? "s" : ""}, ${children} kid${children !== 1 ? "s" : ""}`
    );
  }

  await scoreAndBadgeReviews(profile);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run);
} else {
  run();
}
