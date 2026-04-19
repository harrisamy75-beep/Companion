const STORAGE_KEY = "tripprofile";
const KEY_KEY = "companion_api_key";
const API_BASE = "https://travelcompaniontool.replit.app/api";
const APP_URL = "https://travelcompaniontool.replit.app";
const SETTINGS_URL = `${APP_URL}/settings/extension`;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text });
    if (color) await chrome.action.setBadgeBackgroundColor({ color });
  } catch {
    /* noop */
  }
}

async function getStoredKey() {
  const result = await chrome.storage.local.get(KEY_KEY);
  return result[KEY_KEY] || null;
}

async function setStoredKey(key) {
  if (key) {
    await chrome.storage.local.set({ [KEY_KEY]: key });
  } else {
    await chrome.storage.local.remove(KEY_KEY);
  }
}

async function fetchAndStore() {
  try {
    const apiKey = await getStoredKey();
    if (!apiKey) {
      console.log("[Companion] No API key set — skipping sync.");
      await setBadge("!", "#A07840");
      return { ok: false, error: "no_key" };
    }

    console.log("[Companion] Sync →", `${API_BASE}/extension/sync`);

    const response = await fetch(`${API_BASE}/extension/sync`, {
      headers: {
        "x-companion-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    console.log("[Companion] Sync response status:", response.status);

    if (response.status === 401 || response.status === 403) {
      const body = await response.text();
      console.warn("[Companion] Auth rejected:", body.slice(0, 200));
      await setBadge("!", "#6B2737");
      return { ok: false, error: "auth" };
    }
    if (response.status === 404) {
      await setBadge("!", "#A07840");
      return { ok: false, error: "no_profile" };
    }
    if (!response.ok) {
      const body = await response.text();
      console.error("[Companion] HTTP", response.status, body.slice(0, 200));
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    await chrome.storage.local.set({
      [STORAGE_KEY]: { ...data, _syncedAt: new Date().toISOString() },
    });
    await setBadge("", "#00000000");
    console.log("[Companion] Profile synced at", new Date().toISOString());
    return { ok: true };
  } catch (err) {
    console.error("[Companion] Sync failed:", err);
    await setBadge("!", "#6B2737");
    return { ok: false, error: String(err) };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  fetchAndStore();
  chrome.alarms.create("companion-refresh", {
    periodInMinutes: REFRESH_INTERVAL_MS / 60000,
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "companion-refresh") {
    fetchAndStore();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "RESYNC") {
    fetchAndStore().then((result) => sendResponse(result));
    return true;
  }
  if (message.type === "GET_APP_URL") {
    sendResponse({ apiBase: API_BASE, appUrl: APP_URL, settingsUrl: SETTINGS_URL });
    return false;
  }
  if (message.type === "SET_KEY") {
    (async () => {
      const key = (message.key || "").trim();
      if (!key || !key.startsWith("cpn_")) {
        sendResponse({ ok: false, error: "invalid_key" });
        return;
      }
      await setStoredKey(key);
      const result = await fetchAndStore();
      sendResponse(result);
    })();
    return true;
  }
  if (message.type === "CLEAR_KEY") {
    setStoredKey(null).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "OPEN_SETTINGS") {
    chrome.tabs.create({ url: SETTINGS_URL });
    sendResponse({ ok: true });
    return false;
  }
});
