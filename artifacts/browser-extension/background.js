const STORAGE_KEY = "tripprofile";
const TOKEN_KEY = "tripprofile_token";
const API_BASE = "https://travelcompaniontool.replit.app/api";
const APP_URL = "https://travelcompaniontool.replit.app";
const CONNECT_URL = `${APP_URL}/extension-connect`;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

async function setBadge(text, color) {
  try {
    await chrome.action.setBadgeText({ text });
    if (color) await chrome.action.setBadgeBackgroundColor({ color });
  } catch {
    /* noop */
  }
}

async function getStoredToken() {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  return result[TOKEN_KEY] || null;
}

async function setStoredToken(token) {
  if (token) {
    await chrome.storage.local.set({ [TOKEN_KEY]: token });
  } else {
    await chrome.storage.local.remove(TOKEN_KEY);
  }
}

// Legacy fallback: try Clerk's __session cookie if no stored token.
// Kept so that users who installed an older build don't have to
// reconnect immediately — they'll still sync when the cookie is reachable.
async function getLegacyClerkCookie() {
  for (const name of ["__session", "__clerk_db_jwt"]) {
    try {
      const cookie = await new Promise((resolve) => {
        chrome.cookies.get({ url: APP_URL, name }, (c) => resolve(c));
      });
      if (cookie && cookie.value) return cookie.value;
    } catch {
      /* noop */
    }
  }
  return null;
}

async function fetchAndStore() {
  try {
    const storedToken = await getStoredToken();
    const fallbackToken = storedToken ? null : await getLegacyClerkCookie();
    const bearer = storedToken || fallbackToken;

    const headers = { "Content-Type": "application/json" };
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;

    console.log(
      "[TripProfile] Sync →",
      `${API_BASE}/summary`,
      "tokenSource:",
      storedToken ? "stored" : fallbackToken ? "legacy-cookie" : "none"
    );

    const response = await fetch(`${API_BASE}/summary`, {
      credentials: "include",
      headers,
    });

    console.log("[TripProfile] Sync response status:", response.status);

    if (response.status === 401 || response.status === 403) {
      const body = await response.text();
      console.warn("[TripProfile] Auth rejected. Body:", body.slice(0, 200));
      await setBadge("!", "#6B2737");
      return { ok: false, error: "auth" };
    }
    if (response.status === 404) {
      await setBadge("!", "#A07840");
      return { ok: false, error: "no_profile" };
    }
    if (!response.ok) {
      const body = await response.text();
      console.error("[TripProfile] HTTP", response.status, body.slice(0, 200));
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    await chrome.storage.local.set({
      [STORAGE_KEY]: { ...data, _syncedAt: new Date().toISOString() },
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
    sendResponse({ apiBase: API_BASE, appUrl: APP_URL, connectUrl: CONNECT_URL });
    return false;
  }
  if (message.type === "SET_TOKEN") {
    (async () => {
      const token = (message.token || "").trim();
      if (!token || token.split(".").length !== 3) {
        sendResponse({ ok: false, error: "invalid_token" });
        return;
      }
      await setStoredToken(token);
      const result = await fetchAndStore();
      sendResponse(result);
    })();
    return true;
  }
  if (message.type === "CLEAR_TOKEN") {
    setStoredToken(null).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "OPEN_CONNECT") {
    chrome.tabs.create({ url: CONNECT_URL });
    sendResponse({ ok: true });
    return false;
  }
});
