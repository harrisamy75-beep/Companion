const STORAGE_KEY = "tripprofile";
const CONFIG_KEY = "tripprofile_config";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

const DEFAULT_CONFIG = {
  apiBase: "https://travelcompaniontool.replit.app/api",
  userId: "",
};

async function getConfig() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return { ...DEFAULT_CONFIG, ...(result[CONFIG_KEY] || {}) };
}

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text });
    if (color) await chrome.action.setBadgeBackgroundColor({ color });
  } catch {
    /* noop */
  }
}

async function fetchAndStore() {
  const { apiBase, userId } = await getConfig();

  if (!userId) {
    console.warn("[TripProfile] No userId configured — open the popup to set up");
    await setBadge("!", "#A07840");
    return { ok: false, error: "no_user" };
  }

  try {
    const response = await fetch(`${apiBase}/summary/${encodeURIComponent(userId)}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 401 || response.status === 404) {
      console.warn("[TripProfile] User not found / not authenticated");
      await setBadge("!", "#6B2737");
      return { ok: false, error: "auth" };
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
  if (message.type === "GET_CONFIG") {
    getConfig().then((cfg) => sendResponse(cfg));
    return true;
  }
});
