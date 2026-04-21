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
// Pattern-based: finds any container with Adults/Children labels and steppers.
// No site-specific code. Works on any travel site that follows the pattern.

const API_BASE = "https://travelcompaniontool.replit.app/api";

async function universalFill(profile) {
  const { adults, children, childAges } = profile.autoFillPayload;

  console.log("[TripProfile] Universal fill starting:", {
    adults,
    children,
    childAges,
  });

  // STEP 1: Try to open the picker.
  const triggerPatterns = [
    '[data-stid*="room-picker"]',
    '[data-stid*="traveler"]',
    '[data-stid*="guest"]',
    '[data-testid*="occupancy"]',
    '[data-testid*="traveler"]',
    '[data-testid*="guest"]',
    '[id*="traveler"]',
    '[id*="guest"]',
    '[id*="occupancy"]',
    '[aria-label*="traveler" i]',
    '[aria-label*="guest" i]',
    '[aria-label*="passenger" i]',
  ];

  for (const sel of triggerPatterns) {
    const el = document.querySelector(sel);
    if (el) {
      el.click();
      console.log("[TripProfile] Opened with:", sel);
      await sleep(1200); // Longer initial wait so the picker fully mounts.
      break;
    }
  }

  // STEP 2: Find the picker container — wait up to 3s for it to appear.
  // Pick the SMALLEST element that contains both labels (most specific).
  let container = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidates = Array.from(
      document.querySelectorAll(
        'div, section, form, [role="dialog"], [role="group"]'
      )
    );
    for (const el of candidates) {
      const text = el.innerText || "";
      const btns = el.querySelectorAll("button");

      if (!/adults?/i.test(text)) continue;
      if (!/children|child/i.test(text)) continue;
      if (el.offsetHeight === 0) continue;

      console.log("[TripProfile] Candidate:", {
        tag: el.tagName,
        class: (el.className || "").toString().slice(0, 40),
        buttons: btns.length,
        height: el.offsetHeight,
        text: text.slice(0, 60).replace(/\n/g, " "),
      });

      if (btns.length >= 2) {
        if (!container || el.innerHTML.length < container.innerHTML.length) {
          container = el;
        }
      }
    }
    if (container) {
      console.log("[TripProfile] Selected container:", {
        class: (container.className || "").toString().slice(0, 40),
        buttons: container.querySelectorAll("button").length,
      });
      break;
    }

    // Halfway through, dump candidates so we can debug what's on the page.
    if (!container && attempt === 2) {
      const withAdults = Array.from(document.querySelectorAll("*"))
        .filter(
          (el) =>
            el.children.length < 20 &&
            /adults?/i.test(el.innerText || "") &&
            el.offsetHeight > 0
        )
        .slice(0, 5);
      console.log(
        "[TripProfile] Elements with Adults text:",
        withAdults.map((el) => ({
          tag: el.tagName,
          class: (el.className || "").toString().slice(0, 30),
          buttons: el.querySelectorAll("button").length,
          text: (el.innerText || "").slice(0, 50),
        }))
      );
    }

    await sleep(500);
  }

  if (!container) {
    console.log("[TripProfile] No picker found");
    showToast("Open the guest picker first, then click Fill This Page");
    return false;
  }

  console.log(
    "[TripProfile] Container found:",
    container.className?.slice(0, 40),
    "buttons:",
    container.querySelectorAll("button").length
  );

  // STEP 3: Find the Adults and Children steppers.
  function findStepperForLabel(labelRegex) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (!labelRegex.test(text) || text.length > 15) continue;

      let el = node.parentElement;
      for (let depth = 0; depth < 6; depth++) {
        if (!el || el === container) break;
        const btns = Array.from(el.querySelectorAll("button"));
        const stepperBtns = btns.filter((b) => {
          const txt = b.textContent.trim();
          const aria = b.getAttribute("aria-label") || "";
          return (
            txt.length <= 3 ||
            aria.match(/increase|decrease|add|remove|plus|minus/i) ||
            b.className?.match(/step|increment|decrement/i)
          );
        });
        if (stepperBtns.length >= 2) {
          console.log(
            '[TripProfile] Stepper for "' + text + '":',
            stepperBtns.map(
              (b) => b.getAttribute("aria-label") || b.textContent.trim()
            )
          );
          return {
            dec: stepperBtns[0],
            inc: stepperBtns[stepperBtns.length - 1],
          };
        }
        el = el.parentElement;
      }
    }
    return null;
  }

  const adultStepper = findStepperForLabel(/^adults?$/i);
  const childStepper = findStepperForLabel(/^children$|^child$/i);

  console.log("[TripProfile] Steppers:", {
    adults: !!adultStepper,
    children: !!childStepper,
  });

  if (!adultStepper && !childStepper) {
    showToast("Could not find guest fields — try opening the picker first");
    return false;
  }

  // STEP 4: Fill the steppers.
  async function setStepper(stepper, target, minimum = 0) {
    if (!stepper) return;
    for (let i = 0; i < 10; i++) {
      stepper.dec.click();
      await sleep(60);
    }
    await sleep(300);
    const clicks = Math.max(0, target - minimum);
    for (let i = 0; i < clicks; i++) {
      stepper.inc.click();
      await sleep(200);
    }
    await sleep(300);
  }

  await setStepper(adultStepper, adults, 1);
  await setStepper(childStepper, children, 0);

  // STEP 5: Fill child ages — retry up to 5x.
  if (children > 0 && Array.isArray(childAges) && childAges.length > 0) {
    let ageSelects = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      await sleep(800);
      ageSelects = Array.from(document.querySelectorAll("select")).filter(
        (s) => {
          const ctx = (
            (s.getAttribute("aria-label") || "") +
            " " +
            (s.getAttribute("name") || "") +
            " " +
            s.id +
            " " +
            (s.closest("div")?.innerText || "")
          ).toLowerCase();
          return ctx.includes("age") || s.options.length >= 10;
        }
      );
      console.log(
        "[TripProfile] Age selects attempt",
        attempt,
        ":",
        ageSelects.length
      );
      if (ageSelects.length >= children) break;
    }

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value"
    ).set;

    for (let i = 0; i < ageSelects.length; i++) {
      if (childAges[i] === undefined) continue;
      const select = ageSelects[i];
      const age = String(childAges[i]);
      nativeSetter?.call(select, age);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(200);
      console.log(
        "[TripProfile] Age",
        i,
        "→",
        age,
        "result:",
        select.value
      );
    }
  }

  // STEP 6: Close the picker.
  await sleep(400);
  const closeBtn = Array.from(container.querySelectorAll("button")).find((b) =>
    /^(done|apply|search|close)$/i.test(b.textContent.trim())
  );
  if (closeBtn) closeBtn.click();

  showToast(
    `Filled: ${adults} adults` +
      (children > 0
        ? `, ${children} children${
            Array.isArray(childAges) && childAges.length > 0
              ? ` (ages ${childAges.join(", ")})`
              : ""
          }`
        : "")
  );
  return true;
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
