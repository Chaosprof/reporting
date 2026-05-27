// Pony popups shown after scored answers.
// Image arrays are populated by main.js from data/pony-images.json files.
const PONY_IMAGES = [];
const BLACK_PONY_IMAGES = [];
const PONY_PROFILES = {};
const ponyState = { recent: [], blackRecent: [], hideTimer: null, currentProfile: null };

function pickPonyImage(images, recent) {
  const avoidCount = Math.min(8, images.length - 1);
  let url;
  do {
    url = images[Math.floor(Math.random() * images.length)];
  } while (recent.includes(url));
  recent.push(url);
  if (recent.length > avoidCount) recent.shift();
  return url;
}

function showPonyPopup({ death = false } = {}) {
  const el = document.getElementById("ponyReward");
  const img = document.getElementById("ponyImg");
  const caption = el?.querySelector(".pony-caption");
  const profile = el?.querySelector(".pony-profile");
  const images = death ? BLACK_PONY_IMAGES : PONY_IMAGES;
  const recent = death ? ponyState.blackRecent : ponyState.recent;
  if (!el || !img || !images.length) return;

  const url = pickPonyImage(images, recent);
  ponyState.currentProfile = death ? null : PONY_PROFILES[url] || null;
  img.src = url;
  img.alt = death ? "A black pony" : (ponyState.currentProfile ? ponyState.currentProfile.name : "A cute pony");
  if (caption) caption.textContent = death ? "Pony of death" : "Cute pony!";
  if (profile) {
    profile.hidden = true;
    profile.replaceChildren();
  }

  el.classList.toggle("death", death);
  el.classList.remove("profiled");
  el.classList.remove("hide");
  // Force reflow to restart animation if already showing
  void el.offsetWidth;
  el.classList.add("show");
  el.setAttribute("aria-hidden", "false");

  clearTimeout(ponyState.hideTimer);
  ponyState.hideTimer = death ? setTimeout(hidePonyReward, 2800) : null;
}

function showPonyReward() {
  showPonyPopup();
}

function showPonyOfDeath() {
  showPonyPopup({ death: true });
}

function revealPonyProfile() {
  const el = document.getElementById("ponyReward");
  const profile = el?.querySelector(".pony-profile");
  const data = ponyState.currentProfile;
  if (!el || !profile || !data || el.classList.contains("death")) return;

  clearTimeout(ponyState.hideTimer);
  el.classList.add("profiled");
  profile.hidden = false;
  profile.replaceChildren();

  const title = document.createElement("div");
  title.className = "pony-profile-name";
  title.textContent = data.name;
  profile.appendChild(title);

  [
    ["Favorite color", data.favoriteColor],
    ["Kindergarten sign", data.kindergartenSign],
    ["Favorite snacky", data.favoriteSnacky],
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "pony-profile-row";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    profile.appendChild(row);
  });

  ponyState.hideTimer = null;
}

function hidePonyReward() {
  const el = document.getElementById("ponyReward");
  if (!el) return;
  clearTimeout(ponyState.hideTimer);
  el.classList.remove("show");
  el.classList.add("hide");
  el.classList.remove("profiled");
  el.setAttribute("aria-hidden", "true");
}

document.addEventListener("DOMContentLoaded", () => {
  const reward = document.getElementById("ponyReward");
  const closeBtn = document.getElementById("ponyClose");
  if (reward) {
    reward.addEventListener("click", event => {
      if (event.target.closest(".pony-close")) return;
      revealPonyProfile();
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", hidePonyReward);
});
