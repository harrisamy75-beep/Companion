const STORAGE_KEY = "tripprofile";
const CONFIG_KEY = "tripprofile_config";

const DEFAULT_CONFIG = {
  apiBase: "https://travelcompaniontool.replit.app/api",
  userId: "",
};

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeApiBase(input) {
  let url = (input || "").trim().replace(/\/+$/, "");
  if (!url) return DEFAULT_CONFIG.apiBase;
  if (!url.endsWith("/api")) url += "/api";
  return url;
}

function dashboardUrlFromApi(apiBase) {
  return apiBase.replace(/\/api$/, "/");
}

function formatSyncTime(isoString) {
  if (!isoString) return "Never synced";
  const d = new Date(isoString);
  return "Last synced: " + d.toLocaleString();
}

async function getConfig() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return { ...DEFAULT_CONFIG, ...(result[CONFIG_KEY] || {}) };
}

async function saveConfig(cfg) {
  await chrome.storage.local.set({ [CONFIG_KEY]: cfg });
}

/* ─── View toggling ─── */
function showView(name) {
  document.getElementById("settings-view").classList.toggle("hidden", name !== "settings");
  document.getElementById("profile-view").classList.toggle("hidden", name !== "profile");
}

/* ─── Profile rendering ─── */
function renderProfile(profile) {
  if (!profile) {
    document.getElementById("traveler-count").textContent = "No profile yet";
    document.getElementById("children-detail").textContent = "";
    document.getElementById("autofill-preview").textContent = "—";
    document.getElementById("sync-time").textContent = "Sync to load your profile";
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
  const tags = (preferences && preferences.travelStyleTags) || [];
  if (tags.length === 0) {
    const span = document.createElement("span");
    span.className = "tag empty";
    span.textContent = "Not set";
    tagsEl.appendChild(span);
  } else {
    tags.forEach((tag) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = tag.replace(/_/g, " ");
      tagsEl.appendChild(span);
    });
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

/* ─── Init ─── */
document.addEventListener("DOMContentLoaded", async () => {
  const cfg = await getConfig();

  /* Wire dashboard link to whichever app URL is configured */
  document.getElementById("dashboard-link").href = dashboardUrlFromApi(cfg.apiBase);

  /* Pre-fill settings inputs */
  document.getElementById("cfg-userid").value = cfg.userId || "";
  document.getElementById("cfg-api").value = (cfg.apiBase || "").replace(/\/api$/, "");

  /* If no userId yet, force settings view */
  if (!cfg.userId) {
    showView("settings");
    document.getElementById("setup-banner").classList.remove("hidden");
    document.getElementById("back-to-profile").classList.add("hidden");
  } else {
    showView("profile");
    loadProfile();
  }

  /* Open settings */
  document.getElementById("open-settings").addEventListener("click", async () => {
    const current = await getConfig();
    document.getElementById("cfg-userid").value = current.userId || "";
    document.getElementById("cfg-api").value = (current.apiBase || "").replace(/\/api$/, "");
    document.getElementById("setup-banner").classList.add("hidden");
    document.getElementById("back-to-profile").classList.remove("hidden");
    showView("settings");
  });

  /* Back to profile (only when a profile already exists) */
  document.getElementById("back-to-profile").addEventListener("click", () => {
    showView("profile");
    loadProfile();
  });

  /* Save settings */
  document.getElementById("save-settings").addEventListener("click", async () => {
    const rawName = document.getElementById("cfg-userid").value;
    const userId = slugify(rawName);
    const apiBase = normalizeApiBase(document.getElementById("cfg-api").value);

    if (!userId) {
      alert("Please enter your name.");
      return;
    }

    await saveConfig({ userId, apiBase });
    document.getElementById("dashboard-link").href = dashboardUrlFromApi(apiBase);

    const btn = document.getElementById("save-settings");
    btn.disabled = true;
    btn.textContent = "Syncing…";

    chrome.runtime.sendMessage({ type: "RESYNC" }, (response) => {
      btn.disabled = false;
      btn.textContent = "Save & sync";

      if (response?.ok) {
        showView("profile");
        loadProfile();
      } else {
        alert(
          response?.error === "auth"
            ? "Couldn't find that account. Check your name and the app URL, then try again."
            : "Sync failed — check your app URL and connection."
        );
      }
    });
  });

  /* Resync from profile view */
  const resyncBtn = document.getElementById("resync");
  const statusEl = document.getElementById("status");

  resyncBtn.addEventListener("click", () => {
    resyncBtn.disabled = true;
    resyncBtn.textContent = "Syncing…";
    statusEl.textContent = "";
    statusEl.classList.remove("error");

    chrome.runtime.sendMessage({ type: "RESYNC" }, (response) => {
      if (response?.ok) {
        statusEl.textContent = "Profile updated.";
        loadProfile();
      } else {
        statusEl.textContent =
          response?.error === "no_user"
            ? "Open settings to set your name."
            : response?.error === "auth"
            ? "Account not found — check settings."
            : "Sync failed — check connection.";
        statusEl.classList.add("error");
      }
      resyncBtn.disabled = false;
      resyncBtn.textContent = "Re-sync profile";
      setTimeout(() => {
        statusEl.textContent = "";
        statusEl.classList.remove("error");
      }, 3500);
    });
  });
});
