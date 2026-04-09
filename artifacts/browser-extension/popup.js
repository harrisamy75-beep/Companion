const STORAGE_KEY = "tripprofile";
const DASHBOARD_URL = "https://workspace.agrifluencer.repl.co/";

function formatSyncTime(isoString) {
  if (!isoString) return "Never synced";
  const d = new Date(isoString);
  return "Last synced: " + d.toLocaleString();
}

function renderProfile(profile) {
  if (!profile) {
    document.getElementById("traveler-count").textContent = "No profile yet";
    document.getElementById("sync-time").textContent = "Sync to load your profile";
    return;
  }

  const { family, preferences, autoFillPayload, _syncedAt } = profile;

  document.getElementById("traveler-count").textContent =
    `${family.travelerCount} traveler${family.travelerCount !== 1 ? "s" : ""}`;

  const childLines = family.children.map(
    (c) => `${c.name} (${c.ageYears}y)`
  );
  document.getElementById("children-detail").textContent =
    childLines.length > 0
      ? childLines.join(", ")
      : "No children added yet";

  const tagsEl = document.getElementById("style-tags");
  tagsEl.innerHTML = "";
  const tags = preferences.travelStyleTags || [];
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
  const agesStr =
    childAges.length > 0
      ? `, ages: ${childAges.join(", ")}`
      : "";
  document.getElementById("autofill-preview").textContent =
    `${adults} adult${adults !== 1 ? "s" : ""}, ${children} child${children !== 1 ? "ren" : ""}${agesStr}`;

  document.getElementById("sync-time").textContent = formatSyncTime(_syncedAt);
}

async function loadProfile() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  renderProfile(result[STORAGE_KEY] || null);
}

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();

  const dashboardLink = document.getElementById("dashboard-link");
  dashboardLink.href = DASHBOARD_URL;

  const resyncBtn = document.getElementById("resync");
  const statusEl = document.getElementById("status");

  resyncBtn.addEventListener("click", () => {
    resyncBtn.disabled = true;
    resyncBtn.textContent = "Syncing…";
    statusEl.textContent = "";

    chrome.runtime.sendMessage({ type: "RESYNC" }, (response) => {
      if (response?.ok) {
        statusEl.textContent = "Profile updated!";
        loadProfile();
      } else {
        statusEl.textContent = "Sync failed — check connection";
        statusEl.style.color = "#dc2626";
      }
      resyncBtn.disabled = false;
      resyncBtn.textContent = "Re-sync profile";
      setTimeout(() => {
        statusEl.textContent = "";
        statusEl.style.color = "#16a34a";
      }, 3000);
    });
  });
});
