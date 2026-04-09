const API_BASE = "https://workspace.agrifluencer.repl.co/api";
const DASHBOARD_URL = "https://workspace.agrifluencer.repl.co/";
const USER_ID = "user_1";
const STORAGE_KEY = "tripprofile";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

async function fetchAndStore() {
  try {
    const response = await fetch(`${API_BASE}/summary/${USER_ID}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (response.status === 401) {
      console.warn("[TripProfile] Not authenticated — opening dashboard to log in");
      chrome.tabs.create({ url: DASHBOARD_URL });
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        ...data,
        _syncedAt: new Date().toISOString(),
      },
    });
    console.log("[TripProfile] Profile synced at", new Date().toISOString());
  } catch (err) {
    console.error("[TripProfile] Sync failed:", err);
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
    fetchAndStore().then(() => sendResponse({ ok: true }));
    return true;
  }
});
