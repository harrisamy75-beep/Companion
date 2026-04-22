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
async function universalFill(profile) {
  const { adults, children, childAges } = profile.autoFillPayload;
  const hostname = window.location.hostname;
  if (hostname.includes("booking.com")) return await bookingFill(adults, children, childAges);
  if (hostname.includes("expedia.com") || hostname.includes("hotels.com")) return await expediaFill(adults, children, childAges);
  return await universalFallbackFill(adults, children, childAges);
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

// ─── BOOKING.COM ───────────────────────────────────────────────────────────
async function bookingFill(adults, children, childAges) {
  console.log("[TripProfile] Booking.com path");

  const triggerSelectors = [
    '[data-testid="occupancy-config"]',
    '[data-testid="searchbox-people-picker-trigger"]',
    'button[aria-label*="occupancy" i]',
    'button[aria-label*="guest" i]',
    '[class*="occupancy"]',
  ];
  for (const sel of triggerSelectors) {
    const el = document.querySelector(sel);
    if (el) { el.click(); await sleep(1500); console.log("[TripProfile] Booking opened picker:", sel); break; }
  }

  // Wait for stepper buttons to appear — Booking renders them async.
  // Baseline is ~85 buttons on the homepage. Picker adds 6+ more.
  const baselineCount = document.querySelectorAll("button").length;
  console.log("[TripProfile] Booking baseline button count:", baselineCount);
  let pickerRendered = false;
  for (let attempt = 0; attempt < 16; attempt++) {
    const count = document.querySelectorAll("button").length;
    console.log("[TripProfile] Booking button count attempt", attempt, ":", count);
    if (count > baselineCount + 4) { pickerRendered = true; break; }
    await sleep(300);
  }
  console.log("[TripProfile] Booking picker rendered:", pickerRendered);

  let panel = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    panel =
      document.querySelector('[data-testid="occupancy-popup"]') ||
      document.querySelector('[data-testid="searchbox-people-picker"]') ||
      document.querySelector('[class*="occupancy-popup"]') ||
      document.querySelector('[class*="OccupancyPopup"]');
    if (panel) break;
    await sleep(500);
  }
  if (!panel) panel = await findPickerContainerGeneric();
  if (!panel) { showToast("Open the guest picker first, then try again"); return false; }

  console.log("[TripProfile] Booking panel:", panel.className?.slice(0, 60));

  // Dump all buttons in panel for diagnosis.
  const panelBtns = Array.from(panel.querySelectorAll("button"));
  console.log("[TripProfile] Booking panel buttons:", panelBtns.length,
    panelBtns.map(b => ({ aria: b.getAttribute("aria-label"), testid: b.getAttribute("data-testid"), txt: b.textContent.trim().slice(0, 10) }))
  );

  // Also dump all buttons in full document.
  const allBtns = Array.from(document.querySelectorAll("button"));
  console.log("[TripProfile] Booking all buttons:", allBtns.length,
    allBtns.map(b => ({ aria: b.getAttribute("aria-label"), testid: b.getAttribute("data-testid"), txt: b.textContent.trim().slice(0, 10) }))
  );

  const filledAdults = await bookingSetStepper(panel, /^adults?$/i, adults, 1);
  const filledChildren = await bookingSetStepper(panel, /^children$/i, children, 0);

  if (children > 0 && childAges?.length > 0) {
    await sleep(1200);
    let ageSelects = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      ageSelects = Array.from(document.querySelectorAll(
        '[data-testid*="age"] select,[data-testid*="child"] select,select[id*="age"],select[name*="age"],select[aria-label*="age" i],select[aria-label*="child" i]'
      ));
      if (ageSelects.length === 0) ageSelects = Array.from(panel.querySelectorAll("select"));
      console.log("[TripProfile] Booking age selects attempt", attempt, ":", ageSelects.length);
      if (ageSelects.length >= children) break;
      await sleep(600);
    }

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    for (let i = 0; i < ageSelects.length; i++) {
      if (childAges[i] === undefined) continue;
      const select = ageSelects[i];
      const age = String(childAges[i]);
      nativeSetter?.call(select, age);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(300);
      console.log("[TripProfile] Booking age", i, "set to:", age, "actual:", select.value);
    }
  }

  await sleep(400);
  const applyBtn =
    panel.querySelector('[data-testid="searchbox-people-picker-confirm-button"]') ||
    Array.from(panel.querySelectorAll("button")).find((b) => /^done$|^apply$|^search$|^ok$/i.test(b.textContent.trim()));
  if (applyBtn) { applyBtn.click(); console.log("[TripProfile] Booking closed panel"); }

  const success = filledAdults || filledChildren;
  if (success) {
    showToast(`Filled: ${adults} adults, ${children} children` + (childAges?.length > 0 ? `, ages ${childAges.join(", ")}` : ""));
  } else {
    showToast("Could not auto-fill — use the profile card to fill manually");
  }
  return success;
}

async function bookingSetStepper(panel, labelPattern, target, minimum) {
  const allBtns = Array.from(panel.querySelectorAll("button"));
  const decBtns = allBtns.filter((b) => {
    const aria = (b.getAttribute("aria-label") || "").toLowerCase();
    const txt = b.textContent.trim();
    const testid = (b.getAttribute("data-testid") || "").toLowerCase();
    return /decrease|minus|subtract|remove/i.test(aria) || txt === "−" || txt === "-" || /decrease|minus/.test(testid);
  });

  console.log("[TripProfile] Booking dec buttons found:", decBtns.length, decBtns.map(b => b.getAttribute("aria-label") || b.textContent.trim()));

  for (const dec of decBtns) {
    let row = dec.parentElement;
    for (let i = 0; i < 6; i++) {
      if (!row || row === panel) break;
      const rowText = row.innerText || row.textContent || "";
      if (labelPattern.test(rowText) && rowText.length < 80) {
        const rowBtns = Array.from(row.querySelectorAll("button"));
        const inc = rowBtns.find((b) => {
          const aria = (b.getAttribute("aria-label") || "").toLowerCase();
          const txt = b.textContent.trim();
          const testid = (b.getAttribute("data-testid") || "").toLowerCase();
          return /increase|plus|add/i.test(aria) || txt === "+" || /increase|plus/.test(testid);
        });
        if (inc) {
          console.log("[TripProfile] Booking stepper for", labelPattern, "dec:", dec.getAttribute("aria-label") || dec.textContent.trim(), "inc:", inc.getAttribute("aria-label") || inc.textContent.trim());
          for (let j = 0; j < 12; j++) { dec.click(); await sleep(80); }
          await sleep(350);
          for (let j = 0; j < Math.max(0, target - minimum); j++) { inc.click(); await sleep(350); }
          await sleep(300);
          return true;
        }
      }
      row = row.parentElement;
    }
  }

  console.log("[TripProfile] Booking stepper not found for", labelPattern);
  return false;
}

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
    if (el && !el.getAttribute("aria-expanded")) { el.click(); await sleep(800); console.log("[TripProfile] Opened picker with:", sel); break; }
  }

  const container = await findPickerContainerGeneric();
  if (!container) { showToast("Open the guest picker first, then try again"); return false; }

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

  const adultFilled = await fillStepper(adultStepper, adults, 1);
  const childFilled = await fillStepper(childStepper, children, 0);

  if (children > 0 && Array.isArray(childAges) && childAges.length > 0) {
    await sleep(1500);
    const allSelects = Array.from(document.querySelectorAll("select"));
    let ageSelects = allSelects.filter((s) => {
      const label = (s.getAttribute("aria-label") || s.getAttribute("name") || s.id || "").toLowerCase();
      const surrounding = s.closest("[class]")?.textContent?.toLowerCase() || "";
      return label.includes("age") || (surrounding.includes("child") && surrounding.includes("age"));
    });
    if (ageSelects.length === 0) {
      ageSelects = Array.from(document.querySelectorAll('[class*="child-age"] select,[data-stid*="age"] select,select[id*="age"],select[name*="age"]'));
    }
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    for (let i = 0; i < ageSelects.length; i++) {
      if (childAges[i] === undefined) continue;
      const select = ageSelects[i]; const age = String(childAges[i]);
      select.value = age; select.dispatchEvent(new Event("change", { bubbles: true })); await sleep(100);
      if (select.value !== age && nativeSetter) { nativeSetter.call(select, age); select.dispatchEvent(new Event("change", { bubbles: true })); }
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
    for (const el of allEls) {
      const text = el.innerText || "";
      if (/adults?/i.test(text) && /children|child/i.test(text)) {
        const bc = el.querySelectorAll("button").length;
        if (bc >= 2 && bc < 30) return el;
      }
    }
    await sleep(500);
  }
  return null;
}

async function attemptAutoFill({ manual = false } = {}) {
  console.log("[TripProfile] attemptAutoFill called, hostname:", window.location.hostname, "manual:", manual);
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const profile = result[STORAGE_KEY];
  if (!profile) { if (manual) showToast("No profile yet — open the extension and re-sync."); return false; }
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
  const loyalty = Array.isArray(profile.loyaltyPrograms) ? profile.loyaltyPrograms : [];
  const partyLine = `${adults} adult${adults !== 1 ? "s" : ""}` + (children > 0 ? ` · ${children} child${children !== 1 ? "ren" : ""}` : "");
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

  if (data.loyalty.length > 0) {
    const loyaltyTitle = document.createElement("div");
    loyaltyTitle.textContent = "Loyalty";
    Object.assign(loyaltyTitle.style, { fontSize:"9.5px",fontWeight:"600",letterSpacing:"0.16em",textTransform:"uppercase",color:"#A07840",marginTop:"6px",marginBottom:"5px",paddingTop:"8px",borderTop:"1px solid #E5E0D8" });
    body.appendChild(loyaltyTitle);
    data.loyalty.slice(0, 6).forEach((p) => {
      const row = document.createElement("div");
      Object.assign(row.style, { display:"flex",justifyContent:"space-between",gap:"8px",fontSize:"12px",color:"#1C1C1C",padding:"3px 0" });
      const lbl = document.createElement("span"); lbl.textContent = p.programName || p.brand || "Program"; lbl.style.fontWeight = "500";
      const num = document.createElement("span"); num.textContent = p.membershipNumber || "—";
      Object.assign(num.style, { fontFamily:"ui-monospace,'SF Mono',Menlo,monospace",fontSize:"11px",color:"#5C5248",userSelect:"all" });
      row.appendChild(lbl); row.appendChild(num); body.appendChild(row);
    });
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
      attemptAutoFill({ manual: true }).then((ok) => { try { sendResponse({ ok }); } catch (e) {} });
      return true;
    }
    if (msg?.type === "SHOW_PANEL") {
      showFloatingPanel().then((shown) => {
        attemptAutoFill({ manual: false }).catch(() => {});
        try { sendResponse({ ok: shown }); } catch (e) {}
      });
      return true;
    }
  } catch (err) { try { sendResponse({ ok: false, error: String(err) }); } catch (e) {} }
});
