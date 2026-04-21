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

// ─── UNIVERSAL FILL ENGINE ─────────────────────────────────────────────────
// Finds the pattern — "a container with Adults and Children labels and stepper
// buttons" — rather than targeting specific sites. Works on Booking, Expedia,
// Hotels.com, Marriott, Hyatt, and any travel site that follows the pattern.

const API_BASE = "https://travelcompaniontool.replit.app/api";

async function universalFill(profile) {
  const { adults, children, childAges } = profile.autoFillPayload;

  // STEP 1: Find and open the guest/traveler picker.
  const triggerSelectors = [
    '[data-stid="open-room-picker"]',
    '[data-testid="occupancy-config"]',
    '[data-testid="travelers-field"]',
    'button[aria-label*="traveler" i]',
    'button[aria-label*="guest" i]',
    'button[aria-label*="passenger" i]',
    'button[aria-label*="occupancy" i]',
    '[class*="traveler-selector"]',
    '[class*="guest-picker"]',
    '[class*="occupancy"]',
    '[class*="pax-selector"]',
    '[id*="traveler"]',
    '[id*="guest"]',
  ];

  for (const sel of triggerSelectors) {
    const el = document.querySelector(sel);
    if (el && !el.getAttribute("aria-expanded")) {
      el.click();
      await sleep(800);
      console.log("[TripProfile] Opened picker with:", sel);
      break;
    }
  }

  // STEP 2: Find the picker container (has both Adults and Children labels).
  async function findPickerContainer() {
    for (let attempt = 0; attempt < 4; attempt++) {
      const allEls = Array.from(
        document.querySelectorAll(
          'div, section, form, [role="dialog"], [role="listbox"]'
        )
      );
      for (const el of allEls) {
        const text = el.innerText || "";
        const hasAdults = /adults?/i.test(text);
        const hasChildren = /children|child/i.test(text);
        const buttonCount = el.querySelectorAll("button").length;
        if (hasAdults && hasChildren && buttonCount >= 2 && buttonCount < 30) {
          return el;
        }
      }
      await sleep(500);
    }
    return null;
  }

  const container = await findPickerContainer();
  if (!container) {
    console.log("[TripProfile] No picker container found");
    showToast("Open the guest picker first, then try again");
    return false;
  }
  console.log(
    "[TripProfile] Found picker container:",
    container.className?.slice(0, 50)
  );

  // STEP 3: Find stepper pairs by walking up from the label text.
  function findStepperNearLabel(root, labelPattern) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (labelPattern.test(node.textContent.trim())) {
        let el = node.parentElement;
        for (let i = 0; i < 6; i++) {
          if (!el || el === root) break;
          const btns = Array.from(el.querySelectorAll("button")).filter((b) => {
            const txt = b.textContent.trim().toLowerCase();
            return (
              ![
                "done",
                "close",
                "apply",
                "search",
                "cancel",
                "ok",
                "add another room",
                "add another",
                "save",
              ].includes(txt) && txt.length < 20
            );
          });
          if (btns.length >= 2) {
            return {
              decrease: btns[0],
              increase: btns[btns.length - 1],
              label: node.textContent.trim(),
            };
          }
          el = el.parentElement;
        }
      }
    }
    return null;
  }

  const adultStepper = findStepperNearLabel(container, /^adults?$/i);
  const childStepper = findStepperNearLabel(container, /^children$|^child$/i);

  console.log("[TripProfile] Steppers found:", {
    adults: !!adultStepper,
    children: !!childStepper,
    adultLabel: adultStepper?.label,
    childLabel: childStepper?.label,
  });

  // STEP 4: Reset to floor, then increment to target.
  async function fillStepper(stepper, targetCount, minimum = 0) {
    if (!stepper) return false;
    for (let i = 0; i < 10; i++) {
      stepper.decrease.click();
      await sleep(50);
    }
    await sleep(300);
    const clicksNeeded = Math.max(0, targetCount - minimum);
    for (let i = 0; i < clicksNeeded; i++) {
      stepper.increase.click();
      await sleep(100);
    }
    await sleep(300);
    return true;
  }

  const adultFilled = await fillStepper(adultStepper, adults, 1);
  const childFilled = await fillStepper(childStepper, children, 0);

  // STEP 5: Fill child age dropdowns (rendered after children added).
  if (children > 0 && Array.isArray(childAges) && childAges.length > 0) {
    await sleep(1000);

    const allSelects = Array.from(container.querySelectorAll("select"));
    const ageSelects = allSelects.filter((s) => {
      const label =
        s.getAttribute("aria-label") ||
        s.getAttribute("name") ||
        s.id ||
        s.closest("[class]")?.textContent ||
        "";
      return /age/i.test(label) || allSelects.length <= children;
    });
    console.log("[TripProfile] Age selects:", ageSelects.length);

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value"
    ).set;

    for (let i = 0; i < ageSelects.length; i++) {
      if (childAges[i] === undefined) continue;
      const select = ageSelects[i];
      const age = String(childAges[i]);

      select.value = age;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(100);

      if (select.value !== age && nativeSetter) {
        nativeSetter.call(select, age);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await sleep(150);
      console.log(
        "[TripProfile] Age",
        i,
        "target:",
        age,
        "result:",
        select.value
      );
    }
  }

  // STEP 6: Close the picker.
  await sleep(400);
  const closeButton = Array.from(container.querySelectorAll("button")).find(
    (b) => /^done$|^apply$|^search$|^close$/i.test(b.textContent.trim())
  );
  if (closeButton) {
    closeButton.click();
    console.log("[TripProfile] Closed picker");
  }

  const success = adultFilled || childFilled;
  if (success) {
    showToast(
      `Filled: ${adults} adults, ${children} children` +
        (Array.isArray(childAges) && childAges.length > 0
          ? `, ages ${childAges.join(", ")}`
          : "")
    );
  } else {
    showToast("Could not auto-fill — use the profile card to fill manually");
  }

  return success;
}

// ─── Review badging (unchanged) ───────────────────────────────────────────
function detectSource(hostname) {
  if (hostname.includes("google.com")) return "google";
  // `/reviews/score` only accepts "tripadvisor" | "google" — default to google.
  return "google";
}

async function scoreAndBadgeReviews(profile) {
  const reviewEls = document.querySelectorAll(
    "[data-review-text], .review-text, .reviewText, .bui-review-badge__description, .reviews-text"
  );
  if (!reviewEls.length) return;

  const reviews = Array.from(reviewEls).map((el) => el.textContent.trim());
  const propertyId = encodeURIComponent(
    window.location.pathname + window.location.search
  );
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
  return universalFill(profile);
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
