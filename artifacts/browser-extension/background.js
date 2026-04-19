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

// Clerk's __session cookie value is itself a signed JWT — Clerk's
// server middleware accepts it as a Bearer token. We read the cookie
// via chrome.cookies (requires "cookies" permission + host permission)
// and forward it as Authorization: Bearer to bypass any SameSite issues
// that may strip the cookie on extension-originated cross-site fetches.
async function getClerkToken() {
  const candidates = ["__session", "__clerk_db_jwt"];
  for (const name of candidates) {
    try {
      const cookie = await new Promise((resolve) => {
        chrome.cookies.get({ url: APP_URL, name }, (c) => resolve(c));
      });
      if (cookie && cookie.value) {
        console.log(`[TripProfile] Found cookie '${name}' (len=${cookie.value.length})`);
        return cookie.value;
      }
    } catch (e) {
      console.warn(`[TripProfile] cookies.get('${name}') failed:`, e);
    }
  }
  console.warn("[TripProfile] No Clerk session cookie found at", APP_URL);
  return null;
}

async function fetchAndStore() {
  try {
    const token = await getClerkToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    console.log("[TripProfile] Sync request →", `${API_BASE}/summary`,
      "withToken:", Boolean(token));

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
      console.warn("[TripProfile] No profile found yet");
      await setBadge("!", "#A07840");
      return { ok: false, error: "no_profile" };
    }
    if (!response.ok) {
      const body = await response.text();
      console.error("[TripProfile] HTTP", response.status, "body:", body.slice(0, 200));
      throw new Error(`HTTP ${response.status}`);
    }

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
