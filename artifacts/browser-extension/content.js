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
  console.log("[TripProfile] fillBooking called");
  console.log(
    "[TripProfile] All buttons on page:",
    Array.from(document.querySelectorAll("button")).map((b) => ({
      text: b.textContent.trim().slice(0, 20),
      aria: b.getAttribute("aria-label"),
      class: (b.className || "").slice(0, 30),
    }))
  );

  const { adults, children, childAges } = profile.autoFillPayload;

  const guestTrigger = document.querySelector(
    '[data-testid="occupancy-config"],' +
    '.b2b7952bac,' +
    '[aria-label*="adults"],' +
    'button[data-component*="occupancy"]'
  );
  if (guestTrigger) {
    guestTrigger.click();
    await sleep(600);
  }

  function findStepperForLabel(labelText) {
    const allEls = document.querySelectorAll("*");
    for (const el of allEls) {
      if (el.children.length === 0 && el.textContent.trim() === labelText) {
        const container = el.closest("[class]");
        if (container) {
          const buttons = container.querySelectorAll("button");
          if (buttons.length >= 2) {
            return {
              decrease: buttons[0],
              increase: buttons[buttons.length - 1],
            };
          }
        }
      }
    }
    return null;
  }

  const adultStepper = findStepperForLabel("Adults");
  const childStepper = findStepperForLabel("Children");

  if (adultStepper) {
    for (let i = 0; i < 8; i++) adultStepper.decrease.click();
    await sleep(100);
    for (let i = 1; i < adults; i++) adultStepper.increase.click();
    await sleep(200);
  }

  if (childStepper) {
    for (let i = 0; i < 8; i++) childStepper.decrease.click();
    await sleep(100);
    for (let i = 0; i < children; i++) childStepper.increase.click();
    await sleep(800);
  }

  const ageSelects = document.querySelectorAll("select");
  const childAgeSelects = Array.from(ageSelects).filter(
    (s) =>
      s.closest("[class]")?.textContent.toLowerCase().includes("age") ||
      s.getAttribute("aria-label")?.toLowerCase().includes("age")
  );

  childAgeSelects.forEach((select, i) => {
    if (childAges[i] !== undefined) {
      select.value = String(childAges[i]);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  console.log("[TripProfile] Booking fill:", {
    adultStepper: !!adultStepper,
    childStepper: !!childStepper,
    ageSelects: childAgeSelects.length,
  });

  showToast(
    adultStepper
      ? `Filled: ${adults} adults, ${children} children`
      : "Could not find guest fields — try opening the picker first"
  );

  return !!(adultStepper || childStepper);
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

const API_BASE = "https://travelcompaniontool.replit.app/api";

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
  const source = detectSource(window.location.hostname);

  let scored;
  try {
    const resp = await fetch(`${API_BASE}/reviews/score`, {
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

async function attemptAutoFill({ manual = false } = {}) {
  console.log(
    "[TripProfile] attemptAutoFill called, hostname:",
    window.location.hostname,
    "manual:",
    manual
  );
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const profile = result[STORAGE_KEY];
  if (!profile) {
    console.log("[TripProfile] No profile in storage");
    if (manual) showToast("No profile yet — open the extension and re-sync.");
    return false;
  }

  const hostname = window.location.hostname;
  const { adults, children } = profile.autoFillPayload;

  let filled = false;
  if (hostname.includes("expedia.com")) {
    filled = await fillExpedia(profile);
  } else if (hostname.includes("booking.com")) {
    filled = await fillBooking(profile);
  } else if (hostname.includes("google.com")) {
    filled = await fillGoogleHotels(profile);
  } else if (manual) {
    showToast("Auto-fill not supported on this site.");
    return false;
  }

  if (filled) {
    showToast(
      `TripProfile filled — ${adults} adult${adults !== 1 ? "s" : ""}, ${children} kid${children !== 1 ? "s" : ""}`
    );
  } else if (manual) {
    showToast("Couldn't find the guest picker on this page.");
  }
  return filled;
}

async function run() {
  await attemptAutoFill({ manual: false });
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const profile = result[STORAGE_KEY];
  if (profile) await scoreAndBadgeReviews(profile);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log("[TripProfile] Message received:", msg && msg.type);
  if (msg && msg.type === "MANUAL_FILL") {
    attemptAutoFill({ manual: true }).then((ok) => sendResponse({ ok }));
    return true;
  }
});

console.log("[TripProfile] content.js loaded on", window.location.hostname);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run);
} else {
  run();
}
