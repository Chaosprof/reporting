// App state, top-level constants (subjects/timers/papers/decks), pool helpers, shuffle.
const SUBJECTS = [
  { id: "Financial Reporting", label: "Financial Reporting" },
  { id: "BWL II",              label: "BWL II" },
];
const SUBJECT_KEY = "quiz-subject";
const DEFAULT_SUBJECT = "Financial Reporting";
const TIMER_KEY = "quiz-question-timer-seconds";
const TIMER_OPTIONS = [
  { seconds: 0,   label: "No timer" },
  { seconds: 90,  label: "1:30" },
  { seconds: 60,  label: "1:00" },
];
const BWL_CATEGORIES = [
  "Strategisches Management",
  "Human Resource Management",
  "Organisation",
];
const BWL_PAPERS = [
  { id: "2017", label: "Probeprüfung 2017", sub: "Frühjahrssemester" },
  { id: "2025", label: "Probeprüfung 2025", sub: "Frühjahrssemester" },
  { id: "2017-06", label: "Assessment Juni 2017", sub: "Juni 2017" },
  { id: "ubung", label: "Übung FS26", sub: "Strategisches Management" },
];

function getSubject() {
  const saved = localStorage.getItem(SUBJECT_KEY);
  return SUBJECTS.some(s => s.id === saved) ? saved : DEFAULT_SUBJECT;
}
function questionSubject(q) { return q.subject || "Financial Reporting"; }
function getTimerSeconds() {
  const saved = parseInt(localStorage.getItem(TIMER_KEY) || "0", 10);
  return TIMER_OPTIONS.some(t => t.seconds === saved) ? saved : 0;
}

const state = {
  screen: "start",           // "start" | "quiz" | "results"
  subject: getSubject(),     // which subject (tab) is active
  selectedCats: new Set(),   // empty = all
  accountingDeckTab: "exam",
  selectedBwlPapers: new Set(BWL_PAPERS.map(p => p.id)),
  bwlCategory: "all",
  order: [],                 // indices into QUESTIONS for this run
  idx: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  answered: false,
  picked: -1,                // index into shuffled options
  optionOrder: [],           // mapping: display_index → original_option_index
  wrong: [],                 // [{questionIndex, prompt, picked, correct, explanation}]
  mode: "all",               // "all" | "weak" | "deck" | "mistakes" — what the current run is drawn from
  deckId: null,              // when mode === "deck", which deck
  resultRecorded: false,
  data: loadLocalData(),     // persisted progress (questionStats, etc.)
  syncStatus: getPat() ? "connected" : "local",
  syncError: "",
  settingsOpen: false,
  timerSeconds: getTimerSeconds(),
  timerRemaining: 0,
  timerDeadline: 0,
  timerId: null,
  lastTickSecond: null,
};

function setSubject(s) {
  if (s === state.subject) return;
  stopQuestionTimer();
  state.subject = s;
  try { localStorage.setItem(SUBJECT_KEY, s); } catch {}
  state.selectedCats = new Set();
  if (s === "BWL II") {
    state.selectedBwlPapers = new Set(BWL_PAPERS.map(p => p.id));
    state.bwlCategory = "all";
  }
  state.screen = "start";
  render();
}

function setTimerSeconds(seconds) {
  if (!TIMER_OPTIONS.some(t => t.seconds === seconds)) return;
  state.timerSeconds = seconds;
  try { localStorage.setItem(TIMER_KEY, String(seconds)); } catch {}
  render();
}

function formatTimer(seconds) {
  const s = Math.max(0, seconds | 0);
  const mins = Math.floor(s / 60);
  return `${mins}:${String(s % 60).padStart(2, "0")}`;
}

function stopQuestionTimer() {
  if (!state.timerId) return;
  clearInterval(state.timerId);
  state.timerId = null;
}

function updateTimerDisplay() {
  const el = document.getElementById("timerPill");
  if (!el || !state.timerSeconds || state.answered) return;
  const remaining = Math.max(0, Math.ceil((state.timerDeadline - Date.now()) / 1000));
  state.timerRemaining = remaining;
  el.textContent = formatTimer(remaining);
  el.classList.toggle("warning", remaining <= 30 && remaining > 10);
  el.classList.toggle("danger", remaining <= 10);
  if (remaining > 0 && remaining <= 10 && remaining !== state.lastTickSecond) {
    state.lastTickSecond = remaining;
    playClockTick();
  }
  if (remaining <= 0) expireQuestionTimer();
}

function startQuestionTimer() {
  stopQuestionTimer();
  if (!state.timerSeconds || state.screen !== "quiz" || state.answered) return;
  state.timerRemaining = state.timerSeconds;
  state.timerDeadline = Date.now() + state.timerSeconds * 1000;
  state.lastTickSecond = null;
  updateTimerDisplay();
  state.timerId = setInterval(updateTimerDisplay, 250);
}

function expireQuestionTimer() {
  if (state.answered) return;
  stopQuestionTimer();
  pickAnswer(-1, true);
}

function subjectIndices(subject) {
  const result = [];
  for (let i = 0; i < QUESTIONS.length; i++) {
    if (questionSubject(QUESTIONS[i]) === subject) result.push(i);
  }
  return result;
}
function getActiveCats() {
  return [...new Set(
    QUESTIONS.filter(q => questionSubject(q) === state.subject).map(q => q.category)
  )];
}

const ACCOUNTING_DECK_TABS = [
  { id: "exam", label: "Exam prep" },
  { id: "problem", label: "By problem sheet" },
  { id: "topic", label: "By topic" },
];

const EXAM_PREP_DECKS = [
  { id: "exam-2026-05-24", subject: "Financial Reporting", label: "May 24 Sunday",    sub: "Recitation 1 + Additional Exercises 1", sets: ["R1", "AE1"] },
  { id: "exam-2026-05-25", subject: "Financial Reporting", label: "May 25 Monday",    sub: "Recitation 2 + Additional Exercises 2", sets: ["R2", "AE2"] },
  { id: "exam-2026-05-26", subject: "Financial Reporting", label: "May 26 Tuesday",   sub: "Recitation 1-2 + Additional Exercises 1-2", sets: ["R1", "R2", "AE1", "AE2"] },
  { id: "exam-2026-05-27", subject: "Financial Reporting", label: "May 27 Wednesday", sub: "Recitation 3 + Additional Exercises 3", sets: ["R3", "AE3"] },
  { id: "exam-2026-05-28", subject: "Financial Reporting", label: "May 28 Thursday",  sub: "Recitation 2-3 + Additional Exercises 2-3", sets: ["R2", "R3", "AE2", "AE3"] },
  { id: "exam-2026-05-29", subject: "Financial Reporting", label: "May 29 Friday",    sub: "All recitations + all additional exercises", sets: ["R1", "R2", "R3", "AE1", "AE2", "AE3"] },
  { id: "exam-2026-05-30", subject: "Financial Reporting", label: "May 30 Saturday",  sub: "All recitations + all additional exercises", sets: ["R1", "R2", "R3", "AE1", "AE2", "AE3"] },
  { id: "exam-2026-05-31", subject: "Financial Reporting", label: "May 31 Sunday",    sub: "All recitations + all additional exercises", sets: ["R1", "R2", "R3", "AE1", "AE2", "AE3"] },
];

// Curated decks (course handouts + AI variants).
const DECKS = [
  { id: "AE1",      subject: "Financial Reporting", label: "Additional Exercises 1",      sub: "Course handout",        sets: ["AE1"] },
  { id: "AE1+AI",   subject: "Financial Reporting", label: "Additional Exercises 1 + AI", sub: "Handout + AI add-ons",  sets: ["AE1", "AE1-AI"] },
  { id: "AE2",      subject: "Financial Reporting", label: "Additional Exercises 2",      sub: "Course handout",        sets: ["AE2"] },
  { id: "AE2+AI",   subject: "Financial Reporting", label: "Additional Exercises 2 + AI", sub: "Handout + AI add-ons",  sets: ["AE2", "AE2-AI"] },
  { id: "AE3",      subject: "Financial Reporting", label: "Additional Exercises 3",      sub: "Course handout",        sets: ["AE3"] },
  { id: "AE3+AI",   subject: "Financial Reporting", label: "Additional Exercises 3 + AI", sub: "Handout + AI add-ons",  sets: ["AE3", "AE3-AI"] },
  { id: "R1",       subject: "Financial Reporting", label: "Recitation 1",                sub: "Course handout",        sets: ["R1"] },
  { id: "R1+AI",    subject: "Financial Reporting", label: "Recitation 1 + AI",           sub: "Handout + AI add-ons",  sets: ["R1", "R1-AI"] },
  { id: "R2",       subject: "Financial Reporting", label: "Recitation 2",                sub: "Course handout",        sets: ["R2"] },
  { id: "R2+AI",    subject: "Financial Reporting", label: "Recitation 2 + AI",           sub: "Handout + AI add-ons",  sets: ["R2", "R2-AI"] },
  { id: "R3",       subject: "Financial Reporting", label: "Recitation 3",                sub: "Course handout",        sets: ["R3"] },
  { id: "R3+AI",    subject: "Financial Reporting", label: "Recitation 3 + AI",           sub: "Handout + AI add-ons",  sets: ["R3", "R3-AI"] },
  { id: "BWL2-SM",  subject: "BWL II",              label: "Teil 1: Strategisches Management", sub: "Probeprüfung 2017", sets: ["BWL2-SM"] },
  { id: "BWL2-HRM", subject: "BWL II",              label: "Teil 2: Human Resource Management", sub: "Probeprüfung 2017", sets: ["BWL2-HRM"] },
  { id: "BWL2-ORG", subject: "BWL II",              label: "Teil 3: Organisation",        sub: "Probeprüfung 2017",     sets: ["BWL2-ORG"] },
  { id: "BWL2-HRM25", subject: "BWL II",            label: "FS25: Human Resource Management", sub: "Probeprüfung 2025", sets: ["BWL2-HRM25"] },
  { id: "BWL2-ORG25", subject: "BWL II",            label: "FS25: Organisation",         sub: "Probeprüfung 2025",     sets: ["BWL2-ORG25"] },
  { id: "BWL2-MATH", subject: "BWL II",             label: "Math Practice: All",          sub: "All calculation-style BWL questions", sets: [] },
  { id: "BWL2-MATH-VALUE", subject: "BWL II",       label: "Math: Wertschöpfungskette",   sub: "Stufen, Transferpreise, Wertschöpfung", sets: [] },
  { id: "BWL2-MATH-RENT", subject: "BWL II",        label: "Math: Produzentenrente",     sub: "Nichtangreifbare Produzentenrente", sets: [] },
  { id: "BWL2-MATH-DIAGRAMS", subject: "BWL II",    label: "Math: Diagramme",            sub: "Indifferenzkurven und Erfahrungskurven", sets: [] },
  { id: "BWL2-MATH-COST", subject: "BWL II",        label: "Math: Kostenfunktionen",     sub: "TK, DK, Break-even, Kostennachteil", sets: [] },
  { id: "BWL2-JUN17-SM",  subject: "BWL II",        label: "Juni 2017: Strategisches Management", sub: "Assessmentprüfung 2017", sets: ["BWL2-JUN17-SM"] },
  { id: "BWL2-JUN17-HRM", subject: "BWL II",        label: "Juni 2017: Human Resource Management", sub: "Assessmentprüfung 2017", sets: ["BWL2-JUN17-HRM"] },
  { id: "BWL2-JUN17-ORG", subject: "BWL II",        label: "Juni 2017: Organisation",    sub: "Assessmentprüfung 2017", sets: ["BWL2-JUN17-ORG"] },
  { id: "BWL2-UBUNG",     subject: "BWL II",        label: "Übung: Strategisches Management", sub: "Übungsfragen FS26", sets: ["BWL2-UBUNG"] },
];

function deckPool(deck) {
  return QUESTIONS
    .map((q, i) => ({ q, i }))
    .filter(x => (
      (Array.isArray(deck.sets) && deck.sets.includes(x.q.set)) ||
      (deck.category && questionSubject(x.q) === (deck.subject || "Financial Reporting") && x.q.category === deck.category) ||
      (Array.isArray(x.q.decks) && x.q.decks.includes(deck.id))
    ))
    .map(x => x.i);
}
function activeDecks() {
  return DECKS.filter(d => (d.subject || "Financial Reporting") === state.subject);
}
function activeExamPrepDecks() {
  return EXAM_PREP_DECKS.filter(d => (d.subject || "Financial Reporting") === state.subject);
}
function topicDecks() {
  return getActiveCats().map(c => ({
    id: `topic:${c}`,
    subject: state.subject,
    label: c,
    sub: "Topic practice",
    category: c,
  }));
}
function getDeckById(deckId) {
  return [
    ...EXAM_PREP_DECKS,
    ...DECKS,
    ...topicDecks(),
  ].find(d => d.id === deckId);
}
function bwlPaperPool(paperId, category = "all") {
  return QUESTIONS
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => (
      q.subject === "BWL II" &&
      Array.isArray(q.sourceYears) &&
      q.sourceYears.includes(paperId) &&
      (category === "all" || q.category === category)
    ))
    .map(x => x.i);
}
function bwlSelectedPool() {
  const selectedPapers = state.selectedBwlPapers;
  return bwlPoolFor(selectedPapers, state.bwlCategory);
}
function bwlPoolFor(selectedPapers, category = "all") {
  if (!selectedPapers.size) return [];
  return QUESTIONS
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => (
      q.subject === "BWL II" &&
      Array.isArray(q.sourceYears) &&
      q.sourceYears.some(y => selectedPapers.has(y)) &&
      (category === "all" || q.category === category)
    ))
    .map(x => x.i);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
