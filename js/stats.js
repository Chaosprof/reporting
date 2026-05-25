// Per-question stats helpers — answer recording, weakness scoring, totals.
function recordAnswer(q, isCorrect) {
  const id = q.id;
  const s = state.data.questionStats[id] || { attempts: 0, correct: 0, lastWrong: 0, lastSeen: 0 };
  s.attempts++;
  if (isCorrect) s.correct++;
  else s.lastWrong = Date.now();
  s.lastSeen = Date.now();
  state.data.questionStats[id] = s;
  state.data.lastUpdated = Date.now();
}

function weaknessScore(q) {
  const s = state.data.questionStats[q.id];
  if (!s || !s.attempts) return -1; // never seen → handled separately
  const errorRate = (s.attempts - s.correct) / s.attempts;
  // Recency: a recent wrong answer matters more (decay over ~14 days)
  const ageDays = s.lastWrong ? (Date.now() - s.lastWrong) / 86400000 : 999;
  const recency = Math.exp(-ageDays / 14);
  return errorRate * (0.5 + 0.5 * recency);
}

function getWeakestPool(limit = 15) {
  const inSubject = i => questionSubject(QUESTIONS[i]) === state.subject;
  const seen = QUESTIONS
    .map((q, i) => ({ i, q, score: weaknessScore(q), stats: state.data.questionStats[q.id] }))
    .filter(x => inSubject(x.i))
    .filter(x => x.stats && x.stats.attempts > 0);
  // Highest weakness first; tiebreaker: fewer attempts (less data → review)
  seen.sort((a, b) => b.score - a.score || (a.stats.attempts - b.stats.attempts));
  let result = seen.filter(x => x.score > 0).slice(0, limit).map(x => x.i);
  // If still short, fill with unseen questions (still subject-filtered)
  if (result.length < limit) {
    const unseen = QUESTIONS
      .map((q, i) => ({ i, stats: state.data.questionStats[q.id] }))
      .filter(x => inSubject(x.i))
      .filter(x => !x.stats || !x.stats.attempts);
    for (const u of unseen) {
      if (result.length >= limit) break;
      result.push(u.i);
    }
  }
  return result;
}

function totalAttempts() {
  const ids = new Set(QUESTIONS.filter(q => questionSubject(q) === state.subject).map(q => q.id));
  return Object.entries(state.data.questionStats)
    .filter(([id]) => ids.has(id))
    .reduce((a, [, s]) => a + (s.attempts || 0), 0);
}
function totalQuestionsSeen() {
  const ids = new Set(QUESTIONS.filter(q => questionSubject(q) === state.subject).map(q => q.id));
  return Object.entries(state.data.questionStats)
    .filter(([id, s]) => ids.has(id) && s && s.attempts > 0).length;
}
