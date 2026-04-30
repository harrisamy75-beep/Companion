console.log("[TripProfile] Content script loaded on:", window.location.hostname);

const STORAGE_KEY = "tripprofile";

function showToast(message) {
  const existing = document.getElementById("tripprofile-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "tripprofile-toast";
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed", bottom: "24px", right: "24px", zIndex: "2147483647",
    background: "#1a56db", color: "#fff", padding: "10px 18px",
    borderRadius: "8px", fontSize: "14px", fontFamily: "system-ui, sans-serif",
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)", transition: "opacity 0.4s", opacity: "1",
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 400); }, 3000);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

const API_BASE = "https://travelcompaniontool.replit.app/api";

// ─── ROUTER ────────────────────────────────────────────────────────────────
// All site-specific fillers return { ok: boolean, mode: "autofill"|"manual"|"noop", code?: string }.
// `autofill` = the form was actually filled. `manual` = a reference panel was shown but the user
// still has to type. `noop` = nothing happened (unsupported page, missing trigger).
function asResult(value, fallbackMode) {
  if (value && typeof value === "object" && "ok" in value) return value;
  return { ok: !!value, mode: fallbackMode || "autofill" };
}

async function universalFill(profile) {
  const { adults, children, childAges } = profile.autoFillPayload;
  const hostname = window.location.hostname;
  if (hostname.includes("booking.com")) {
    // Booking.com renders the occupancy picker in a way content scripts cannot reach.
    // Show the floating reference panel so the user can fill manually.
    console.log("[TripProfile] Booking.com — showing reference panel (auto-fill not supported)");
    injectFloatingPanel(profile);
    showToast("Booking.com auto-fill isn't supported — use the reference panel to fill manually");
    return { ok: true, mode: "manual", code: "BOOKING_REFERENCE_PANEL" };
  }
  if (hostname.includes("tripadvisor.com")) return asResult(await tripAdvisorFill(adults, children, childAges));
  if (hostname.includes("expedia.com") || hostname.includes("hotels.com")) return asResult(await expediaFill(adults, children, childAges));
  return asResult(await universalFallbackFill(adults, children, childAges));
}

// ─── TRIPADVISOR ───────────────────────────────────────────────────────────
async function tripAdvisorFill(adults, children, childAges) {
  console.log("[TripProfile] TripAdvisor path");
  showToast("Filling TripAdvisor — opening guest picker…");

  // Detect whether the picker is already open — broaden across aria phrasing
  // ("decrease/decrement/less/minus/remove/subtract"), generic +/- icon
  // buttons next to an adults label, or a visible dialog/listbox.
  const isPickerOpen = () => {
    if (
      document.querySelector(
        'button[aria-label*="adult" i][aria-label*="less" i], ' +
        'button[aria-label*="adult" i][aria-label*="decrease" i], ' +
        'button[aria-label*="adult" i][aria-label*="decrement" i], ' +
        'button[aria-label*="adult" i][aria-label*="minus" i], ' +
        'button[aria-label*="adult" i][aria-label*="remove" i], ' +
        'button[aria-label*="adult" i][aria-label*="subtract" i], ' +
        'button[aria-label*="decrease" i][aria-label*="adult" i], ' +
        'button[aria-label*="remove" i][aria-label*="adult" i]'
      )
    ) return true;
    // Fallback: open dialog with the word "adults" in it.
    const dialog = document.querySelector('[role="dialog"], [role="listbox"]');
    if (dialog && /adult/i.test(dialog.textContent || "")) return true;
    return false;
  };

  // If the picker isn't open yet, find a narrow, safe trigger and open it.
  // We deliberately avoid catch-all selectors like aria-label*="travel",
  // which match unrelated nav controls and cause unintended navigation.
  if (!isPickerOpen()) {
    const triggerSelectors = [
      'button[data-test-target*="ROOMS" i]',
      'button[data-test-target*="GUESTS" i]',
      'button[data-test-target*="OCCUPANCY" i]',
      'button[data-automation*="rooms" i]',
      'button[data-automation*="guests" i]',
      'button[data-automation*="occupancy" i]',
      'button[aria-label*="rooms" i]',
      'button[aria-label*="guest" i]',
      'button[aria-label*="occupancy" i]',
    ];
    for (const sel of triggerSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        console.log("[TripProfile] TripAdvisor opening picker via selector:", sel);
        el.click();
        await sleep(700);
        if (isPickerOpen()) break;
      }
    }
    // Fallback: any button whose visible text reads like a guests/rooms
    // summary (e.g. "1 Room, 2 Adults", "2 Guests"). Skip nav-like buttons.
    if (!isPickerOpen()) {
      const candidate = Array.from(document.querySelectorAll("button")).find((b) => {
        const txt = (b.textContent || "").trim();
        if (!txt || txt.length > 40) return false;
        // Must mention rooms/guests/adults with a number.
        if (!/\b\d+\s*(rooms?|guests?|adults?)\b/i.test(txt)) return false;
        // Skip obvious nav/footer.
        if (b.closest("nav, footer, header[role='banner']")) return false;
        return true;
      });
      if (candidate) {
        console.log("[TripProfile] TripAdvisor opening picker via text-match:", candidate.textContent.trim().slice(0, 30));
        candidate.click();
        await sleep(800);
      }
    }
  }

  // Find scoped picker container (case-insensitive aria match)
  const container = await findPickerContainerGeneric();

  function findStepperBtns(scope) {
    const btns = Array.from(scope.querySelectorAll("button[aria-label]"));
    const aria = (b) => b.getAttribute("aria-label") || "";
    return {
      adultDec: btns.find((b) => {
        const a = aria(b);
        return /adult.*less|less.*adult/i.test(a) ||
               /adult.*(decrease|decrement|minus|remove|-)/i.test(a) ||
               /decrease.*adult|minus.*adult|remove.*adult/i.test(a);
      }),
      adultInc: btns.find((b) => {
        const a = aria(b);
        return /adult.*more|more.*adult/i.test(a) ||
               /adult.*(increase|increment|plus|add|\+)/i.test(a) ||
               /increase.*adult|plus.*adult|add.*adult/i.test(a);
      }),
      childDec: btns.find((b) => {
        const a = aria(b);
        return /child.*less|less.*child/i.test(a) ||
               /child.*(decrease|decrement|minus|remove)/i.test(a) ||
               /decrease.*child|minus.*child|remove.*child/i.test(a);
      }),
      childInc: btns.find((b) => {
        const a = aria(b);
        return /child.*more|more.*child/i.test(a) ||
               /child.*(increase|increment|plus|add)/i.test(a) ||
               /increase.*child|plus.*child|add.*child/i.test(a);
      }),
    };
  }

  let steppers = { adultDec: null, adultInc: null, childDec: null, childInc: null };
  for (let attempt = 0; attempt < 10; attempt++) {
    const scope = container || document;
    steppers = findStepperBtns(scope);
    if (steppers.adultDec && steppers.adultInc) break;
    await sleep(400);
    console.log("[TripProfile] TripAdvisor waiting for steppers, attempt:", attempt);
  }

  if (!steppers.adultDec || !steppers.adultInc) {
    console.warn("[TripProfile] TripAdvisor: stepper buttons not found after retries — falling back to reference panel");
    // No picker on this page (often true on hotel listing pages). Show the
    // floating reference panel so the user always gets value from clicking Fill.
    try {
      const r = await chrome.storage.local.get(STORAGE_KEY);
      const p = r[STORAGE_KEY];
      if (p) injectFloatingPanel(p);
    } catch (e) { console.warn("[TripProfile] panel fallback failed:", e); }
    showToast("No guest picker on this page — use the reference panel to fill it manually.");
    return { ok: true, mode: "manual", code: "TA_NO_STEPPERS_PANEL_SHOWN" };
  }

  console.log("[TripProfile] TripAdvisor steppers found, filling...");

  for (let i = 0; i < 10; i++) { steppers.adultDec.click(); await sleep(80); }
  await sleep(300);
  for (let i = 1; i < adults; i++) { steppers.adultInc.click(); await sleep(200); }
  await sleep(300);

  let childrenFilled = true;
  let childStepperMissing = false;
  if (children > 0) {
    // Child stepper may mount only after adults are filled / picker fully expanded.
    // Re-query the whole document with a tighter, TripAdvisor-specific match.
    if (!steppers.childDec || !steppers.childInc) {
      await sleep(500);
      for (let attempt = 0; attempt < 5; attempt++) {
        const freshBtns = Array.from(document.querySelectorAll("button[aria-label]"));
        steppers.childDec = freshBtns.find((b) =>
          /Set child count to one less/i.test(b.getAttribute("aria-label") || "")
        );
        steppers.childInc = freshBtns.find((b) =>
          /Set child count to one more/i.test(b.getAttribute("aria-label") || "")
        );
        if (steppers.childDec && steppers.childInc) break;
        await sleep(400);
        console.log(
          "[TripProfile] TripAdvisor child stepper retry",
          attempt,
          "dec:",
          !!steppers.childDec,
          "inc:",
          !!steppers.childInc
        );
      }
      // Fall back to the broader synonym matcher if the specific labels still miss.
      if (!steppers.childDec || !steppers.childInc) {
        const fallback = findStepperBtns(document);
        steppers.childDec = steppers.childDec || fallback.childDec;
        steppers.childInc = steppers.childInc || fallback.childInc;
      }
    }

    if (!steppers.childDec || !steppers.childInc) {
      childrenFilled = false;
      childStepperMissing = true;
      const allLabels = Array.from(document.querySelectorAll("button[aria-label]"))
        .map((b) => b.getAttribute("aria-label"))
        .filter(Boolean);
      console.log(
        "[TripProfile] TripAdvisor: child stepper pair missing — all button aria-labels in DOM:",
        allLabels
      );
    } else {
      for (let i = 0; i < 10; i++) { steppers.childDec.click(); await sleep(80); }
      await sleep(300);
      for (let i = 0; i < children; i++) { steppers.childInc.click(); await sleep(300); }
      await sleep(500);
    }
  }

  let agesFilled = true;
  if (children > 0 && childrenFilled && Array.isArray(childAges) && childAges.length > 0) {
    await sleep(800);
    const ageScope = container || document;
    let ageSelects = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      ageSelects = Array.from(ageScope.querySelectorAll(
        'select[aria-label*="age" i],select[aria-label*="child" i],select[id*="age"],select[name*="age"]'
      ));
      console.log("[TripProfile] TripAdvisor age selects:", ageSelects.length);
      if (ageSelects.length >= children) break;
      await sleep(500);
    }
    if (ageSelects.length < children) agesFilled = false;
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    for (let i = 0; i < Math.min(ageSelects.length, childAges.length); i++) {
      if (childAges[i] === undefined) continue;
      nativeSetter?.call(ageSelects[i], String(childAges[i]));
      ageSelects[i].dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(200);
    }
  }

  const fullSuccess = childrenFilled && agesFilled;

  // Always click Update if adults were filled — saves at least the adult count.
  await sleep(300);
  const closeScope = container || document;
  const updateBtn = Array.from(closeScope.querySelectorAll("button")).find((b) =>
    /^update$|^done$|^apply$/i.test(b.textContent.trim())
  );
  if (updateBtn) { updateBtn.click(); console.log("[TripProfile] TripAdvisor clicked Update"); }

  if (fullSuccess) {
    showToast(`Filled: ${adults} adults, ${children} children` +
      (Array.isArray(childAges) && childAges.length > 0 ? `, ages ${childAges.join(", ")}` : ""));
  } else if (childStepperMissing) {
    showToast("Adults filled — child stepper not found, please set manually.");
  } else {
    showToast("Partially filled — finish in the picker manually");
  }
  return fullSuccess;
}

// ─── EXPEDIA + HOTELS.COM ──────────────────────────────────────────────────
async function expediaFill(adults, children, childAges) {
  const trigger =
    document.querySelector('[data-stid="open-room-picker"]') ||
    document.querySelector('[data-stid="open-hotel-guest-picker"]') ||
    document.querySelector('[id*="traveler"]') ||
    document.querySelector('[data-testid="travelers-field"]');
  if (trigger) { trigger.click(); await sleep(900); }

  let container =
    document.querySelector('[data-stid="rooms-traveler-selector-menu-container"]') ||
    document.querySelector('[data-stid="traveler-selector-menu-container"]');
  if (!container) container = await findPickerContainerGeneric();
  if (!container) { showToast("Open the guest picker first, then try again"); return false; }

  console.log("[TripProfile] Expedia/Hotels container:", container.className?.slice(0, 60));

  let allBtns = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    allBtns = Array.from(container.querySelectorAll("button"));
    if (allBtns.length >= 4) break;
    await sleep(400);
  }

  const btns = allBtns.filter((b) => {
    const txt = b.textContent.trim().toLowerCase();
    const aria = (b.getAttribute("aria-label") || "").toLowerCase();
    if (txt === "done" || aria === "done") return false;
    if (txt.includes("add another") || aria.includes("add another")) return false;
    if (txt === "remove room" || aria === "remove room") return false;
    return true;
  });

  console.log("[TripProfile] Expedia/Hotels buttons:", btns.map((b) => b.getAttribute("aria-label") || b.textContent.trim().slice(0, 15)));

  if (btns.length < 4) return await universalFallbackFill(adults, children, childAges);

  // adultDec, adultInc, childDec, childInc
  for (let i = 0; i < 10; i++) { btns[0].click(); await sleep(80); }
  await sleep(400);
  for (let i = 1; i < adults; i++) { btns[1].click(); await sleep(400); }
  await sleep(300);
  for (let i = 0; i < 10; i++) { btns[2].click(); await sleep(80); }
  await sleep(400);
  for (let i = 0; i < children; i++) { btns[3].click(); await sleep(500); }

  // Wait for age dropdowns — Hotels.com renders these more slowly than Expedia.
  await sleep(2000);

  let ageSelects = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const all = Array.from(document.querySelectorAll("select"));
    ageSelects = all.filter((s) => {
      const label = (s.getAttribute("aria-label") || s.getAttribute("name") || s.id || "").toLowerCase();
      const surrounding = s.closest("[class]")?.textContent?.toLowerCase() || "";
      return label.includes("age") || (surrounding.includes("child") && surrounding.includes("age"));
    });
    if (ageSelects.length === 0) {
      ageSelects = Array.from(document.querySelectorAll(
        '[class*="child-age"] select,[data-stid*="age"] select,select[id*="age"],select[name*="age"],[class*="ChildAge"] select,[data-testid*="child-age"] select'
      ));
    }
    console.log("[TripProfile] Age selects attempt", attempt, ":", ageSelects.length, ageSelects.map((s) => s.id || s.getAttribute("aria-label") || s.name));
    if (ageSelects.length >= children) break;
    await sleep(700);
  }

  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
  for (let i = 0; i < ageSelects.length; i++) {
    if (childAges?.[i] === undefined) continue;
    const select = ageSelects[i];
    const age = String(childAges[i]);
    nativeSetter?.call(select, age);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(300);
    console.log("[TripProfile] Age", i, "set to:", age, "actual:", select.value);
  }

  const doneBtn = Array.from(container.querySelectorAll("button")).find((b) => /^done$/i.test(b.textContent.trim()));
  if (doneBtn) { await sleep(300); doneBtn.click(); }

  showToast(`Filled: ${adults} adults, ${children} children` + (childAges?.length > 0 ? `, ages ${childAges.join(", ")}` : ""));
  return true;
}

// Booking.com auto-fill removed — the router shows the floating reference panel
// instead because the occupancy picker is unreachable from content scripts.

// ─── UNIVERSAL FALLBACK ────────────────────────────────────────────────────
async function universalFallbackFill(adults, children, childAges) {
  const triggerSelectors = [
    '[data-stid="open-room-picker"]','[data-testid="occupancy-config"]','[data-testid="travelers-field"]',
    'button[aria-label*="traveler" i]','button[aria-label*="guest" i]','button[aria-label*="passenger" i]',
    'button[aria-label*="occupancy" i]','[class*="traveler-selector"]','[class*="guest-picker"]',
    '[class*="occupancy"]','[class*="pax-selector"]','[id*="traveler"]','[id*="guest"]',
  ];
  for (const sel of triggerSelectors) {
    const el = document.querySelector(sel);
    if (el && el.getAttribute("aria-expanded") !== "true") {
      el.click();
      await sleep(800);
      console.log("[TripProfile] Opened picker with:", sel);
      break;
    }
  }

  const container = await findPickerContainerGeneric();
  if (!container) { showToast("Open the guest picker first, then try again"); return false; }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function controlText(el) {
    const labelledBy = el.getAttribute("aria-labelledby");
    const labelledText = labelledBy
      ? labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.innerText || "")
          .join(" ")
      : "";
    const explicitLabel = el.id
      ? Array.from(document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`))
          .map((label) => label.innerText || "")
          .join(" ")
      : "";
    const nearby = el.closest("label,[role='group'],[class*='row'],[class*='field'],[class*='guest'],[class*='traveler']")?.innerText || "";
    return normalizeText([
      el.getAttribute("aria-label"),
      el.getAttribute("name"),
      el.id,
      labelledText,
      explicitLabel,
      nearby,
    ].filter(Boolean).join(" "));
  }

  function findStepperNearLabel(root, labelPattern) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (!labelPattern.test(text) || text.length > 20) continue;
      let el = node.parentElement;
      for (let i = 0; i < 4; i++) {
        if (!el || el === root) break;
        const btns = Array.from(el.querySelectorAll("button")).filter((b) => {
          const txt = b.textContent.trim().toLowerCase();
          if (["done","close","apply","search","cancel","ok","add another room","add another","save","update"].includes(txt)) return false;
          if (txt.length >= 20 || txt === "remove room") return false;
          const aria = b.getAttribute("aria-label") || "";
          const cls = typeof b.className === "string" ? b.className : "";
          return /increase|decrease|add|remove|plus|minus/i.test(aria) || /^[+\-−]$/.test(b.textContent.trim()) || /increment|decrement|stepper|increase|decrease|step-input/i.test(cls) || cls.includes("uitk-step");
        });
        if (btns.length >= 2) return { decrease: btns[0], increase: btns[btns.length - 1], label: text };
        el = el.parentElement;
      }
    }
    return null;
  }

  function setNativeValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, "value")?.set;
    if (setter) setter.call(input, String(value));
    else input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function fillNumberInput(labelPattern, value) {
    const inputs = Array.from(container.querySelectorAll('input[type="number"],input[inputmode="numeric"],input[aria-label],input[name],input[id]'));
    const input = inputs.find((el) => labelPattern.test(controlText(el)));
    if (!input) return false;
    setNativeValue(input, value);
    await sleep(150);
    return true;
  }

  const adultStepper = findStepperNearLabel(container, /^adults?$/i);
  const childStepper = findStepperNearLabel(container, /^children$|^child$/i);

  async function fillStepper(stepper, targetCount, minimum = 0) {
    if (!stepper) return false;
    for (let i = 0; i < 10; i++) { stepper.decrease.click(); await sleep(50); }
    await sleep(300);
    for (let i = 0; i < Math.max(0, targetCount - minimum); i++) { stepper.increase.click(); await sleep(100); }
    await sleep(300);
    return true;
  }

  const adultFilled = await fillStepper(adultStepper, adults, 1) || await fillNumberInput(/\badults?\b/, adults);
  const childFilled = await fillStepper(childStepper, children, 0) || await fillNumberInput(/\bchildren\b|\bchild\b|\bkids?\b/, children);

  if (children > 0 && Array.isArray(childAges) && childAges.length > 0) {
    await sleep(1500);
    const allSelects = Array.from(document.querySelectorAll("select"));
    let ageSelects = allSelects.filter((s) => {
      const label = controlText(s);
      const surrounding = s.closest("[class]")?.textContent?.toLowerCase() || "";
      return label.includes("age") || (surrounding.includes("child") && surrounding.includes("age"));
    });
    if (ageSelects.length === 0) {
      ageSelects = Array.from(document.querySelectorAll('[class*="child-age"] select,[data-stid*="age"] select,select[id*="age"],select[name*="age"]'));
    }
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    for (let i = 0; i < Math.min(ageSelects.length, childAges.length); i++) {
      if (childAges[i] === undefined) continue;
      const select = ageSelects[i]; const age = String(childAges[i]);
      const matchingOption = Array.from(select.options || []).find((option) =>
        option.value === age || normalizeText(option.textContent).startsWith(age)
      );
      const value = matchingOption?.value ?? age;
      select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); await sleep(100);
      if (select.value !== value && nativeSetter) { nativeSetter.call(select, value); select.dispatchEvent(new Event("change", { bubbles: true })); }
      await sleep(150);
    }
  }

  await sleep(400);
  const closeButton = Array.from(container.querySelectorAll("button")).find((b) => /^done$|^apply$|^search$|^close$/i.test(b.textContent.trim()));
  if (closeButton) closeButton.click();

  const success = adultFilled || childFilled;
  showToast(success
    ? `Filled: ${adults} adults, ${children} children` + (Array.isArray(childAges) && childAges.length > 0 ? `, ages ${childAges.join(", ")}` : "")
    : "Could not auto-fill — use the profile card to fill manually"
  );
  return success;
}

async function findPickerContainerGeneric() {
  for (let attempt = 0; attempt < 4; attempt++) {
    const allEls = Array.from(document.querySelectorAll('div,section,form,[role="dialog"],[role="listbox"]'));
    const candidates = [];
    for (const el of allEls) {
      const text = el.innerText || "";
      if (/adults?/i.test(text) && /children|child/i.test(text)) {
        const bc = el.querySelectorAll("button").length;
        const ic = el.querySelectorAll("input,select").length;
        if ((bc >= 2 || ic >= 2) && bc < 30) candidates.push(el);
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return ar.width * ar.height - br.width * br.height;
      });
      return candidates[0];
    }
    await sleep(500);
  }
  return null;
}

async function attemptAutoFill({ manual = false } = {}) {
  console.log("[TripProfile] attemptAutoFill called, hostname:", window.location.hostname, "manual:", manual);
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const profile = result[STORAGE_KEY];
  if (!profile) {
    if (manual) showToast("No profile yet — open the extension and re-sync.");
    return { ok: false, mode: "noop", code: "NO_PROFILE" };
  }
  if (!profile.autoFillPayload) {
    console.warn("[TripProfile] profile present but autoFillPayload missing", profile);
    if (manual) showToast("Your profile is missing traveler counts — re-sync from the extension popup.");
    return { ok: false, mode: "noop", code: "NO_AUTOFILL_PAYLOAD" };
  }
  console.log("[TripProfile] profile loaded, adults=", profile.autoFillPayload.adults, "children=", profile.autoFillPayload.children);
  return universalFill(profile);
}

async function run() {
  await attemptAutoFill({ manual: false });
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const profile = result[STORAGE_KEY];
  if (profile) await scoreAndBadgeReviews(profile);
}

// ─── Floating panel ────────────────────────────────────────────────────────
const PANEL_ID = "tripprofile-floating-panel";

function buildPanelLines(profile) {
  if (!profile) return null;
  const af = profile.autoFillPayload || {};
  const adults = af.adults ?? 0; const children = af.children ?? 0;
  const childAges = Array.isArray(af.childAges) ? af.childAges : [];
  const partyLine = `${adults} adult${adults !== 1 ? "s" : ""}` + (children > 0 ? ` · ${children} child${children !== 1 ? "ren" : ""}` : "");
  const ageLine = childAges.length > 0 ? `Ages: ${childAges.join(", ")}` : null;
  return { partyLine, ageLine };
}

function injectFloatingPanel(profile) {
  const existing = document.getElementById(PANEL_ID);
  if (existing) existing.remove();
  const data = buildPanelLines(profile);
  if (!data) return false;

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  Object.assign(panel.style, { position:"fixed",top:"16px",right:"16px",zIndex:"2147483647",width:"280px",background:"#FAFAF8",border:"1px solid #E5E0D8",borderRadius:"6px",boxShadow:"0 8px 24px rgba(0,0,0,0.18)",fontFamily:"system-ui, -apple-system, sans-serif",color:"#1C1C1C",overflow:"hidden" });

  const header = document.createElement("div");
  Object.assign(header.style, { background:"#6B2737",color:"#fff",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between" });
  const title = document.createElement("div");
  title.textContent = "Companion";
  Object.assign(title.style, { fontFamily:"'Playfair Display', Georgia, serif",fontStyle:"italic",fontSize:"16px",fontWeight:"400" });
  const closeBtn = document.createElement("button");
  closeBtn.setAttribute("aria-label","Close"); closeBtn.textContent = "×";
  Object.assign(closeBtn.style, { background:"transparent",border:"none",color:"#fff",fontSize:"20px",lineHeight:"1",cursor:"pointer",padding:"0 4px" });
  closeBtn.addEventListener("click", () => panel.remove());
  header.appendChild(title); header.appendChild(closeBtn); panel.appendChild(header);

  const body = document.createElement("div");
  Object.assign(body.style, { padding:"12px 14px 14px" });

  const partyEl = document.createElement("div");
  partyEl.textContent = data.partyLine;
  Object.assign(partyEl.style, { fontSize:"14px",fontWeight:"600",color:"#1C1C1C",marginBottom:data.ageLine?"2px":"10px" });
  body.appendChild(partyEl);

  if (data.ageLine) {
    const ageEl = document.createElement("div");
    ageEl.textContent = data.ageLine;
    Object.assign(ageEl.style, { fontSize:"12.5px",color:"#5C5248",marginBottom:"10px" });
    body.appendChild(ageEl);
  }

  const footer = document.createElement("div");
  footer.textContent = "Reference while you fill the form";
  Object.assign(footer.style, { marginTop:"10px",paddingTop:"8px",borderTop:"1px solid #E5E0D8",fontFamily:"'Playfair Display', Georgia, serif",fontStyle:"italic",fontSize:"11.5px",color:"#94A39B",textAlign:"center" });
  body.appendChild(footer);
  panel.appendChild(body);
  document.body.appendChild(panel);
  return true;
}

async function showFloatingPanel() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const profile = result[STORAGE_KEY];
  if (!profile) { showToast("Sync your Companion profile first."); return false; }
  return injectFloatingPanel(profile);
}

// ─── Review badging ────────────────────────────────────────────────────────
function detectSource(hostname) {
  if (hostname.includes("google.com")) return "google";
  return "google";
}

async function scoreAndBadgeReviews(profile) {
  const reviewEls = document.querySelectorAll("[data-review-text],.review-text,.reviewText,.bui-review-badge__description,.reviews-text");
  if (!reviewEls.length) return;
  const reviews = Array.from(reviewEls).map((el) => el.textContent.trim());
  const propertyId = encodeURIComponent(window.location.pathname + window.location.search);
  const source = detectSource(window.location.hostname);
  let scored;
  try {
    const resp = await fetch(`${API_BASE}/reviews/score`, { method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({propertyId,source,reviews}) });
    if (!resp.ok) return;
    scored = await resp.json();
  } catch { return; }
  reviewEls.forEach((el, i) => {
    const score = scored[i]; if (!score) return;
    const topTags = (score.tags || []).slice(0, 2);
    const badge = document.createElement("span");
    badge.textContent = `★ ${score.luxuryValueScore}/10${topTags.length ? " · " + topTags.join(", ") : ""}`;
    Object.assign(badge.style, { display:"inline-block",marginLeft:"8px",background:"#eff6ff",border:"1px solid #93c5fd",color:"#1d4ed8",borderRadius:"4px",padding:"2px 7px",fontSize:"12px",fontFamily:"system-ui, sans-serif",verticalAlign:"middle" });
    el.insertAdjacentElement("afterend", badge);
  });
}

// ─── Message listener ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log("[TripProfile] Message received:", msg && msg.type);
  try {
    if (msg?.type === "MANUAL_FILL") {
      attemptAutoFill({ manual: true })
        .then((result) => {
          // Normalize: legacy boolean → object.
          const payload =
            result && typeof result === "object" && "ok" in result
              ? result
              : { ok: !!result, mode: result ? "autofill" : "noop" };
          console.log("[TripProfile] MANUAL_FILL result:", payload);
          try { sendResponse(payload); } catch (e) {}
        })
        .catch((err) => {
          console.error("[TripProfile] MANUAL_FILL threw:", err);
          try {
            sendResponse({
              ok: false,
              mode: "noop",
              code: "FILL_THREW",
              error: (err && err.message) || String(err),
            });
          } catch (e) {}
        });
      return true;
    }
    if (msg?.type === "SHOW_PANEL") {
      showFloatingPanel().then((shown) => {
        attemptAutoFill({ manual: false }).catch(() => {});
        try { sendResponse({ ok: shown }); } catch (e) {}
      });
      return true;
    }
  } catch (err) {
    console.error("[TripProfile] listener threw:", err);
    try { sendResponse({ ok: false, mode: "noop", code: "LISTENER_THREW", error: String(err) }); } catch (e) {}
  }
});
