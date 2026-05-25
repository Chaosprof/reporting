// Question bank: post-processing applied after JSON data is loaded.
// QUESTIONS array is built up by main.js from data/questions/*.json files.
const QUESTIONS = [];

// BWL_BOTH_SOURCE_PREFIXES is loaded from data/bwl-both-source-prefixes.json by main.js.
let BWL_BOTH_SOURCE_PREFIXES = [];

function hashId(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return "q" + (h >>> 0).toString(36);
}

function addQuestionDeck(q, deckId) {
  q.decks = Array.isArray(q.decks) ? q.decks : [];
  if (!q.decks.includes(deckId)) q.decks.push(deckId);
}

// Tag BWL II questions with source years (which exam paper they came from).
function applySourceYearTags() {
  QUESTIONS.forEach(q => {
    if (q.subject !== "BWL II" || q.sourceYears || String(q.set || "").endsWith("-AI")) return;
    const inBoth = q.set === "BWL2-SM" || BWL_BOTH_SOURCE_PREFIXES.some(p => q.prompt.startsWith(p));
    q.sourceYears = inBoth ? ["2017", "2025"] : ["2017"];
  });
}

// Assign BWL II math questions to deck buckets based on prompt/visual heuristics.
function applyMathDeckTags() {
  QUESTIONS.forEach(q => {
    if (q.subject !== "BWL II") return;
    const prompt = String(q.prompt || "");
    const visual = String(q.visual || "");
    let mathDeck = Array.isArray(q.decks) && q.decks.includes("BWL2-MATH");
    let categoryDeck = "";

    if (visual.includes("producer-rent")) categoryDeck = "BWL2-MATH-RENT";
    else if (visual.includes("indifference") || visual.includes("experience")) categoryDeck = "BWL2-MATH-DIAGRAMS";
    else if (
      visual.includes("value-table") ||
      visual.includes("oilster-table") ||
      /Wertschöpfung .* Stufe|Wertschöpfungskette/.test(prompt)
    ) categoryDeck = "BWL2-MATH-VALUE";
    else if (
      /^TK\(/.test(prompt) ||
      (/TK\(Q\)|Totalkostenfunktion|minimale Einstiegsmenge|Kostennachteil/.test(prompt) && !prompt.startsWith("SwissCam"))
    ) categoryDeck = "BWL2-MATH-COST";

    if (categoryDeck) {
      addQuestionDeck(q, "BWL2-MATH");
      addQuestionDeck(q, categoryDeck);
      mathDeck = true;
    }

    if (!mathDeck) return;
    if (!categoryDeck && /TK\(Q\)|Totalkostenfunktion|minimale Einstiegsmenge|Kostennachteil/.test(prompt) && !prompt.startsWith("SwissCam")) {
      addQuestionDeck(q, "BWL2-MATH-COST");
    }
  });
}

// Stable IDs derived from prompt text — survive reorderings/insertions.
function assignQuestionIds() {
  const seenQuestionIds = new Map();
  QUESTIONS.forEach(q => {
    const baseId = hashId(q.prompt);
    const seen = seenQuestionIds.get(baseId) || 0;
    seenQuestionIds.set(baseId, seen + 1);
    q.id = seen ? `${baseId}-${seen + 1}` : baseId;
  });
}

function postProcessQuestions() {
  applySourceYearTags();
  applyMathDeckTags();
  assignQuestionIds();
}
