console.log("[TripProfile] Content script loaded on:", window.location.hostname);

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

  // Open the picker (try the new selector first, fall back to legacy).
  const trigger =
    document.querySelector('[data-stid="open-room-picker"]') ||
    document.querySelector('[data-stid="open-hotel-guest-picker"]');
  if (trigger) {
    trigger.click();
    await sleep(800);
  }

  // Get the picker container (positional buttons inside).
  const container = document.querySelector(
    '[data-stid="rooms-traveler-selector-menu-container"]'
  );

  if (!container) {
    console.log("[TripProfile] Expedia picker container not found");
    showToast("Open the guest picker first, then click Fill This Page");
    return false;
  }

  const buttons = Array.from(container.querySelectorAll("button"));
  console.log(
    "[TripProfile] Expedia buttons:",
    buttons.map((b) => b.textContent.trim().slice(0, 15))
  );

  // Buttons in order: adultDec, adultInc, childDec, childInc, addRoom, done
  const adultDec = buttons[0];
  const adultInc = buttons[1];
  const childDec = buttons[2];
  const childInc = buttons[3];

  if (!adultInc) {
    console.log("[TripProfile] Expedia stepper buttons not found");
    showToast("Could not find guest fields");
    return false;
  }

  // ADULTS — floor is 1, so 9 decrements then climb to target.
  if (adultDec) {
    for (let i = 0; i < 9; i++) {
      adultDec.click();
      await sleep(40);
    }
  }
  for (let i = 1; i < adults; i++) {
    adultInc.click();
    await sleep(40);
  }
  await sleep(200);

  // CHILDREN — floor is 0.
  if (childDec) {
    for (let i = 0; i < 10; i++) {
      childDec.click();
      await sleep(40);
    }
  }
  if (childInc) {
    for (let i = 0; i < children; i++) {
      childInc.click();
      await sleep(40);
    }
  }
  await sleep(500); // wait for child age <select>s to render

  // Fill child age dropdowns. Re-query inside the container; selectors
  // vary between Expedia builds so try a few patterns.
  const ageSelects = Array.from(
    container.querySelectorAll(
      'select[data-stid*="age"], select[name*="childAge"], select[id*="age"], select'
    )
  );
  ageSelects.slice(0, children).forEach((select, i) => {
    const age = childAges[i];
    if (age === undefined || age === null) return;
    setNativeValue(select, String(age));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Click Done to close the picker and commit the values.
  const doneBtn = buttons.find((b) => b.textContent.trim() === "Done");
  if (doneBtn) {
    await sleep(400);
    doneBtn.click();
  }

  showToast(`Filled: ${adults} adult${adults !== 1 ? "s" : ""}, ${children} child${children !== 1 ? "ren" : ""}`);
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

  const allButtons = Array.from(document.querySelectorAll("button"));
  const stepperButtons = allButtons.filter((b) => {
    const text = b.textContent.trim();
    const hasIcon = b.querySelector('svg, [class*="icon"]');
    return (
      text === "+" ||
      text === "−" ||
      text === "-" ||
      text === "–" ||
      hasIcon
    );
  });
  console.log(
    "[TripProfile] Stepper buttons found:",
    stepperButtons.length,
    stepperButtons.map((b) => b.textContent.trim().slice(0, 5))
  );

  function getSteppersNearText(searchText) {
    const elements = Array.from(document.querySelectorAll("*"));
    for (const el of elements) {
      if (
        el.children.length === 0 &&
        el.textContent.trim().toLowerCase() === searchText.toLowerCase()
      ) {
        let container = el.parentElement;
        for (let i = 0; i < 5; i++) {
          if (!container) break;
          const buttons = container.querySelectorAll("button");
          if (buttons.length >= 2) {
            console.log(
              "[TripProfile] Found",
              searchText,
              "container with",
              buttons.length,
              "buttons"
            );
            return {
              decrease: buttons[0],
              increase: buttons[buttons.length - 1],
            };
          }
          container = container.parentElement;
        }
      }
    }
    return null;
  }

  const adultStepper =
    getSteppersNearText("Adults") || getSteppersNearText("Adult");
  const childStepper =
    getSteppersNearText("Children") || getSteppersNearText("Child");

  console.log("[TripProfile] Steppers:", {
    adult: !!adultStepper,
    child: !!childStepper,
  });

  if (!adultStepper && !childStepper) {
    if (stepperButtons.length >= 6) {
      console.log("[TripProfile] Using position-based approach (last 6)");
      const len = stepperButtons.length;
      const adultDec = stepperButtons[len - 6];
      const adultInc = stepperButtons[len - 5];
      const childDec = stepperButtons[len - 4];
      const childInc = stepperButtons[len - 3];

      for (let i = 0; i < 8; i++) adultDec.click();
      await sleep(200);
      for (let i = 1; i < adults; i++) adultInc.click();
      await sleep(200);
      for (let i = 0; i < 8; i++) childDec.click();
      await sleep(200);
      for (let i = 0; i < children; i++) childInc.click();
      await sleep(600);

      showToast(`Filled: ${adults} adults, ${children} children`);
      return true;
    }
    showToast("Could not find guest fields");
    return false;
  }

  if (adultStepper) {
    for (let i = 0; i < 8; i++) adultStepper.decrease.click();
    await sleep(300);
    for (let i = 1; i < adults; i++) adultStepper.increase.click();
    await sleep(300);
  }

  if (childStepper) {
    for (let i = 0; i < 8; i++) childStepper.decrease.click();
    await sleep(300);
    for (let i = 0; i < children; i++) childStepper.increase.click();
    await sleep(800);
  }

  await sleep(500);
  const allSelects = Array.from(document.querySelectorAll("select"));
  allSelects.forEach((select, i) => {
    if (childAges[i] !== undefined) {
      select.value = String(childAges[i]);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
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

// ─── Floating reference panel ──────────────────────────────────────────────
// Always-visible card pinned top-right that surfaces the user's profile so
// they can fill any travel form by sight, without us touching the DOM.
const PANEL_ID = "tripprofile-floating-panel";

function buildPanelLines(profile) {
  if (!profile) return null;
  const af = profile.autoFillPayload || {};
  const adults = af.adults ?? 0;
  const children = af.children ?? 0;
  const childAges = Array.isArray(af.childAges) ? af.childAges : [];
  const loyalty = Array.isArray(profile.loyaltyPrograms) ? profile.loyaltyPrograms : [];

  const partyLine = `${adults} adult${adults !== 1 ? "s" : ""}` +
    (children > 0 ? ` · ${children} child${children !== 1 ? "ren" : ""}` : "");
  const ageLine = childAges.length > 0 ? `Ages: ${childAges.join(", ")}` : null;

  return { partyLine, ageLine, loyalty };
}

function injectFloatingPanel(profile) {
  const existing = document.getElementById(PANEL_ID);
  if (existing) existing.remove();

  const data = buildPanelLines(profile);
  if (!data) return false;

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  Object.assign(panel.style, {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: "2147483647",
    width: "280px",
    background: "#FAFAF8",
    border: "1px solid #E5E0D8",
    borderRadius: "6px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#1C1C1C",
    overflow: "hidden",
  });

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, {
    background: "#6B2737",
    color: "#fff",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  });
  const title = document.createElement("div");
  title.textContent = "Companion";
  Object.assign(title.style, {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontStyle: "italic",
    fontSize: "16px",
    fontWeight: "400",
  });
  const close = document.createElement("button");
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  Object.assign(close.style, {
    background: "transparent",
    border: "none",
    color: "#fff",
    fontSize: "20px",
    lineHeight: "1",
    cursor: "pointer",
    padding: "0 4px",
  });
  close.addEventListener("click", () => panel.remove());
  header.appendChild(title);
  header.appendChild(close);
  panel.appendChild(header);

  // Body
  const body = document.createElement("div");
  Object.assign(body.style, { padding: "12px 14px 14px" });

  const partyEl = document.createElement("div");
  partyEl.textContent = data.partyLine;
  Object.assign(partyEl.style, {
    fontSize: "14px",
    fontWeight: "600",
    color: "#1C1C1C",
    marginBottom: data.ageLine ? "2px" : "10px",
  });
  body.appendChild(partyEl);

  if (data.ageLine) {
    const ageEl = document.createElement("div");
    ageEl.textContent = data.ageLine;
    Object.assign(ageEl.style, {
      fontSize: "12.5px",
      color: "#5C5248",
      marginBottom: "10px",
    });
    body.appendChild(ageEl);
  }

  if (data.loyalty.length > 0) {
    const loyaltyTitle = document.createElement("div");
    loyaltyTitle.textContent = "Loyalty";
    Object.assign(loyaltyTitle.style, {
      fontSize: "9.5px",
      fontWeight: "600",
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: "#A07840",
      marginTop: "6px",
      marginBottom: "5px",
      paddingTop: "8px",
      borderTop: "1px solid #E5E0D8",
    });
    body.appendChild(loyaltyTitle);

    data.loyalty.slice(0, 6).forEach((p) => {
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        justifyContent: "space-between",
        gap: "8px",
        fontSize: "12px",
        color: "#1C1C1C",
        padding: "3px 0",
      });
      const label = document.createElement("span");
      label.textContent = p.programName || p.brand || "Program";
      label.style.fontWeight = "500";
      const num = document.createElement("span");
      num.textContent = p.membershipNumber || "—";
      Object.assign(num.style, {
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        fontSize: "11px",
        color: "#5C5248",
        userSelect: "all",
      });
      row.appendChild(label);
      row.appendChild(num);
      body.appendChild(row);
    });
  }

  const footer = document.createElement("div");
  footer.textContent = "Reference while you fill the form";
  Object.assign(footer.style, {
    marginTop: "10px",
    paddingTop: "8px",
    borderTop: "1px solid #E5E0D8",
    fontFamily: "'Playfair Display', Georgia, serif",
    fontStyle: "italic",
    fontSize: "11.5px",
    color: "#94A39B",
    textAlign: "center",
  });
  body.appendChild(footer);

  panel.appendChild(body);
  document.body.appendChild(panel);
  return true;
}

async function showFloatingPanel() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const profile = result[STORAGE_KEY];
  if (!profile) {
    showToast("Sync your Companion profile first.");
    return false;
  }
  return injectFloatingPanel(profile);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log("[TripProfile] Message received:", msg && msg.type);
  try {
    if (msg && msg.type === "MANUAL_FILL") {
      // Legacy path: still try DOM auto-fill on demand.
      attemptAutoFill({ manual: true }).then((ok) => {
        try { sendResponse({ ok }); } catch (e) {}
      });
      return true;
    }
    if (msg && msg.type === "SHOW_PANEL") {
      // Primary UX: inject the always-visible reference card.
      // Also kick off DOM auto-fill in the background — best-effort, silent.
      showFloatingPanel().then((shown) => {
        attemptAutoFill({ manual: false }).catch(() => {});
        try { sendResponse({ ok: shown }); } catch (e) {}
      });
      return true;
    }
  } catch (err) {
    try { sendResponse({ ok: false, error: String(err) }); } catch (e) {}
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run);
} else {
  run();
}
