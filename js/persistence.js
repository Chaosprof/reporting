// Persistence: localStorage + optional GitHub Gist sync for progress data.
const GIST_FILENAME  = "journal-quiz-data.json";
const GIST_DESCRIPTION = "Journal Entry Trainer — saved progress";
const PAT_KEY        = "journal-quiz-pat";
const GIST_ID_KEY    = "journal-quiz-gist-id";
const LOCAL_DATA_KEY = "journal-quiz-data";

const DEFAULT_DATA = {
  questionStats: {},   // { id: { attempts, correct, lastWrong, lastSeen } }
  deckBestResults: {}, // { deckId: { pct, score, total, completedAt, label } }
  totalSessions: 0,
  lastUpdated: 0,
  resetAt: 0,
};

function normalizePat(t) {
  return String(t || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^token\s+/i, "")
    .trim();
}
function getPat()   { return localStorage.getItem(PAT_KEY) || ""; }
function setPat(t)  {
  const token = normalizePat(t);
  if (token) localStorage.setItem(PAT_KEY, token);
  else localStorage.removeItem(PAT_KEY);
}
function getGistId(){ return localStorage.getItem(GIST_ID_KEY) || ""; }
function setGistId(id){ if (id) localStorage.setItem(GIST_ID_KEY, id); else localStorage.removeItem(GIST_ID_KEY); }

function loadLocalData() {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY);
    if (!raw) return freshData();
    return freshData(JSON.parse(raw));
  } catch { return freshData(); }
}
function saveLocalData(data) {
  try { localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data)); } catch {}
}

function freshData(data = {}) {
  return {
    ...DEFAULT_DATA,
    ...data,
    questionStats: { ...(data.questionStats || {}) },
    deckBestResults: { ...(data.deckBestResults || {}) },
    resetAt: Number(data.resetAt || 0),
  };
}

function resetProgressData() {
  const now = Date.now();
  return freshData({ lastUpdated: now, resetAt: now });
}

async function gistFetch(path, opts = {}) {
  const pat = getPat();
  if (!pat) throw new Error("No PAT configured");
  const r = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers || {})
    },
  });
  if (!r.ok) {
    let detail = r.statusText;
    try {
      const body = await r.json();
      detail = body && body.message ? body.message : detail;
    } catch {
      try { detail = await r.text() || detail; } catch {}
    }
    throw new Error(`GitHub API ${r.status}: ${detail}`);
  }
  return r.json();
}

async function findExistingProgressGist() {
  const gists = await gistFetch("/gists?per_page=100");
  if (!Array.isArray(gists)) return null;
  const matches = gists
    .filter(g => g && g.id && g.files && g.files[GIST_FILENAME])
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  const exact = matches.find(g => g.description === GIST_DESCRIPTION);
  const gist = exact || matches[0] || null;
  if (gist) setGistId(gist.id);
  return gist;
}

async function loadGistData() {
  const existing = await findExistingProgressGist();
  const gistId = existing && existing.id ? existing.id : getGistId();
  if (!gistId) return null;
  const gist = await gistFetch(`/gists/${gistId}`);
  const file = gist.files && gist.files[GIST_FILENAME];
  if (!file) return null;
  try { return freshData(JSON.parse(file.content)); }
  catch { return null; }
}

let _gistSaveInFlight = null;
let _gistSavePending = null;

async function _drainGistSave() {
  try {
    while (_gistSavePending) {
      const data = _gistSavePending;
      _gistSavePending = null;
      await saveGistData(data);
    }
    setSyncStatus("synced");
  } catch (e) {
    console.warn("Gist save failed:", e);
    setSyncStatus("error", syncErrorText(e));
  } finally {
    _gistSaveInFlight = null;
  }
}

function queueGistSave(data) {
  saveLocalData(data);
  if (!getPat()) { setSyncStatus("local"); return; }
  _gistSavePending = data;
  setSyncStatus("saving");
  if (!_gistSaveInFlight) _gistSaveInFlight = _drainGistSave();
}

async function saveGistData(data) {
  const existing = await findExistingProgressGist();
  let gistId = existing && existing.id ? existing.id : getGistId();
  const body = { files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } } };
  if (gistId) {
    try {
      return await gistFetch(`/gists/${gistId}`, { method: "PATCH", body: JSON.stringify(body) });
    } catch (e) {
      if (!isGistNotFoundError(e)) throw e;
      setGistId("");
    }
  }
  const gist = await gistFetch("/gists", {
    method: "POST",
    body: JSON.stringify({ description: GIST_DESCRIPTION, public: false, ...body }),
  });
  setGistId(gist.id);
  return gist;
}

// Merge two data snapshots: take whichever has more attempts per question.
function mergeData(a, b) {
  a = freshData(a);
  b = freshData(b);
  if ((a.resetAt || 0) > (b.lastUpdated || 0) && (a.resetAt || 0) >= (b.resetAt || 0)) return a;
  if ((b.resetAt || 0) > (a.lastUpdated || 0) && (b.resetAt || 0) >= (a.resetAt || 0)) return b;
  const out = freshData(a);
  out.questionStats = { ...(a.questionStats || {}) };
  for (const [id, sb] of Object.entries(b.questionStats || {})) {
    const sa = out.questionStats[id];
    if (!sa || (sb.attempts || 0) > (sa.attempts || 0)) {
      out.questionStats[id] = sb;
    }
  }
  out.deckBestResults = { ...(a.deckBestResults || {}) };
  for (const [id, rb] of Object.entries(b.deckBestResults || {})) {
    const ra = out.deckBestResults[id];
    if (isBetterDeckResult(rb, ra)) out.deckBestResults[id] = rb;
  }
  out.totalSessions = Math.max(a.totalSessions || 0, b.totalSessions || 0);
  out.lastUpdated   = Math.max(a.lastUpdated   || 0, b.lastUpdated   || 0);
  out.resetAt       = Math.max(a.resetAt       || 0, b.resetAt       || 0);
  return out;
}

function isBetterDeckResult(next, current) {
  if (!next) return false;
  if (!current) return true;
  const nextPct = Number(next.pct) || 0;
  const currentPct = Number(current.pct) || 0;
  if (nextPct !== currentPct) return nextPct > currentPct;
  return (Number(next.total) || 0) > (Number(current.total) || 0);
}
