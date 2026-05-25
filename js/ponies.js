// Pony reward popup shown on correct answers.
// PONY_IMAGES array is populated by main.js from data/pony-images.json.
const PONY_IMAGES = [];
const ponyState = { recent: [], hideTimer: null };

function showPonyReward() {
  const el = document.getElementById("ponyReward");
  const img = document.getElementById("ponyImg");
  if (!el || !img || !PONY_IMAGES.length) return;

  // Pick a random pony, avoiding the most recent few
  const avoidCount = Math.min(8, PONY_IMAGES.length - 1);
  let url;
  do {
    url = PONY_IMAGES[Math.floor(Math.random() * PONY_IMAGES.length)];
  } while (ponyState.recent.includes(url));
  ponyState.recent.push(url);
  if (ponyState.recent.length > avoidCount) ponyState.recent.shift();

  img.src = url;
  el.classList.remove("hide");
  // Force reflow to restart animation if already showing
  void el.offsetWidth;
  el.classList.add("show");
  el.setAttribute("aria-hidden", "false");

  clearTimeout(ponyState.hideTimer);
  ponyState.hideTimer = setTimeout(hidePonyReward, 2800);
}

function hidePonyReward() {
  const el = document.getElementById("ponyReward");
  if (!el) return;
  clearTimeout(ponyState.hideTimer);
  el.classList.remove("show");
  el.classList.add("hide");
  el.setAttribute("aria-hidden", "true");
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("ponyClose");
  if (closeBtn) closeBtn.addEventListener("click", hidePonyReward);
});
