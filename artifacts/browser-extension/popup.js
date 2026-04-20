const STORAGE_KEY = "tripprofile";
const KEY_KEY = "companion_api_key";

function formatSyncTime(isoString) {
  if (!isoString) return "Never synced";
  const d = new Date(isoString);
  return "Last synced: " + d.toLocaleString();
}

function buildClipboardPayload(profile) {
  if (!profile) return "";
  const { autoFillPayload, loyaltyPrograms } = profile;
  const adults = autoFillPayload?.adults ?? 0;
  const children = autoFillPayload?.children ?? 0;
  const childAges = Array.isArray(autoFillPayload?.childAges) ? autoFillPayload.childAges : [];

  const lines = [];
  lines.push(`Adults: ${adults}`);
  lines.push(`Children: ${children}`);
  if (childAges.length > 0) {
    lines.push(`Child ages: ${childAges.join(", ")}`);
  }

  if (Array.isArray(loyaltyPrograms) && loyaltyPrograms.length > 0) {
    const loyaltyStr = loyaltyPrograms
      .map((p) => {
        const num = p.membershipNumber ? ` ${p.membershipNumber}` : " [number]";
        return `${p.programName}${num}`;
      })
      .join(", ");
    lines.push(`Loyalty: ${loyaltyStr}`);
  }

  return lines.join("\n");
}

function renderProfile(profile) {
  if (!profile) {
    document.getElementById("traveler-count").textContent = "No profile yet";
    document.getElementById("children-detail").textContent = "";
    document.getElementById("loyalty-preview").textContent = "—";
    document.getElementById("sync-time").textContent = "Connect, then tap Re-sync";
    return;
  }

  const { family, preferences, loyaltyPrograms, _syncedAt } = profile;

  document.getElementById("traveler-count").textContent =
    `${family.travelerCount} traveler${family.travelerCount !== 1 ? "s" : ""}`;

  const childLines = family.children.map((c) => `${c.name} (${c.ageYears}y)`);
  document.getElementById("children-detail").textContent =
    childLines.length > 0 ? childLines.join(", ") : "No children added yet";

  const tagsEl = document.getElementById("style-tags");
  tagsEl.innerHTML = "";
  const tags = (preferences && (preferences.travelStyleTags || preferences.travelStyles)) || [];
  const formatTag = (s) =>
    String(s).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (tags.length === 0) {
    const span = document.createElement("span");
    span.style.cssText = "font-style: italic; color: #94A39B; font-size: 12px;";
    span.textContent = "Not set";
    tagsEl.appendChild(span);
  } else {
    const top3 = tags.slice(0, 3).map(formatTag).join(", ");
    const span = document.createElement("span");
    span.style.cssText = "font-size: 13px; color: #1C1C1C; font-weight: 500; line-height: 1.4;";
    span.textContent = top3;
    tagsEl.appendChild(span);
    if (tags.length > 3) {
      const more = document.createElement("span");
      more.style.cssText = "font-size: 11px; color: #5C5248; font-style: italic; margin-left: 6px;";
      more.textContent = `+${tags.length - 3} more`;
      tagsEl.appendChild(more);
    }
  }

  const loyaltyEl = document.getElementById("loyalty-preview");
  if (Array.isArray(loyaltyPrograms) && loyaltyPrograms.length > 0) {
    const top = loyaltyPrograms.slice(0, 3).map((p) => p.programName).join(", ");
    const more = loyaltyPrograms.length > 3 ? ` +${loyaltyPrograms.length - 3} more` : "";
    loyaltyEl.textContent = top + more;
  } else {
    loyaltyEl.textContent = "No loyalty programs added";
  }

  document.getElementById("sync-time").textContent = formatSyncTime(_syncedAt);
}

async function loadProfile() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

async function loadConnectionState() {
  const { [KEY_KEY]: key } = await chrome.storage.local.get(KEY_KEY);
  const statusEl = document.getElementById("connect-status");
  const clearBtn = document.getElementById("clear-key");
  if (key) {
    const masked = key.slice(0, 8) + "…" + key.slice(-4);
    statusEl.textContent = `Connected (${masked})`;
    statusEl.style.color = "#2D6A4F";
    clearBtn.classList.remove("hidden");
  } else {
    statusEl.textContent = "Not connected.";
    statusEl.style.color = "#5C5248";
    clearBtn.classList.add("hidden");
  }
}

function flashStatus(el, message, isError = false, ms = 3500) {
  el.textContent = message;
  el.classList.toggle("error", isError);
  setTimeout(() => {
    el.textContent = "";
    el.classList.remove("error");
  }, ms);
}

async function copyToClipboard(text) {
  // Prefer the modern API (works in popup since v3).
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback: hidden textarea + execCommand for older Chrome edge cases.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  let cachedProfile = await loadProfile();
  renderProfile(cachedProfile);
  await loadConnectionState();

  const resyncBtn = document.getElementById("resync");
  const showOnPageBtn = document.getElementById("show-on-page");
  const copyBtn = document.getElementById("copy-payload");
  const statusEl = document.getElementById("status");
  const copyStatusEl = document.getElementById("copy-status");
  const openSettingsBtn = document.getElementById("open-settings");
  const keyInput = document.getElementById("key-input");
  const saveKeyBtn = document.getElementById("save-key");
  const clearKeyBtn = document.getElementById("clear-key");
  const keyStatusEl = document.getElementById("key-status");

  openSettingsBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_SETTINGS" }, () => {
      window.close();
    });
  });

  saveKeyBtn.addEventListener("click", () => {
    const key = keyInput.value.trim();
    if (!key) {
      keyStatusEl.textContent = "Paste a key first.";
      keyStatusEl.classList.add("error");
      return;
    }
    saveKeyBtn.disabled = true;
    saveKeyBtn.textContent = "Saving…";
    chrome.runtime.sendMessage({ type: "SET_KEY", key }, async (response) => {
      saveKeyBtn.disabled = false;
      saveKeyBtn.textContent = "Save & Sync";
      if (response?.ok) {
        keyInput.value = "";
        keyStatusEl.textContent = "Connected. Profile synced.";
        keyStatusEl.classList.remove("error");
        await loadConnectionState();
        cachedProfile = await loadProfile();
        renderProfile(cachedProfile);
      } else if (response?.error === "invalid_key") {
        keyStatusEl.textContent = "Key should start with cpn_";
        keyStatusEl.classList.add("error");
      } else if (response?.error === "auth") {
        keyStatusEl.textContent = "Key rejected — get a fresh one.";
        keyStatusEl.classList.add("error");
      } else {
        keyStatusEl.textContent = "Couldn't save key — try again.";
        keyStatusEl.classList.add("error");
      }
    });
  });

  clearKeyBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_KEY" }, async () => {
      await loadConnectionState();
      keyStatusEl.textContent = "Disconnected.";
      keyStatusEl.classList.remove("error");
    });
  });

  // Primary action: copy formatted payload to clipboard.
  copyBtn.addEventListener("click", async () => {
    if (!cachedProfile) {
      flashStatus(copyStatusEl, "Sync your profile first.", true);
      return;
    }
    const text = buildClipboardPayload(cachedProfile);
    if (!text) {
      flashStatus(copyStatusEl, "Nothing to copy yet.", true);
      return;
    }
    copyBtn.disabled = true;
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copying…";
    const ok = await copyToClipboard(text);
    copyBtn.disabled = false;
    copyBtn.textContent = original;
    if (ok) {
      flashStatus(copyStatusEl, "Copied! Paste into any booking form.", false, 4000);
    } else {
      flashStatus(copyStatusEl, "Couldn't copy — try again.", true);
    }
  });

  // Secondary action: inject floating reference panel on the active tab.
  // Also asks the content script to attempt DOM auto-fill silently.
  showOnPageBtn.addEventListener("click", () => {
    showOnPageBtn.disabled = true;
    const originalLabel = showOnPageBtn.textContent;
    showOnPageBtn.textContent = "Loading…";
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) {
        showOnPageBtn.disabled = false;
        showOnPageBtn.textContent = originalLabel;
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "SHOW_PANEL" }, () => {
        showOnPageBtn.disabled = false;
        showOnPageBtn.textContent = originalLabel;
        if (chrome.runtime.lastError) {
          flashStatus(
            statusEl,
            "This page isn't supported. Try opening Booking, Expedia, an airline, or Airbnb.",
            true,
            4500
          );
          return;
        }
        window.close();
      });
    });
  });

  resyncBtn.addEventListener("click", () => {
    resyncBtn.disabled = true;
    resyncBtn.textContent = "Syncing…";
    statusEl.textContent = "";
    statusEl.classList.remove("error");

    chrome.runtime.sendMessage({ type: "RESYNC" }, async (response) => {
      if (response?.ok) {
        cachedProfile = await loadProfile();
        renderProfile(cachedProfile);
        flashStatus(statusEl, "Profile updated.", false, 3000);
      } else if (response?.error === "no_key") {
        flashStatus(statusEl, "Paste your API key above first.", true, 4000);
      } else if (response?.error === "auth") {
        flashStatus(statusEl, "Key rejected — get a fresh one.", true, 4000);
      } else if (response?.error === "no_profile") {
        flashStatus(statusEl, "No profile saved yet.", true, 4000);
      } else {
        flashStatus(statusEl, "Sync failed — check connection.", true, 4000);
      }
      resyncBtn.disabled = false;
      resyncBtn.textContent = "Re-sync profile";
    });
  });
});
