const STORAGE_KEY = "tripprofile";
const TOKEN_KEY = "tripprofile_token";

function formatSyncTime(isoString) {
  if (!isoString) return "Never synced";
  const d = new Date(isoString);
  return "Last synced: " + d.toLocaleString();
}

function renderProfile(profile) {
  if (!profile) {
    document.getElementById("traveler-count").textContent = "No profile yet";
    document.getElementById("children-detail").textContent = "";
    document.getElementById("autofill-preview").textContent = "—";
    document.getElementById("sync-time").textContent = "Connect the extension, then tap Re-sync";
    return;
  }

  const { family, preferences, autoFillPayload, _syncedAt } = profile;

  document.getElementById("traveler-count").textContent =
    `${family.travelerCount} traveler${family.travelerCount !== 1 ? "s" : ""}`;

  const childLines = family.children.map((c) => `${c.name} (${c.ageYears}y)`);
  document.getElementById("children-detail").textContent =
    childLines.length > 0 ? childLines.join(", ") : "No children added yet";

  const tagsEl = document.getElementById("style-tags");
  tagsEl.innerHTML = "";
  const tags = (preferences && (preferences.travelStyleTags || preferences.travelStyles)) || [];
  const formatTag = (s) =>
    String(s)
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
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

  const { adults, children, childAges } = autoFillPayload;
  const agesStr = childAges.length > 0 ? `, ages ${childAges.join(", ")}` : "";
  document.getElementById("autofill-preview").textContent =
    `${adults} adult${adults !== 1 ? "s" : ""}, ${children} child${children !== 1 ? "ren" : ""}${agesStr}`;

  document.getElementById("sync-time").textContent = formatSyncTime(_syncedAt);
}

async function loadProfile() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  renderProfile(result[STORAGE_KEY] || null);
}

async function loadConnectionState() {
  const { [TOKEN_KEY]: token } = await chrome.storage.local.get(TOKEN_KEY);
  const statusEl = document.getElementById("connect-status");
  const clearBtn = document.getElementById("clear-token");
  if (token) {
    statusEl.textContent = "Connected — token stored locally.";
    statusEl.style.color = "#2D6A4F";
    clearBtn.classList.remove("hidden");
  } else {
    statusEl.textContent = "Not connected.";
    statusEl.style.color = "#5C5248";
    clearBtn.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadProfile();
  await loadConnectionState();

  const resyncBtn = document.getElementById("resync");
  const fillBtn = document.getElementById("fill-page");
  const statusEl = document.getElementById("status");
  const signinBanner = document.getElementById("signin-banner");
  const openConnectBtn = document.getElementById("open-connect");
  const tokenInput = document.getElementById("token-input");
  const saveTokenBtn = document.getElementById("save-token");
  const clearTokenBtn = document.getElementById("clear-token");

  openConnectBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_CONNECT" }, () => {
      window.close();
    });
  });

  saveTokenBtn.addEventListener("click", () => {
    const token = tokenInput.value.trim();
    if (!token) {
      statusEl.textContent = "Paste a token first.";
      statusEl.classList.add("error");
      return;
    }
    saveTokenBtn.disabled = true;
    saveTokenBtn.textContent = "Saving…";
    chrome.runtime.sendMessage({ type: "SET_TOKEN", token }, async (response) => {
      saveTokenBtn.disabled = false;
      saveTokenBtn.textContent = "Save token";
      if (response?.ok) {
        tokenInput.value = "";
        statusEl.textContent = "Connected. Profile synced.";
        statusEl.classList.remove("error");
        signinBanner.classList.add("hidden");
        await loadConnectionState();
        await loadProfile();
      } else if (response?.error === "invalid_token") {
        statusEl.textContent = "That doesn't look like a valid token.";
        statusEl.classList.add("error");
      } else if (response?.error === "auth") {
        statusEl.textContent = "Token rejected — get a fresh one.";
        statusEl.classList.add("error");
      } else {
        statusEl.textContent = "Couldn't save token — try again.";
        statusEl.classList.add("error");
      }
    });
  });

  clearTokenBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" }, async () => {
      await loadConnectionState();
      statusEl.textContent = "Disconnected.";
      statusEl.classList.remove("error");
    });
  });

  fillBtn.addEventListener("click", () => {
    fillBtn.disabled = true;
    const originalLabel = fillBtn.textContent;
    fillBtn.textContent = "Filling…";
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) {
        fillBtn.disabled = false;
        fillBtn.textContent = originalLabel;
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "MANUAL_FILL" }, () => {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "Open a supported travel site first.";
          statusEl.classList.add("error");
          setTimeout(() => {
            statusEl.textContent = "";
            statusEl.classList.remove("error");
          }, 3500);
        }
        fillBtn.disabled = false;
        fillBtn.textContent = originalLabel;
        window.close();
      });
    });
  });

  resyncBtn.addEventListener("click", () => {
    resyncBtn.disabled = true;
    resyncBtn.textContent = "Syncing…";
    statusEl.textContent = "";
    statusEl.classList.remove("error");
    signinBanner.classList.add("hidden");

    chrome.runtime.sendMessage({ type: "RESYNC" }, (response) => {
      if (response?.ok) {
        statusEl.textContent = "Profile updated.";
        loadProfile();
      } else if (response?.error === "auth") {
        statusEl.textContent = "Connect the extension first.";
        statusEl.classList.add("error");
        signinBanner.classList.remove("hidden");
      } else if (response?.error === "no_profile") {
        statusEl.textContent = "No profile saved yet.";
        statusEl.classList.add("error");
      } else {
        statusEl.textContent = "Sync failed — check connection.";
        statusEl.classList.add("error");
      }
      resyncBtn.disabled = false;
      resyncBtn.textContent = "Re-sync profile";
      setTimeout(() => {
        statusEl.textContent = "";
        statusEl.classList.remove("error");
      }, 4000);
    });
  });
});
