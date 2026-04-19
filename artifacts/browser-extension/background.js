const STORAGE_KEY = "tripprofile";
const API_BASE = "https://travelcompaniontool.replit.app/api";
const APP_URL = "https://travelcompaniontool.replit.app";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text });
    if (color) await chrome.action.setBadgeBackgroundColor({ color });
  } catch {
    /* noop */
  }
}

async function fetchAndStore() {
  try {
    const response = await fetch(`${API_BASE}/summary`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 401 || response.status === 403) {
      console.warn("[TripProfile] Not signed in to Companion");
      await setBadge("!", "#6B2737");
      return { ok: false, error: "auth" };
    }
    if (response.status === 404) {
      console.warn("[TripProfile] No profile found yet");
      await setBadge("!", "#A07840");
      return { ok: false, error: "no_profile" };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        ...data,
        _syncedAt: new Date().toISOString(),
      },
    });
    await setBadge("", "#00000000");
    console.log("[TripProfile] Profile synced at", new Date().toISOString());
    return { ok: true };
  } catch (err) {
    console.error("[TripProfile] Sync failed:", err);
    await setBadge("!", "#6B2737");
    return { ok: false, error: String(err) };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  fetchAndStore();
  chrome.alarms.create("tripprofile-refresh", {
    periodInMinutes: REFRESH_INTERVAL_MS / 60000,
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tripprofile-refresh") {
    fetchAndStore();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "RESYNC") {
    fetchAndStore().then((result) => sendResponse(result));
    return true;
  }
  if (message.type === "GET_APP_URL") {
    sendResponse({ apiBase: API_BASE, appUrl: APP_URL });
    return false;
  }
});
