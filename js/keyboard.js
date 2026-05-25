// Global keyboard shortcuts: answer letters, Enter to advance/start.
document.addEventListener("keydown", (e) => {
  // Settings modal takes priority — only handle Escape, leave inputs alone.
  if (state.settingsOpen) {
    if (e.key === "Escape") {
      state.settingsOpen = false;
      render();
      e.preventDefault();
    }
    return;
  }
  // Don't hijack typing inside any text input/textarea.
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  if (state.screen === "quiz") {
    if (!state.answered) {
      const key = e.key.toUpperCase();
      const idx = "ABCDE".indexOf(key);
      if (idx >= 0 && idx < state.optionOrder.length) {
        pickAnswer(idx);
        e.preventDefault();
      }
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 5 && num - 1 < state.optionOrder.length) {
        pickAnswer(num - 1);
        e.preventDefault();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      next();
      e.preventDefault();
    }
  } else if (state.screen === "start" && e.key === "Enter") {
    startQuiz();
    e.preventDefault();
  } else if (state.screen === "results" && e.key === "Enter") {
    if (state.mode === "weak") startWeakQuiz();
    else if (state.mode === "deck") startDeckQuiz(state.deckId);
    else if (state.mode === "mistakes") startMistakeQuiz(state.order);
    else startQuiz();
    e.preventDefault();
  }
});
