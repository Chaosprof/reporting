// All screen renderers and per-question visual builders.
const app = document.getElementById("app");

function render() {
  if (state.screen === "start")   return renderStart();
  if (state.screen === "quiz")    return renderQuiz();
  if (state.screen === "results") return renderResults();
}

function renderSubjectTabs() {
  return `
    <div class="tab-bar" id="tabBar">
      ${SUBJECTS.map(s => `
        <button class="tab ${state.subject === s.id ? "active" : ""}" data-subj="${escapeHtml(s.id)}">${escapeHtml(s.label)}</button>
      `).join("")}
    </div>
  `;
}

function wireSubjectTabs() {
  document.querySelectorAll("#tabBar .tab").forEach(b => {
    b.addEventListener("click", () => setSubject(b.dataset.subj));
  });
}

const QUESTION_SOURCE_LABELS = {
  AE1: "Additional Exercises 1",
  "AE1-AI": "AI",
  AE2: "Additional Exercises 2",
  "AE2-AI": "AI",
  AE3: "Additional Exercises 3",
  "AE3-AI": "AI",
  R1: "Recitation 1",
  "R1-AI": "AI",
  R2: "Recitation 2",
  "R2-AI": "AI",
  R3: "Recitation 3",
  "R3-AI": "AI",
  PE1: "Practice Exam 2026-1",
  PE2: "Practice Exam 2026-2",
  "BWL2-SM": "Probeprufung 2017",
  "BWL2-HRM": "Probeprufung 2017",
  "BWL2-ORG": "Probeprufung 2017",
  "BWL2-HRM25": "Probeprufung 2025",
  "BWL2-ORG25": "Probeprufung 2025",
  "BWL2-JUN17-SM": "Assessment Jun 2017",
  "BWL2-JUN17-HRM": "Assessment Jun 2017",
  "BWL2-JUN17-ORG": "Assessment Jun 2017",
  "BWL2-UBUNG": "Strategisches Management Übung/Klicker",
  "BWL2-MATH-AI": "AI",
};

function questionSource(q) {
  const statMatch = String(q.set || "").match(/^STAT-W(\d+)-(TEST|UEB)$/);
  if (statMatch) {
    return { label: `Woche ${statMatch[1]} · ${statMatch[2] === "TEST" ? "Test" : "Übungstest"}`, kind: "problemset" };
  }
  if (QUESTION_SOURCE_LABELS[q.set] === "AI" || String(q.set || "").endsWith("-AI")) {
    return { label: "AI", kind: "ai" };
  }
  const setStr = String(q.set || "");
  const bwlProbe = q.subject === "BWL II" && q.sourceYears && q.sourceYears.length && !setStr.startsWith("BWL2-JUN17") && setStr !== "BWL2-UBUNG";
  const label = bwlProbe
    ? `Probeprufung ${q.sourceYears.join(" + ")}`
    : QUESTION_SOURCE_LABELS[q.set] || (q.sourceYears && q.sourceYears.length
      ? `Probeprufung ${q.sourceYears.join(" + ")}`
      : "AI");
  return { label, kind: label === "AI" ? "ai" : "problemset" };
}

function renderSourceBadge(q) {
  const source = questionSource(q);
  return `<span class="source-tag ${source.kind}" title="Question source: ${escapeHtml(source.label)}">${escapeHtml(source.label)}</span>`;
}

function deckProgressId(deckOrId) {
  const deck = typeof deckOrId === "string" ? getDeckById(deckOrId) : deckOrId;
  return (deck && (deck.progressId || deck.id)) || String(deckOrId || "");
}

function deckBestResult(deckOrId) {
  return (state.data.deckBestResults || {})[deckProgressId(deckOrId)] || null;
}

function deckResultBadge(pct) {
  if (pct === 100) return { label: "Gold", cls: "gold" };
  if (pct >= 90) return { label: "Silver", cls: "silver" };
  if (pct >= 70) return { label: "Bronze", cls: "bronze" };
  return null;
}

function deckFillColor(pct) {
  if (pct === 100) return "rgba(215, 185, 79, 0.26)";
  if (pct >= 90) return "rgba(148, 163, 184, 0.24)";
  if (pct >= 70) return "rgba(217, 177, 124, 0.24)";
  return "rgba(220, 38, 38, 0.18)";
}

function renderDeckCards(decks, countLabel) {
  return `
    <div class="deck-grid" id="deckGrid">
      ${decks.map(d => {
        const n = deckPool(d).length;
        const best = deckBestResult(d);
        const hasBest = best && Number.isFinite(Number(best.pct));
        const pct = hasBest ? Math.max(0, Math.min(100, Math.round(Number(best.pct)))) : 0;
        const badge = hasBest ? deckResultBadge(pct) : null;
        return `<button class="deck-card" data-deck="${escapeHtml(d.id)}" style="--best-pct:${pct}%;--best-fill:${deckFillColor(pct)};" ${n ? "" : "disabled"}>
          <span class="deck-label">${escapeHtml(d.label)}</span>
          <span class="deck-sub">${escapeHtml(d.sub)}</span>
          <span class="deck-count">${n} ${escapeHtml(countLabel(n))}</span>
          <span class="deck-meta-row">
            <span class="deck-best">${hasBest ? `Best ${pct}%` : "Best --"}</span>
            ${badge ? `<span class="result-badge ${badge.cls}">${badge.label}</span>` : ""}
          </span>
        </button>`;
      }).join("")}
    </div>
  `;
}

function renderAccountingDeckSelector() {
  const decks = state.accountingDeckTab === "exam"
    ? activeExamPrepDecks()
    : state.accountingDeckTab === "problem"
    ? activeDecks()
    : topicDecks();
  return `
    <div class="deck-mode-tabs" id="deckModeTabs">
      ${ACCOUNTING_DECK_TABS.map(t => `
        <button class="deck-mode-tab ${state.accountingDeckTab === t.id ? "active" : ""}" data-deck-tab="${escapeHtml(t.id)}">${escapeHtml(t.label)}</button>
      `).join("")}
    </div>
    ${renderDeckCards(decks, n => `question${n !== 1 ? "s" : ""}`)}
  `;
}

function hasAnswerKey(q) {
  return Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length;
}

function renderBwlThemeSelector() {
  const allPapersSelected = state.selectedBwlPapers.size === BWL_PAPERS.length;
  const selectedCount = bwlSelectedPool().length;
  const paperWord = BWL_PAPERS.length === 1 ? "Prüfung" : "Prüfungen";
  const categoryOptions = [
    { id: "all", label: "Alle Themen" },
    ...BWL_CATEGORIES.map(c => ({ id: c, label: c })),
  ];

  return `
      <div class="bwl-selector">
        <div class="bwl-paper-toolbar">
          <button class="bwl-all-papers ${allPapersSelected ? "active" : ""}" id="bwlAllPapersBtn">
            Alle ${BWL_PAPERS.length} ${paperWord}
          </button>
        </div>
        <div class="bwl-paper-grid" id="bwlPaperGrid">
          ${BWL_PAPERS.map(paper => {
            const active = state.selectedBwlPapers.has(paper.id);
            const count = bwlPaperPool(paper.id, state.bwlCategory).length;
            return `<button class="bwl-paper-card ${active ? "active" : ""}" data-paper="${escapeHtml(paper.id)}">
              <span>
                <span class="bwl-paper-title">${escapeHtml(paper.label)}</span>
                <span class="bwl-paper-sub">${escapeHtml(paper.sub)}</span>
              </span>
              <span class="bwl-paper-count">${count} Frage${count !== 1 ? "n" : ""}</span>
            </button>`;
          }).join("")}
        </div>
        <div class="bwl-category-filter">
          <div class="bwl-category-label">Kategorie · ${selectedCount} Frage${selectedCount !== 1 ? "n" : ""} ausgewählt</div>
          <div class="bwl-category-row" id="bwlCategoryFilter">
            ${categoryOptions.map(option => {
              const count = bwlPoolFor(state.selectedBwlPapers, option.id).length;
              const disabled = option.id !== "all" && count === 0;
              return `<button class="bwl-category-chip ${state.bwlCategory === option.id ? "active" : ""}" data-category="${escapeHtml(option.id)}" ${disabled ? "disabled" : ""}>
                ${escapeHtml(option.label)} (${count})
              </button>`;
            }).join("")}
          </div>
        </div>
      </div>
  `;
}

function renderStart() {
  stopQuestionTimer();
  const subjectPool = subjectIndices(state.subject);
  const isBWL = state.subject === "BWL II";
  const isStats = state.subject === "Statistik";
  const isGerman = isBWL || isStats;
  const total = subjectPool.length;
  const selected = isBWL
    ? bwlSelectedPool().length
    : state.selectedCats.size === 0
    ? total
    : subjectPool.filter(i => state.selectedCats.has(QUESTIONS[i].category)).length;
  const weakPool = getWeakestPool(15);
  const weakCount = weakPool.length;
  const seenCount = totalQuestionsSeen();
  const hasStats = seenCount > 0;
  const decks = isBWL ? activeDecks().filter(d => d.id.startsWith("BWL2-MATH")) : [];

  const heroTitle = isBWL ? "BWL II Trainer" : isStats ? "Einführung Methoden & Statistik" : "Journal Entry Trainer";
  const heroSub   = isBWL ? "Strategie · HRM · Organisation" : isStats ? "Woche 1–7 · Tests & Übungstests" : "Debit the receiver · credit the giver";

  const sectionTitles = isBWL
    ? { decks: "Themenblöcke", timer: "Timer", timerHint: "(pro Frage, optional)", start: "Quiz starten", weakLabel: "Schwächste üben" }
    : isStats
    ? { decks: "Wochen", timer: "Timer", timerHint: "(pro Frage, optional)", start: "Quiz starten", weakLabel: "Schwächste üben" }
    : { decks: "Curated decks", timer: "Timer", timerHint: "(per question, optional)", start: "Start Quiz", weakLabel: "Practice your weakest" };

  const keyboardHint = isGerman
    ? `Tasten: <span class="kbd">A</span><span class="kbd">B</span><span class="kbd">C</span><span class="kbd">D</span><span class="kbd">E</span> für Antwort · <span class="kbd">Enter</span> / <span class="kbd">Space</span> für weiter`
    : `Keyboard: <span class="kbd">A</span><span class="kbd">B</span><span class="kbd">C</span><span class="kbd">D</span> to answer · <span class="kbd">Enter</span> / <span class="kbd">Space</span> for next`;

  app.innerHTML = `
    <div class="topbar">
      <span class="sync-pill ${state.syncStatus}" id="syncPill"><span class="dot"></span>${escapeHtml(syncStatusLabel(state.syncStatus))}</span>
      <button class="gear-btn" id="settingsBtn" title="Sync &amp; reset">⚙ Settings</button>
    </div>
    ${renderSubjectTabs()}
    <div class="hero">
      <h1>${escapeHtml(heroTitle)}</h1>
      <div class="sub">${escapeHtml(heroSub)}</div>
    </div>
    <div class="start-card">
      ${isBWL ? `
      <h2>${escapeHtml(sectionTitles.decks)}</h2>
      ${renderBwlThemeSelector()}
      ${decks.length ? `
      <h2>Practice decks</h2>
      ${renderDeckCards(decks, n => `Frage${n !== 1 ? "n" : ""}`)}
      ` : ""}
      ` : isStats ? `
      <h2>${escapeHtml(sectionTitles.decks)}</h2>
      ${renderDeckCards(activeDecks(), n => `Frage${n !== 1 ? "n" : ""}`)}
      ` : `
      <h2>${escapeHtml(sectionTitles.decks)}</h2>
      ${renderAccountingDeckSelector()}
      `}
      <h2>${escapeHtml(sectionTitles.timer)} <span style="font-weight:400;color:var(--faint);font-size:0.78rem;font-family:var(--font-sans);">${escapeHtml(sectionTitles.timerHint)}</span></h2>
      <div class="timer-control" id="timerControl">
        ${TIMER_OPTIONS.map(t => {
          const label = isGerman && t.seconds === 0 ? "Ohne Timer" : t.label;
          return `<button class="timer-chip ${state.timerSeconds === t.seconds ? "active" : ""}" data-seconds="${t.seconds}">${escapeHtml(label)}</button>`;
        }).join("")}
      </div>
      ${isBWL || isStats ? `
      <button class="btn btn-primary" id="startBtn" ${selected ? "" : "disabled"}>
        ${escapeHtml(sectionTitles.start)} · ${selected} ${isGerman ? "Frage" + (selected !== 1 ? "n" : "") : "question" + (selected !== 1 ? "s" : "")}
      </button>
      ` : ""}
      <div class="secondary-action-row">
        <button class="btn btn-weak" id="weakBtn" ${hasStats ? "" : "disabled"}>
          <span class="label">
            <span>${escapeHtml(sectionTitles.weakLabel)} ${weakCount || 0}</span>
            <span class="meta">${hasStats
              ? (isGerman
                  ? `Aus ${seenCount} versuchten · ${totalAttempts()} Antworten insgesamt`
                  : `Drawn from ${seenCount} attempted · ${totalAttempts()} total answers`)
              : (isGerman
                  ? "Erst ein paar Fragen beantworten, um ein Schwächenprofil aufzubauen"
                  : "Answer some questions first to build a weakness profile")}</span>
          </span>
          <span class="arrow">→</span>
        </button>
      </div>
      <div style="text-align:center;margin-top:18px;color:var(--faint);font-size:0.72rem;letter-spacing:0.04em;">
        ${keyboardHint}
      </div>
    </div>
    ${state.settingsOpen ? renderSettingsModal() : ""}
  `;
  wireSubjectTabs();
  document.querySelectorAll("#deckModeTabs .deck-mode-tab").forEach(b => {
    b.addEventListener("click", () => {
      state.accountingDeckTab = b.dataset.deckTab || "exam";
      render();
    });
  });
  document.querySelectorAll("#timerControl .timer-chip").forEach(b => {
    b.addEventListener("click", () => setTimerSeconds(parseInt(b.dataset.seconds, 10)));
  });
  document.getElementById("startBtn")?.addEventListener("click", () => startQuiz());
  document.getElementById("bwlAllPapersBtn")?.addEventListener("click", () => {
    state.selectedBwlPapers = new Set(BWL_PAPERS.map(p => p.id));
    render();
  });
  document.querySelectorAll("#bwlPaperGrid .bwl-paper-card").forEach(b => {
    b.addEventListener("click", () => {
      const paper = b.dataset.paper;
      if (state.selectedBwlPapers.has(paper)) state.selectedBwlPapers.delete(paper);
      else state.selectedBwlPapers.add(paper);
      render();
    });
  });
  document.querySelectorAll("#bwlCategoryFilter .bwl-category-chip").forEach(b => {
    b.addEventListener("click", () => {
      if (b.disabled) return;
      state.bwlCategory = b.dataset.category;
      render();
    });
  });
  document.querySelectorAll("#deckGrid .deck-card").forEach(b => {
    b.addEventListener("click", () => {
      if (b.disabled) return;
      startDeckQuiz(b.dataset.deck);
    });
  });
  document.getElementById("weakBtn").addEventListener("click", () => {
    if (!hasStats) return;
    startWeakQuiz();
  });
  document.getElementById("settingsBtn").addEventListener("click", () => {
    state.settingsOpen = true;
    render();
  });
  if (state.settingsOpen) wireSettingsModal();
}

function syncStatusLabel(s) {
  if (s === "synced")    return "Synced";
  if (s === "saving")    return "Saving…";
  if (s === "error")     return "Sync error";
  if (s === "connected") return "Connected";
  return "Local only";
}

function setSyncStatus(s, errorMessage = "") {
  state.syncStatus = s;
  state.syncError = s === "error" ? String(errorMessage || "Sync failed. Check the token and try again.") : "";
  const el = document.getElementById("syncPill");
  if (el) {
    el.className = "sync-pill " + s;
    el.innerHTML = `<span class="dot"></span>${escapeHtml(syncStatusLabel(s))}`;
  }
}

function syncErrorText(e) {
  const msg = e && e.message ? e.message : String(e || "Unknown sync error");
  if (msg.includes("401")) return `${msg}. The token was rejected. Generate a new token and paste only the token value.`;
  if (msg.includes("403")) return `${msg}. Use a classic token with only the gist scope, or a fine-grained token with Account permissions -> Gists set to Write if GitHub shows that option.`;
  if (msg.includes("404")) return `${msg}. The saved Gist may no longer exist or this token cannot access it. Disconnect and sync again to create a new private Gist.`;
  return msg;
}

function isGistNotFoundError(e) {
  return !!(e && e.message && e.message.includes("GitHub API 404"));
}

function renderSettingsModal() {
  const pat = getPat();
  const gistId = getGistId();
  const seen = totalQuestionsSeen();
  const attempts = totalAttempts();
  return `
    <div class="modal-backdrop" id="settingsBackdrop">
      <div class="modal" id="settingsModal">
        <h2>Settings</h2>
        <div class="modal-sub">Cloud sync, progress, and reset.</div>

        <div class="modal-section">
          <span class="modal-label">Cloud sync (optional)</span>
          <p class="modal-help">
            Save your progress to a private GitHub Gist so you can resume on any device.
            Recommended: create a classic token at
            <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener">github.com/settings/tokens/new</a>
            and check only the <b>gist</b> scope. A fine-grained token can also work if GitHub shows
            <b>Account permissions -> Gists</b> and lets you set it to <b>Write</b>.
          </p>
          <input type="password" id="patInput" placeholder="github_pat_… or ghp_…" value="${escapeHtml(pat)}" autocomplete="off" spellcheck="false">
          <div class="modal-row">
            <button class="btn btn-primary" id="savePatBtn">Save &amp; sync</button>
            ${pat ? `<button class="btn btn-ghost" id="disconnectBtn">Disconnect</button>` : ""}
          </div>
          ${gistId ? `<div class="modal-info">Gist: ${escapeHtml(gistId.slice(0, 12))}…</div>` : ""}
          ${state.syncError ? `<div class="modal-info error">${escapeHtml(state.syncError)}</div>` : ""}
        </div>

        <div class="modal-section">
          <span class="modal-label">Local progress</span>
          <p class="modal-help">${seen} question${seen===1?"":"s"} attempted · ${attempts} total answer${attempts===1?"":"s"} recorded.</p>
          <div class="modal-row">
            <button class="btn danger-btn" id="resetBtn">Reset all progress</button>
          </div>
        </div>

        <div class="modal-close-row">
          <button class="btn btn-ghost" id="closeSettingsBtn">Close</button>
        </div>
      </div>
    </div>
  `;
}

function wireSettingsModal() {
  document.getElementById("settingsBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "settingsBackdrop") {
      state.settingsOpen = false;
      render();
    }
  });
  document.getElementById("closeSettingsBtn").addEventListener("click", () => {
    state.settingsOpen = false;
    render();
  });
  document.getElementById("savePatBtn").addEventListener("click", async () => {
    const v = normalizePat(document.getElementById("patInput").value);
    if (!v) return;
    const oldPat = getPat();
    const oldGistId = getGistId();
    setPat(v);
    setSyncStatus("saving");
    try {
      // Try to load any existing gist; merge with local data
      let remote = null;
      try {
        remote = await loadGistData();
      } catch (e) {
        if (!isGistNotFoundError(e)) throw e;
        setGistId("");
      }
      if (remote) state.data = mergeData(state.data, remote);
      state.data.lastUpdated = Date.now();
      // Save merged result back
      await saveGistData(state.data);
      saveLocalData(state.data);
      setSyncStatus("synced");
      state.settingsOpen = false;
    } catch (e) {
      console.warn(e);
      setPat(oldPat);
      setGistId(oldGistId);
      setSyncStatus("error", syncErrorText(e));
    }
    render();
  });
  const disc = document.getElementById("disconnectBtn");
  if (disc) disc.addEventListener("click", () => {
    setPat("");
    setGistId("");
    setSyncStatus("local");
    state.settingsOpen = false;
    render();
  });
  document.getElementById("resetBtn").addEventListener("click", async () => {
    if (!confirm("Reset all local progress? This cannot be undone.")) return;
    state.data = resetProgressData();
    saveLocalData(state.data);
    setSyncStatus(getPat() ? "saving" : "local");
    if (getPat()) {
      try {
        await saveGistData(state.data);
        setSyncStatus("synced");
      } catch (e) {
        console.warn(e);
        setSyncStatus("error", syncErrorText(e));
      }
    }
    state.settingsOpen = state.syncStatus === "error";
    render();
  });
}

function startWeakQuiz() {
  stopQuestionTimer();
  getAudioCtx();
  const pool = getWeakestPool(15);
  if (!pool.length) return;
  state.mode = "weak";
  state.deckId = null;
  state.order = shuffle(pool);
  state.idx = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.resultRecorded = false;
  state.wrong = [];
  state.screen = "quiz";
  loadCurrent();
  render();
}

function startDeckQuiz(deckId) {
  stopQuestionTimer();
  getAudioCtx();
  const deck = getDeckById(deckId);
  if (!deck) return;
  const pool = deckPool(deck);
  if (!pool.length) return;
  state.mode = "deck";
  state.deckId = deckId;
  state.order = shuffle(pool);
  state.idx = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.resultRecorded = false;
  state.wrong = [];
  state.screen = "quiz";
  loadCurrent();
  render();
}

function startMistakeQuiz(questionIndices) {
  stopQuestionTimer();
  getAudioCtx();
  const pool = [...new Set(questionIndices)]
    .filter(i => Number.isInteger(i) && QUESTIONS[i] && hasAnswerKey(QUESTIONS[i]));
  if (!pool.length) return;
  state.mode = "mistakes";
  state.order = shuffle(pool);
  state.idx = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.resultRecorded = false;
  state.wrong = [];
  state.screen = "quiz";
  loadCurrent();
  render();
}

function startQuiz() {
  stopQuestionTimer();
  getAudioCtx();
  const subjectPool = subjectIndices(state.subject);
  const pool = state.subject === "BWL II"
    ? bwlSelectedPool()
    : state.selectedCats.size === 0
    ? subjectPool
    : subjectPool.filter(i => state.selectedCats.has(QUESTIONS[i].category));
  if (!pool.length) return;
  state.mode = state.subject === "BWL II" ? "bwl-selection" : "all";
  state.deckId = null;
  state.order = shuffle(pool);
  state.idx = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.resultRecorded = false;
  state.wrong = [];
  state.screen = "quiz";
  loadCurrent();
  render();
}

function loadCurrent() {
  state.answered = false;
  state.picked = -1;
  const q = QUESTIONS[state.order[state.idx]];
  const orderedOptions = q.options.map((_, i) => i);
  state.optionOrder = (isProducerRentQuestion(q) || isValueMapQuestion(q)) ? orderedOptions : shuffle(orderedOptions);
}

function renderQuiz() {
  const q = QUESTIONS[state.order[state.idx]];
  const total = state.order.length;
  const pct = Math.round((state.idx / total) * 100);
  const prompt = questionPromptText(q);

  app.innerHTML = `
    ${renderSubjectTabs()}
    <div class="meta-row">
      <div>Question ${state.idx + 1} of ${total}</div>
      <div>
        ${state.timerSeconds ? `<span class="timer-pill" id="timerPill">${formatTimer(state.timerSeconds)}</span>` : ""}
        <span class="score-pill">✓ ${state.score}</span>
        ${state.streak > 1 ? `<span class="streak-pill">🔥 ${state.streak}</span>` : ""}
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="qcard">
      <div class="q-meta">
        <span class="cat-tag">${escapeHtml(q.category)}</span>
        ${renderSourceBadge(q)}
      </div>
      <div class="question-text">${renderRichText(prompt)}</div>
      ${isProducerRentQuestion(q) || isValueMapQuestion(q) ? "" : renderQuestionVisual(q.visual)}
      ${renderQuestionExtras(q)}
      ${renderQuestionOptions(q)}
      <div id="feedbackSlot"></div>
    </div>
  `;

  wireSubjectTabs();
  document.querySelectorAll("#options .option").forEach(b => {
    b.addEventListener("click", () => pickAnswer(parseInt(b.dataset.i, 10)));
  });
  startQuestionTimer();
}

function renderQuestionOptions(q) {
  if (isProducerRentQuestion(q)) return renderProducerRentOptions(q);
  if (isValueMapQuestion(q)) return renderValueMapOptions(q);
  return `
    <div class="options" id="options">
      ${state.optionOrder.map((origIdx, displayIdx) => {
        const letter = "ABCDE"[displayIdx];
        return `<button class="option" data-i="${displayIdx}">
          <span class="option-letter">${letter}</span>
          <span>${renderRichText(q.options[origIdx])}</span>
        </button>`;
      }).join("")}
    </div>
  `;
}

function isProducerRentQuestion(q) {
  return rentScenariosForQuestion(q).length === q.options.length && q.options.length > 0;
}

function isValueMapQuestion(q) {
  return q.visual === "ubung-value-map-diagrams";
}

function producerRentScenarios() {
  return [
    { label: "a", f1: { b: 10, p: 8, k: 4 }, f2: { b: 10, p: 4, k: 2 } },
    { label: "b", f1: { b: 10, p: 8, k: 4 }, f2: { b: 8, p: 5, k: 2 } },
    { label: "c", f1: { b: 8, p: 6, k: 2 }, f2: { b: 10, p: 9, k: 5 } },
    { label: "d", f1: { b: 6, p: 6, k: 2 }, f2: { b: 10, p: 6, k: 4 } },
    { label: "e", f1: { b: 10, p: 8, k: 4 }, f2: { b: 10, p: 6, k: 4 } },
  ];
}

function aiProducerRentScenarios() {
  return [
    { label: "a", f1: { b: 12, p: 10, k: 5 }, f2: { b: 12, p: 6, k: 3 } },
    { label: "b", f1: { b: 12, p: 9, k: 5 }, f2: { b: 10, p: 6, k: 3 } },
    { label: "c", f1: { b: 12, p: 9, k: 3 }, f2: { b: 14, p: 13, k: 7 } },
    { label: "d", f1: { b: 8, p: 8, k: 3 }, f2: { b: 13, p: 8, k: 5 } },
    { label: "e", f1: { b: 12, p: 9, k: 5 }, f2: { b: 12, p: 7, k: 5 } },
  ];
}

function rentScenariosForQuestion(q) {
  if (Array.isArray(q.rentScenarios)) return q.rentScenarios;
  if (q.visual === "jun17-sm-q5-producer-rent") return producerRentScenarios();
  if (q.visual === "ai-math-q5-producer-rent") return aiProducerRentScenarios();
  return [];
}

function renderProducerRentOptions(q) {
  const scenarios = rentScenariosForQuestion(q);
  return `
    <div class="options rent-options" id="options">
      ${state.optionOrder.map((origIdx, displayIdx) => `
        <button class="option rent-option" data-i="${displayIdx}" aria-label="${escapeHtml(q.options[origIdx])}">
          ${renderRentScenario(scenarios[origIdx])}
        </button>
      `).join("")}
    </div>
  `;
}

// Data-driven extras (used by the Statistik decks): an optional image, a code
// block, and/or a data table attached directly to the question JSON.
function renderQuestionExtras(q) {
  let html = "";
  if (q.image) html += renderQuestionImage(q.image);
  if (q.code)  html += renderQuestionCode(q.code);
  if (q.table) html += renderQuestionTable(q.table);
  return html;
}

function renderQuestionImage(name) {
  const src = `data/visuals/${name}`;
  return `
    <div class="question-visual source-question-visual">
      <img class="source-visual-image" src="${escapeHtml(src)}" alt=""
           onerror="this.parentElement.style.display='none'">
    </div>
  `;
}

function renderQuestionCode(code) {
  // Plain escaping (not renderRichText) so code is shown verbatim, and <pre>
  // preserves the indentation that .question-text's pre-line would collapse.
  return `<pre class="code-block"><code>${escapeHtml(code)}</code></pre>`;
}

function renderQuestionTable(t) {
  const title = t.title ? `<div class="q-table-title">${escapeHtml(t.title)}</div>` : "";
  const meta = Array.isArray(t.meta)
    ? t.meta.map(m => `<div class="q-table-meta">${escapeHtml(m)}</div>`).join("")
    : "";
  const head = Array.isArray(t.headers)
    ? `<thead><tr>${t.headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`
    : "";
  const body = `<tbody>${(t.rows || []).map(r =>
    `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  const note = t.note ? `<div class="q-table-note">${escapeHtml(t.note)}</div>` : "";
  return `
    <div class="question-visual q-data-table-wrap">
      ${title}${meta}
      <table class="q-data-table">${head}${body}</table>
      ${note}
    </div>
  `;
}

function renderQuestionVisual(visual) {
  if (!visual) return "";
  if (visual === "jun17-sm-q5-producer-rent") return renderProducerRentVisual();
  if (visual === "jun17-sm-q8-indifference") return renderSourceVisualImage("data/visuals/math-diagrams-jun17-indifference.png", "Indifferenzkurve mit Produkten X und Y");
  if (visual === "jun17-sm-q14-experience") return renderSourceVisualImage("data/visuals/math-diagrams-jun17-experience.png", "Erfahrungskurve mit kumulierter Produktionsmenge");
  if (visual === "jun17-sm-q17-adiwas-table") return renderAdidasValueTable();
  if (visual === "ae2-losone-securities-table") return renderLosoneSecuritiesTable();
  if (visual === "ae2-grand-petit-table") return renderGrandPetitTable();
  if (visual === "ae2-ai-bern-uri-table") return renderBernUriTable();
  if (visual === "ae2-ai-morges-securities-table") return renderMorgesSecuritiesTable();
  if (visual === "ae2-ai-rigi-pilatus-table") return renderRigiPilatusTable();
  if (visual === "ae2-ai-zug-sarnen-table") return renderZugSarnenTable();
  if (visual === "ae3-venti-grande-fv-table") return renderVentiGrandeFairValueTable();
  if (visual === "ae3-venti-grande-equity-table") return renderVentiGrandeEquityTable();
  if (visual === "ae3-ai-nova-orbit-fv-table") return renderNovaOrbitFairValueTable();
  if (visual === "ae3-ai-helvetia-ticino-equity-table") return renderHelvetiaTicinoEquityTable();
  if (visual === "ae3-ai-bern-lugano-buildings-table") return renderBernLuganoBuildingsTable();
  if (visual === "ae1-malagny-statement-table") return renderMalagnyStatementTable();
  if (visual === "ae1-ai-sion-statement-table") return renderSionStatementTable();
  if (visual === "r2-zurich-basel-table") return renderZurichBaselTable();
  if (visual === "r2-botkins-volkerson-table") return renderBotkinsVolkersonTable();
  if (visual === "r2-ai-st-gallen-thun-table") return renderStGallenThunTable();
  if (visual === "r2-ai-geneva-fribourg-table") return renderGenevaFribourgTable();
  if (visual === "r2-ai-lucerne-zug-table") return renderLucerneZugTable();
  if (visual === "r2-ai-parent-subco-table") return renderParentSubCoTable();
  if (visual === "r2-ai-arosa-davos-table") return renderArosaDavosTable();
  if (visual === "r2-ai-montreux-vevey-table") return renderMontreuxVeveyTable();
  if (visual === "r2-ai-lausanne-share-issue-table") return renderLausanneShareIssueTable();
  if (visual === "r3-hurley-acquisition-tables") return renderHurleyAcquisitionTables();
  if (visual === "ai-math-q5-producer-rent") return renderAiProducerRentVisual();
  if (visual === "ai-math-q8-indifference") return renderAiIndifferenceVisual();
  if (visual === "ai-math-q14-experience") return renderAiExperienceVisual();
  if (visual === "ai-math-q17-value-table") return renderVeloProValueTable();
  if (visual === "ai-math-value-alpenmilk-table") return renderAlpenMilkValueTable();
  if (visual === "ai-math-value-brewly-table") return renderBrewlyValueTable();
  if (visual === "ai-math-value-solaris-table") return renderSolarisValueTable();
  if (visual === "ai-math-value-chocoline-table") return renderChocoLineValueTable();
  if (visual === "ai-math-value-bikemotion-table") return renderBikeMotionValueTable();
  if (visual === "ai-math-value-mediglass-table") return renderMediGlassValueTable();
  if (visual === "ai-math-value-timberhaus-table") return renderTimberHausValueTable();
  if (visual === "betflix-organigram") return renderBetflixOrganigram();
  if (visual === "fs25-sm-q6-branchen") return renderFs25BranchenSourceVisual();
  if (visual === "fs25-sm-q13-effizienzgrenze") return renderSourceVisualImage("data/visuals/math-diagrams-effizienzgrenze.png", "Effizienzgrenze mit drei Produktbündeln X, Y und Z");
  if (visual === "fs25-sm-q15-oilster-table") return renderOilsterValueTable();
  if (visual === "tk-verbundeffekte-table") return renderVerbundeffekteTable();
  if (visual === "ubung-luxusuhren-table") return renderLuxusuhrenTable();
  if (visual === "ubung-value-map-diagrams") return renderValueMapDiagrams();
  if (visual === "ubung-geschaftszahlen-table") return renderGeschaftszahlenTable();
  return "";
}

function renderSourceVisualImage(src, alt) {
  return `
    <div class="question-visual source-question-visual" aria-label="${escapeHtml(alt)}">
      <img class="source-visual-image" src="${src}" alt="${escapeHtml(alt)}">
    </div>
  `;
}

function renderFs25BranchenSourceVisual() {
  return `
    <div class="question-visual source-question-visual" aria-label="Zwei Branchen mit Durchschnittskosten und Produktionsmengen">
      <div class="source-visual-grid">
        <img class="source-visual-image" src="data/visuals/math-diagrams-branche-ab.png" alt="Branche 1 mit Durchschnittskosten und Produktionsmengen">
        <img class="source-visual-image" src="data/visuals/math-diagrams-branche-xy.png" alt="Branche 2 mit Durchschnittskosten und Produktionsmengen">
      </div>
    </div>
  `;
}

function renderBetflixOrganigram() {
  const box = (x, y, w, h, label) => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="#111" stroke-width="1.6" rx="2"/>
    <text x="${x + w/2}" y="${y + h/2 + 5}" text-anchor="middle" font-size="14" font-weight="600" font-family="var(--font-sans)">${label}</text>
  `;
  return `
    <div class="question-visual" aria-label="Organigramm der Betflix AG">
      <svg viewBox="0 0 760 360" role="img" style="max-width: 100%; height: auto;">
        ${box(305, 10, 150, 38, "Verwaltungsrat")}
        ${box(330, 78, 100, 38, "CEO")}
        ${box(20, 158, 230, 38, "Unternehmenskommunikation")}
        ${box(510, 158, 230, 38, "Unternehmensentwicklung")}
        ${box(30, 280, 130, 60, "HR")}
        ${box(195, 280, 170, 60, "Forschung & Entwicklung")}
        ${box(400, 280, 130, 60, "Vertrieb")}
        ${box(565, 280, 165, 60, "Controlling")}

        <line x1="380" y1="48" x2="380" y2="78" stroke="#111" stroke-width="1.6"/>
        <line x1="380" y1="116" x2="380" y2="260" stroke="#111" stroke-width="1.6"/>
        <line x1="250" y1="177" x2="510" y2="177" stroke="#111" stroke-width="1.6"/>

        <line x1="95"  y1="260" x2="660" y2="260" stroke="#111" stroke-width="1.6"/>
        <line x1="95"  y1="260" x2="95"  y2="280" stroke="#111" stroke-width="1.6"/>
        <line x1="280" y1="260" x2="280" y2="280" stroke="#111" stroke-width="1.6"/>
        <line x1="465" y1="260" x2="465" y2="280" stroke="#111" stroke-width="1.6"/>
        <line x1="647" y1="260" x2="647" y2="280" stroke="#111" stroke-width="1.6"/>
      </svg>
    </div>
  `;
}

function renderFs25BranchenVisual() {
  const sub = (s) => `<tspan baseline-shift="sub" font-size="10">${s}</tspan>`;

  const axes = (markerId) => `
    <line x1="70" y1="238" x2="372" y2="238" stroke="#111" stroke-width="1.7" marker-end="url(#${markerId})"/>
    <line x1="70" y1="238" x2="70"  y2="42"  stroke="#111" stroke-width="1.7" marker-end="url(#${markerId})"/>
    <text x="62" y="45" text-anchor="end" font-size="15" font-weight="700">DK</text>
    <text x="365" y="260" text-anchor="middle" font-size="13" font-weight="700">Q${sub("Produkt")}</text>
  `;

  const branche1 = `
    <svg viewBox="0 0 420 286" role="img" aria-label="Branche 1: Firma A und Firma B">
      <defs>
        <marker id="arr-q6-1" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#111"/>
        </marker>
      </defs>
      <text x="210" y="24" text-anchor="middle" font-size="18" font-weight="700">Branche 1</text>
      ${axes("arr-q6-1")}
      <path d="M82 52 C115 52, 138 86, 148 91 C220 117, 295 134, 360 138" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/>
      <path d="M82 122 C175 122, 235 169, 248 174 C295 192, 335 200, 360 202" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/>
      <text x="258" y="112" font-size="12" font-weight="700">DK(Q) Firma A</text>
      <text x="262" y="190" font-size="12" font-weight="700">DK(Q) Firma B</text>
      <line x1="70" y1="91" x2="148" y2="91" stroke="#6b7280" stroke-width="1.1" stroke-dasharray="5 5"/>
      <line x1="148" y1="91" x2="148" y2="238" stroke="#6b7280" stroke-width="1.1" stroke-dasharray="5 5"/>
      <circle cx="148" cy="91" r="3.5" fill="#111"/>
      <text x="62" y="95" text-anchor="end" font-size="12" font-weight="700">DK${sub("A")}</text>
      <text x="148" y="260" text-anchor="middle" font-size="12" font-weight="700">Q${sub("A")}</text>
      <line x1="70" y1="174" x2="248" y2="174" stroke="#6b7280" stroke-width="1.1" stroke-dasharray="5 5"/>
      <line x1="248" y1="174" x2="248" y2="238" stroke="#6b7280" stroke-width="1.1" stroke-dasharray="5 5"/>
      <circle cx="248" cy="174" r="3.5" fill="#111"/>
      <text x="62" y="178" text-anchor="end" font-size="12" font-weight="700">DK${sub("B")}</text>
      <text x="248" y="260" text-anchor="middle" font-size="12" font-weight="700">Q${sub("B")}</text>
    </svg>
  `;

  const branche2 = `
    <svg viewBox="0 0 420 286" role="img" aria-label="Branche 2: Firma X und Firma Y">
      <defs>
        <marker id="arr-q6-2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#111"/>
        </marker>
      </defs>
      <text x="210" y="24" text-anchor="middle" font-size="18" font-weight="700">Branche 2</text>
      ${axes("arr-q6-2")}
      <path d="M82 80 C150 80, 218 128, 232 133 C285 152, 335 162, 360 164" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/>
      <text x="210" y="108" font-size="12" font-weight="700">DK(Q) Firma X = DK(Q) Firma Y</text>
      <line x1="70" y1="133" x2="232" y2="133" stroke="#6b7280" stroke-width="1.1" stroke-dasharray="5 5"/>
      <line x1="232" y1="133" x2="232" y2="238" stroke="#6b7280" stroke-width="1.1" stroke-dasharray="5 5"/>
      <circle cx="232" cy="133" r="3.5" fill="#111"/>
      <text x="62" y="137" text-anchor="end" font-size="12" font-weight="700">DK${sub("X")} = DK${sub("Y")}</text>
      <text x="232" y="260" text-anchor="middle" font-size="12" font-weight="700">Q${sub("X")} = Q${sub("Y")}</text>
    </svg>
  `;

  return `
    <div class="question-visual" aria-label="Zwei Branchen mit Durchschnittskosten und Produktionsmengen">
      <div class="branchen-visual-grid">
        <div class="branchen-panel">${branche1}</div>
        <div class="branchen-panel">${branche2}</div>
      </div>
    </div>
  `;
}

function renderFs25EffizienzgrenzeVisual() {
  return `
    <div class="question-visual" aria-label="Effizienzgrenze mit drei Produktbündeln X, Y und Z">
      <svg viewBox="0 0 860 450" role="img" style="max-width: 100%; height: auto;">
        <defs>
          <marker id="arr-q13" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#111"/>
          </marker>
        </defs>
        <line x1="95" y1="370" x2="690" y2="370" stroke="#111" stroke-width="2.2" marker-end="url(#arr-q13)"/>
        <line x1="95" y1="370" x2="95"  y2="45"  stroke="#111" stroke-width="2.2" marker-end="url(#arr-q13)"/>
        <text x="58" y="34"  font-size="20" font-weight="700">DK, P</text>
        <text x="704" y="397" font-size="20" font-weight="700">Qualität</text>

        <!-- Horizontal reference lines as in the Probepruefung graphic. -->
        <line x1="95" y1="80"  x2="335" y2="80"  stroke="#111" stroke-width="1.8" stroke-dasharray="7 7"/>
        <line x1="95" y1="140" x2="500" y2="140" stroke="#111" stroke-width="1.8" stroke-dasharray="7 7"/>
        <line x1="95" y1="205" x2="335" y2="205" stroke="#111" stroke-width="1.8" stroke-dasharray="7 7"/>
        <line x1="95" y1="325" x2="335" y2="325" stroke="#111" stroke-width="1.8" stroke-dasharray="7 7"/>
        <line x1="335" y1="80"  x2="335" y2="370" stroke="#111" stroke-width="1.8" stroke-dasharray="7 7"/>
        <line x1="500" y1="140" x2="500" y2="370" stroke="#111" stroke-width="1.8" stroke-dasharray="7 7"/>

        <!-- Indifferenzkurve from the source figure: X and Z lie on the same curve. -->
        <path d="M245 287 C275 265, 285 230, 335 205 C395 175, 450 150, 500 140 C540 132, 585 115, 610 110"
              fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>
        <text x="626" y="128" font-size="20" font-weight="700">Indifferenzkurve</text>

        <!-- Effizienzgrenze from the source figure: lower curved frontier, steepening to the right. -->
        <path d="M270 326 C342 326 412 318 462 292 C503 271 529 235 552 190 C568 160 586 130 604 102"
              fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>
        <text x="572" y="250" font-size="20" font-weight="700">Effizienzgrenze</text>

        <circle cx="335" cy="80"  r="7" fill="#111"/>
        <circle cx="500" cy="140" r="7" fill="#111"/>
        <circle cx="335" cy="205" r="7" fill="#111"/>

        <text x="348" y="70"  font-size="20" font-weight="700">Y</text>
        <text x="506" y="126" font-size="20" font-weight="700">Z</text>
        <text x="346" y="224" font-size="20" font-weight="700">X</text>

        <text x="84" y="86"  text-anchor="end" font-size="18" font-weight="700">P<tspan baseline-shift="sub" font-size="12">Y</tspan></text>
        <text x="84" y="146" text-anchor="end" font-size="18" font-weight="700">P<tspan baseline-shift="sub" font-size="12">Z</tspan></text>
        <text x="84" y="211" text-anchor="end" font-size="18" font-weight="700">P<tspan baseline-shift="sub" font-size="12">X</tspan> = DK<tspan baseline-shift="sub" font-size="12">Y,Z</tspan></text>
        <text x="84" y="331" text-anchor="end" font-size="18" font-weight="700">DK<tspan baseline-shift="sub" font-size="12">X</tspan></text>

        <text x="335" y="405" text-anchor="middle" font-size="18" font-weight="700">Q<tspan baseline-shift="sub" font-size="12">X,Y</tspan></text>
        <text x="500" y="405" text-anchor="middle" font-size="18" font-weight="700">Q<tspan baseline-shift="sub" font-size="12">Z</tspan></text>
      </svg>
    </div>
  `;
}

function renderOilsterValueTable() {
  return `
    <div class="question-visual" aria-label="Wertschöpfungskette Oilster">
      <table class="value-table">
        <thead>
          <tr>
            <th>Stufe</th>
            <th>Variable Stückkosten pro Stufe</th>
            <th>Fixkosten pro Stufe</th>
            <th>Verarbeitete Menge</th>
            <th>Verkaufte Menge</th>
            <th>Verkaufspreis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1. Förderung Rohöl, Absatz Rohölmarkt</td>
            <td>1</td>
            <td>50'000</td>
            <td>100'000</td>
            <td>20'000</td>
            <td>2</td>
          </tr>
          <tr>
            <td>2. Herstellung Benzin, Absatz Grossverteiler</td>
            <td>3</td>
            <td>20'000</td>
            <td>80'000</td>
            <td>30'000</td>
            <td>8</td>
          </tr>
          <tr>
            <td>3. Distribution Benzin, Absatz eigene Tankstellen</td>
            <td>2</td>
            <td>30'000</td>
            <td>50'000</td>
            <td>50'000</td>
            <td>12</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderDataTable(ariaLabel, headers, rows) {
  return `
    <div class="question-visual" aria-label="${escapeHtml(ariaLabel)}">
      <table class="value-table">
        <thead>
          <tr>${headers.map(h => `<th>${renderRichText(h)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>${row.map(cell => `<td>${renderRichText(cell)}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderVerbundeffekteTable() {
  return `
    <div class="question-visual" aria-label="Totalkosten TK(Qx, Qy) für zwei Güter X und Y">
      <table class="value-table" style="min-width: 360px; max-width: 520px;">
        <thead>
          <tr>
            <th>${renderRichText("TK(Qx, Qy)")}</th>
            <th>Wert</th>
            <th>${renderRichText("TK(Qx, Qy)")}</th>
            <th>Wert</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>TK(5, 0)</td>
            <td>150</td>
            <td>TK(0, 50)</td>
            <td>100</td>
          </tr>
          <tr>
            <td>TK(10, 0)</td>
            <td>320</td>
            <td>TK(0, 100)</td>
            <td>210</td>
          </tr>
          <tr>
            <td>TK(5, 50)</td>
            <td>240</td>
            <td>TK(10, 100)</td>
            <td>500</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderLuxusuhrenTable() {
  return `
    <div class="question-visual" aria-label="Kosten, Wertschätzung und Preise der fünf Luxusuhren-Firmen">
      <table class="value-table" style="min-width: 380px; max-width: 560px;">
        <thead>
          <tr>
            <th>Firma</th>
            <th>A</th>
            <th>B</th>
            <th>C</th>
            <th>D</th>
            <th>E</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>K (Kosten)</td>
            <td>3</td>
            <td>4</td>
            <td>4</td>
            <td>5</td>
            <td>6</td>
          </tr>
          <tr>
            <td>B (Wertschätzung)</td>
            <td>6</td>
            <td>9</td>
            <td>7</td>
            <td>8</td>
            <td>10</td>
          </tr>
          <tr>
            <td>P (Preis)</td>
            <td>5</td>
            <td>6</td>
            <td>5</td>
            <td>7</td>
            <td>7</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderValueMapDiagrams() {
  return `
    <div class="question-visual" aria-label="Fünf Value-Map-Diagramme mit Produkt A und Produkt X">
      <div class="value-map-options">
        ${valueMapScenarios().map((_, i) => renderValueMapChoice(i)).join("")}
      </div>
    </div>
  `;
}

function renderGeschaftszahlenTable() {
  return `
    <div class="question-visual" aria-label="Geschäftszahlen 2025 von TECH und MID">
      <table class="value-table" style="min-width: 420px; max-width: 640px;">
        <thead>
          <tr>
            <th colspan="2"></th>
            <th>2025 (CHF Mio.)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td rowspan="4" style="vertical-align: middle; font-weight: 700; text-align: center;">TECH</td>
            <td>Umsatz</td>
            <td>15'000</td>
          </tr>
          <tr>
            <td>Herstellungskosten</td>
            <td>9'000</td>
          </tr>
          <tr>
            <td>Vertriebs-, Verwaltungs-, Gemeinkosten</td>
            <td>3'000</td>
          </tr>
          <tr>
            <td>Betriebsergebnis</td>
            <td>3'000</td>
          </tr>
          <tr>
            <td rowspan="4" style="vertical-align: middle; font-weight: 700; text-align: center;">MID</td>
            <td>Umsatz</td>
            <td>9'000</td>
          </tr>
          <tr>
            <td>Herstellungskosten</td>
            <td>6'000</td>
          </tr>
          <tr>
            <td>Vertriebs-, Verwaltungs-, Gemeinkosten</td>
            <td>1'800</td>
          </tr>
          <tr>
            <td>Betriebsergebnis</td>
            <td>1'200</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderValueMapOptions(q) {
  return `
    <div class="options value-map-options" id="options">
      ${state.optionOrder.map((origIdx, displayIdx) => `
        <button class="option value-map-option" data-i="${displayIdx}" aria-label="${escapeHtml(q.options[origIdx])}">
          ${renderValueMapChoice(origIdx)}
        </button>
      `).join("")}
    </div>
  `;
}

function valueMapScenarios() {
  return ["a", "b", "c", "d", "e"];
}

function renderValueMapChoice(index) {
  const label = valueMapScenarios()[index];

  return `
    <div class="value-map-card" aria-hidden="true">
      <img src="data/visuals/ubung-value-map-${label}.png" alt="">
    </div>
  `;
}

function renderStatementInfoTable(ariaLabel, rows) {
  return `
    <div class="question-visual" aria-label="${escapeHtml(ariaLabel)}">
      <table class="value-table statement-info-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Amount</th>
            <th>Account</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>${row.map(cell => `<td>${renderRichText(cell)}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMalagnyStatementTable() {
  return renderStatementInfoTable(
    "Financial information for Malagny SA at the end of 2022",
    [
      ["Inventories", "CHF 1,000", "Revenues", "CHF 21,000"],
      ["Expenses", "CHF 12,000", "Cash", "CHF 13,000"],
      ["Accounts payable", "CHF 9,000", "Dividends", "CHF 1,000"],
      ["Accounts receivable", "CHF 3,000", "Notes payable", "CHF 1,000"],
      ["Common stock", "CHF 2,000", "Buildings", "CHF 4,000"],
      ["Beginning retained earnings", "CHF 3,000", "Machines", "CHF 2,000"]
    ]
  );
}

function renderSionStatementTable() {
  return renderStatementInfoTable(
    "Financial information for Sion SA at the end of 2023",
    [
      ["Cash", "CHF 8,000", "Accounts receivable", "CHF 4,000"],
      ["Inventory", "CHF 2,000", "Equipment", "CHF 6,000"],
      ["Accounts payable", "CHF 5,000", "Notes payable", "CHF 3,000"],
      ["Common stock", "CHF 4,000", "Beginning retained earnings", "CHF 2,000"],
      ["Revenues", "CHF 18,000", "Expenses", "CHF 11,000"],
      ["Dividends", "CHF 1,000", "", ""]
    ]
  );
}

function renderLosoneSecuritiesTable() {
  return renderDataTable(
    "Cost and fair value of Losone AG trading securities",
    ["Ordinary shares", "Cost", "Fair value"],
    [
      ["Locarno AG", "CHF 46,400", "CHF 50,000"],
      ["Ascona AG", "CHF 60,000", "CHF 53,800"],
      ["Tegna AG", "CHF 70,000", "CHF 72,000"],
    ]
  );
}

function renderGrandPetitTable() {
  return renderDataTable(
    "Income and dividends reported by Petit SA",
    ["Year", "Income of Petit", "Dividends declared by Petit"],
    [
      ["2020", "CHF 1,000,000", "CHF 200,000"],
      ["2021", "CHF -300,000", "CHF 0"],
      ["2022", "CHF 450,000", "CHF 150,000"],
    ]
  );
}

function renderBernUriTable() {
  return renderDataTable(
    "Income and dividends reported by Uri AG",
    ["Year", "Income of Uri", "Dividends paid by Uri"],
    [["Current year", "CHF 600,000", "CHF 100,000"]]
  );
}

function renderMorgesSecuritiesTable() {
  return renderDataTable(
    "Cost and fair value of Morges SA trading securities",
    ["Ordinary shares", "Cost", "Fair value"],
    [
      ["Nyon SA", "CHF 90,000", "CHF 84,000"],
      ["Rolle SA", "CHF 42,000", "CHF 45,500"],
      ["Gland SA", "CHF 58,000", "CHF 56,000"],
    ]
  );
}

function renderRigiPilatusTable() {
  return renderDataTable(
    "Income and dividends reported by Pilatus SA",
    ["Period", "Income of Pilatus", "Dividends declared by Pilatus"],
    [["Two-year total", "CHF 500,000", "CHF 120,000"]]
  );
}

function renderZugSarnenTable() {
  return renderDataTable(
    "Income and dividends reported by Sarnen AG",
    ["Year", "Income of Sarnen", "Dividends paid by Sarnen"],
    [["Current year", "CHF -250,000", "CHF 50,000"]]
  );
}

function renderVentiGrandeFairValueTable() {
  return renderDataTable(
    "Venti acquisition-date fair-value adjustments for Grande",
    ["Account", "Book value", "Fair value", "Remaining life from Jan. 1, 2020"],
    [
      ["Accounts receivable", "$4,000", "$10,000", "10 years"],
      ["Buildings", "$12,000", "$50,000", "6 years"],
      ["Equipment", "$6,000", "$36,000", "6 years"],
    ]
  );
}

function renderVentiGrandeEquityTable() {
  return renderDataTable(
    "Venti and Grande equity accounts",
    ["Account", "Venti", "Grande"],
    [
      ["Common Stock", "$400,000", "$100,000"],
      ["Share Premium", "$2,800,000", "$350,000"],
      ["Retained Earnings", "($600,000)", "$20,000"],
    ]
  );
}

function renderNovaOrbitFairValueTable() {
  return renderDataTable(
    "Nova acquisition-date fair-value adjustments for Orbit",
    ["Account", "Book value", "Fair value", "Remaining life from Jan. 1, 2021"],
    [
      ["Accounts receivable", "$18,000", "$20,000", "2 years"],
      ["Buildings", "$80,000", "$116,000", "9 years"],
      ["Equipment", "$40,000", "$64,000", "4 years"],
    ]
  );
}

function renderHelvetiaTicinoEquityTable() {
  return renderDataTable(
    "Helvetia and Ticino equity accounts",
    ["Account", "Helvetia", "Ticino"],
    [
      ["Common Stock", "CHF 900,000", "CHF 250,000"],
      ["Share Premium", "CHF 1,600,000", "CHF 300,000"],
      ["Retained Earnings", "CHF 420,000", "CHF 80,000"],
    ]
  );
}

function renderBernLuganoBuildingsTable() {
  return renderDataTable(
    "Bern SA acquisition of Lugano SA",
    ["Company", "Buildings book value", "Buildings fair value", "Remaining life"],
    [
      ["Bern SA", "CHF 500,000", "CHF 620,000", "8 years"],
      ["Lugano SA", "CHF 300,000", "CHF 420,000", "8 years"],
    ]
  );
}

function renderZurichBaselTable() {
  return renderDataTable(
    "Zurich AG investment in Basel AG",
    ["Fact", "Amount"],
    [
      ["Zurich shares owned", "20,000"],
      ["Basel shares outstanding", "50,000"],
      ["Zurich ownership", "40%"],
      ["Beginning Investment in Basel", "CHF 500,000"],
      ["Basel 2022 net income", "CHF 800,000"],
      ["Basel 2022 cash dividends", "CHF 640,000"],
    ]
  );
}

function renderBotkinsVolkersonTable() {
  return `
    ${renderDataTable(
      "Botkins and Volkerson stockholders' equity before combination",
      ["Stockholders' equity account", "Botkins Inc.", "Volkerson Corp."],
      [
        ["Common stock", "$220,000 ($1 par)", "$54,000"],
        ["APIC", "$110,000", "$25,000"],
        ["Retained earnings", "$360,000", "$130,000"],
      ]
    )}
    ${renderDataTable(
      "Botkins share issuance for Volkerson",
      ["Fact", "Amount"],
      [
        ["New Botkins shares issued", "56,000"],
        ["Botkins share par value", "$1"],
        ["Market value per new share", "$3.25"],
        ["Shares acquired", "All outstanding Volkerson stock"],
        ["Acquisition date", "January 1, 2022"],
      ]
    )}
  `;
}

function renderStGallenThunTable() {
  return renderDataTable(
    "St. Gallen AG investment in Thun AG",
    ["Fact", "Amount"],
    [
      ["Ownership", "30%"],
      ["Method", "Equity method"],
      ["Beginning Investment in Thun", "CHF 900,000"],
      ["Thun net income", "CHF 500,000"],
      ["Thun dividends paid", "CHF 120,000"],
    ]
  );
}

function renderGenevaFribourgTable() {
  return renderDataTable(
    "Geneva SA investment in Fribourg SA",
    ["Fact", "Amount"],
    [
      ["Ownership", "25%"],
      ["Method", "Equity method"],
      ["Fribourg net income", "CHF 240,000"],
      ["Fribourg dividends declared", "CHF 80,000"],
    ]
  );
}

function renderLucerneZugTable() {
  return renderDataTable(
    "Lucerne AG investment in Zug AG",
    ["Fact", "Amount"],
    [
      ["Ownership", "35%"],
      ["Method", "Equity method"],
      ["Beginning Investment in Zug", "CHF 700,000"],
      ["Zug net loss", "CHF 200,000"],
      ["Zug dividends paid", "CHF 0"],
    ]
  );
}

function renderParentSubCoTable() {
  return renderDataTable(
    "ParentCo acquisition of SubCo",
    ["Company", "Asset", "Acquisition-date fact"],
    [
      ["ParentCo", "Buildings", "Book value is below fair value"],
      ["SubCo", "Equipment", "Book value is below fair value"],
      ["Ownership acquired", "SubCo voting shares", "100%"],
    ]
  );
}

function renderArosaDavosTable() {
  return renderDataTable(
    "Arosa Inc. acquisition of Davos Corp.",
    ["Fact", "Amount"],
    [
      ["New Arosa shares issued", "40,000"],
      ["Arosa share par value", "$1"],
      ["Market value per new share", "$5"],
      ["Shares acquired", "All Davos Corp. shares"],
      ["Davos legal status", "Remains separately incorporated"],
    ]
  );
}

function renderMontreuxVeveyTable() {
  return renderDataTable(
    "Montreux Corp. acquisition of Vevey Corp.",
    ["Fact", "Amount"],
    [
      ["Montreux common stock before acquisition", "$300,000"],
      ["Montreux share par value", "$1"],
      ["New Montreux shares issued", "25,000"],
      ["Shares acquired", "100% of Vevey Corp."],
    ]
  );
}

function renderLausanneShareIssueTable() {
  return renderDataTable(
    "Lausanne Corp. share issuance for acquisition",
    ["Fact", "Amount"],
    [
      ["Lausanne common stock before acquisition", "$150,000"],
      ["Lausanne common stock par value", "$2"],
      ["Lausanne APIC before acquisition", "$90,000"],
      ["New shares issued", "10,000"],
      ["Fair value per new share", "$7"],
    ]
  );
}

function renderHurleyAcquisitionTables() {
  return `
    ${renderDataTable(
      "Hurley Corporation trial balance on January 1, 2017",
      ["Account", "Debit", "Credit"],
      [
        ["Cash", "$500", ""],
        ["Accounts receivable", "$600", ""],
        ["Inventory", "$800", ""],
        ["Buildings (net), 5-year life", "$1,500", ""],
        ["Equipment (net), 2-year life", "$1,000", ""],
        ["Land", "$900", ""],
        ["Accounts payable", "", "$400"],
        ["Long-term liabilities (due 12/31/20)", "", "$1,800"],
        ["Common stock", "", "$1,000"],
        ["Additional paid-in capital", "", "$600"],
        ["Retained earnings", "", "$1,500"],
        ["Total", "$5,300", "$5,300"],
      ]
    )}
    ${renderDataTable(
      "Hurley acquisition-date fair values and later results",
      ["Item", "Amount"],
      [
        ["Buildings fair value", "$1,200"],
        ["Equipment fair value", "$1,250"],
        ["Land fair value", "$1,300"],
        ["Long-term liabilities fair value", "$1,700"],
        ["2017 net income / dividends", "$100 / $30"],
        ["2018 net income / dividends", "$120 / $40"],
      ]
    )}
  `;
}

function renderProducerRentVisual() {
  const scenarios = [
    { label: "a", f1: { b: 10, p: 8, k: 4 }, f2: { b: 10, p: 4, k: 2 } },
    { label: "b", f1: { b: 10, p: 8, k: 4 }, f2: { b: 8, p: 5, k: 2 } },
    { label: "c", f1: { b: 8, p: 6, k: 2 }, f2: { b: 10, p: 9, k: 5 } },
    { label: "d", f1: { b: 6, p: 6, k: 2 }, f2: { b: 10, p: 6, k: 4 } },
    { label: "e", f1: { b: 10, p: 8, k: 4 }, f2: { b: 10, p: 6, k: 4 } },
  ];
  return `
    <div class="question-visual" aria-label="Balkendiagramme zu Wertschätzung, Preis und Stückkosten">
      <div class="visual-grid">
        ${scenarios.map(renderRentScenario).join("")}
      </div>
    </div>
  `;
}

function renderRentScenario(scenario) {
  return `
    <div class="mini-rent ${scenario.label === "e" ? "wide" : ""}">
      <div class="mini-title">${scenario.label})</div>
      <svg viewBox="0 0 236 174" role="img" aria-label="Situation ${scenario.label}">
        <line x1="34" y1="132" x2="202" y2="132" stroke="#111" stroke-width="1.3"/>
        ${renderRentBar(80, "1", scenario.f1, -1, scenario)}
        ${renderRentBar(156, "2", scenario.f2, 1, scenario)}
        <text x="80" y="155" text-anchor="middle" font-size="12" font-weight="700">Firma 1</text>
        <text x="156" y="155" text-anchor="middle" font-size="12" font-weight="700">Firma 2</text>
      </svg>
    </div>
  `;
}

function renderRentBar(x, suffix, values, side, scenario) {
  const barW = 30;
  const base = 132;
  const top = 24;
  const allValues = [scenario.f1, scenario.f2].flatMap(v => [v.b, v.p, v.k]);
  const maxValue = Math.max(...allValues, 1);
  const scale = (base - top) / Math.max(12, maxValue + 1);
  const y = value => base - value * scale;
  const labelX = side < 0 ? x - 22 : x + 22;
  const anchor = side < 0 ? "end" : "start";
  const label = (letter, value) => `
    <text x="${labelX}" y="${y(value) + 4}" text-anchor="${anchor}" font-size="10.5" font-weight="700">
      ${letter}<tspan baseline-shift="sub" font-size="7">${suffix}</tspan> = ${value}
    </text>
  `;
  const bpLabels = values.b === values.p ? `
    <text x="${x}" y="${Math.max(12, y(values.b) - 6)}" text-anchor="middle" font-size="10" font-weight="700">
      B<tspan baseline-shift="sub" font-size="7">${suffix}</tspan> = P<tspan baseline-shift="sub" font-size="7">${suffix}</tspan> = ${values.b}
    </text>
  ` : `${label("B", values.b)}${label("P", values.p)}`;
  return `
    <rect x="${x - barW / 2}" y="${y(values.b)}" width="${barW}" height="${values.b * scale}" fill="#fff" stroke="#111" stroke-width="1.2"/>
    <rect x="${x - barW / 2}" y="${y(values.k)}" width="${barW}" height="${values.k * scale}" fill="#9ca3af" stroke="#111" stroke-width="1.1"/>
    <line x1="${x - barW / 2}" y1="${y(values.p)}" x2="${x + barW / 2}" y2="${y(values.p)}" stroke="#111" stroke-width="1.3"/>
    ${bpLabels}
    ${label("K", values.k)}
  `;
}

function renderIndifferenceVisual() {
  return `
    <div class="question-visual" aria-label="Indifferenzkurve mit Produkten X und Y">
      <svg viewBox="-75 0 760 380" role="img">
        <defs>
          <marker id="arrow-q8" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#111"></path>
          </marker>
        </defs>
        <line x1="78" y1="325" x2="568" y2="325" stroke="#111" stroke-width="2" marker-end="url(#arrow-q8)"/>
        <line x1="78" y1="325" x2="78" y2="42" stroke="#111" stroke-width="2" marker-end="url(#arrow-q8)"/>
        <text x="58" y="38" font-size="20" font-weight="700">DK, P</text>
        <text x="565" y="355" font-size="20" font-weight="700">Qualität</text>

        <line x1="78" y1="250" x2="456" y2="250" stroke="#374151" stroke-width="1.5" stroke-dasharray="7 7"/>
        <line x1="78" y1="178" x2="260" y2="178" stroke="#374151" stroke-width="1.5" stroke-dasharray="7 7"/>
        <line x1="78" y1="105" x2="456" y2="105" stroke="#374151" stroke-width="1.5" stroke-dasharray="7 7"/>
        <line x1="260" y1="178" x2="260" y2="325" stroke="#374151" stroke-width="1.5" stroke-dasharray="7 7"/>
        <line x1="456" y1="105" x2="456" y2="325" stroke="#374151" stroke-width="1.5" stroke-dasharray="7 7"/>

        <path d="M145 300 C180 275, 210 203, 260 178 C320 148, 406 110, 456 105 C486 102, 525 99, 548 98" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/>
        <circle cx="260" cy="178" r="9" fill="#111"/>
        <circle cx="456" cy="105" r="9" fill="#111"/>

        <text x="44" y="254" text-anchor="end" font-size="17" font-weight="700">DK<tspan baseline-shift="sub" font-size="11">X</tspan> = DK<tspan baseline-shift="sub" font-size="11">Y</tspan></text>
        <text x="55" y="182" text-anchor="end" font-size="18" font-weight="700">P<tspan baseline-shift="sub" font-size="11">X</tspan></text>
        <text x="55" y="109" text-anchor="end" font-size="18" font-weight="700">P<tspan baseline-shift="sub" font-size="11">Y</tspan></text>
        <text x="260" y="354" text-anchor="middle" font-size="18" font-weight="700">Qualität<tspan baseline-shift="sub" font-size="11">X</tspan></text>
        <text x="456" y="354" text-anchor="middle" font-size="18" font-weight="700">Qualität<tspan baseline-shift="sub" font-size="11">Y</tspan></text>
        <text x="198" y="145" font-size="18" font-weight="700">Produkt</text>
        <text x="198" y="168" font-size="18" font-weight="700">Firma X</text>
        <text x="400" y="72" font-size="18" font-weight="700">Produkt</text>
        <text x="400" y="95" font-size="18" font-weight="700">Firma Y</text>
        <text x="485" y="112" font-size="19" font-weight="700">Indifferenzkurve</text>
      </svg>
    </div>
  `;
}

function renderExperienceVisual() {
  return `
    <div class="question-visual" aria-label="Erfahrungskurve mit kumulierter Produktionsmenge">
      <svg viewBox="-45 0 825 360" role="img">
        <defs>
          <marker id="arrow-q14" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#111"></path>
          </marker>
        </defs>
        <line x1="82" y1="300" x2="565" y2="300" stroke="#111" stroke-width="2" marker-end="url(#arrow-q14)"/>
        <line x1="82" y1="300" x2="82" y2="38" stroke="#111" stroke-width="2" marker-end="url(#arrow-q14)"/>
        <text x="66" y="36" font-size="20" font-weight="700">DK</text>
        <text x="566" y="315" font-size="18" font-weight="700">kumulierte</text>
        <text x="566" y="337" font-size="18" font-weight="700">Produktionsmenge Q</text>

        <path d="M95 75 C120 155 188 194 245 208 C315 226 370 241 395 250 C448 269 505 278 548 282" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/>
        <line x1="82" y1="208" x2="245" y2="208" stroke="#374151" stroke-width="1.6" stroke-dasharray="7 7"/>
        <line x1="82" y1="250" x2="395" y2="250" stroke="#374151" stroke-width="1.6" stroke-dasharray="7 7"/>
        <line x1="245" y1="208" x2="245" y2="300" stroke="#374151" stroke-width="1.6" stroke-dasharray="7 7"/>
        <line x1="395" y1="250" x2="395" y2="300" stroke="#374151" stroke-width="1.6" stroke-dasharray="7 7"/>

        <text x="65" y="213" text-anchor="end" font-size="18" font-weight="700">DK<tspan baseline-shift="sub" font-size="11">X</tspan> = 10</text>
        <text x="65" y="255" text-anchor="end" font-size="18" font-weight="700">DK<tspan baseline-shift="sub" font-size="11">Y</tspan> = 8</text>
        <text x="245" y="328" text-anchor="middle" font-size="18" font-weight="700">Q<tspan baseline-shift="sub" font-size="11">X</tspan> = 100</text>
        <text x="395" y="328" text-anchor="middle" font-size="18" font-weight="700">Q<tspan baseline-shift="sub" font-size="11">Y</tspan> = 200</text>
      </svg>
    </div>
  `;
}

function renderAdidasValueTable() {
  return `
    <div class="question-visual" aria-label="Wertschöpfungskette ADIWAS">
      <table class="value-table">
        <thead>
          <tr>
            <th>Stufe</th>
            <th>Variable Stückkosten pro Stufe</th>
            <th>Fixkosten pro Stufe</th>
            <th>Verkaufspreis</th>
            <th>Verarbeitete Menge</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Stufe 1: Produktion</td>
            <td>10</td>
            <td>3'200'000</td>
            <td>60</td>
            <td>100'000</td>
          </tr>
          <tr>
            <td>Stufe 2: Vertrieb in eigenen Shops</td>
            <td>10</td>
            <td>1'600'000</td>
            <td>130</td>
            <td>60'000</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderAiProducerRentVisual() {
  const scenarios = [
    { label: "a", f1: { b: 12, p: 10, k: 5 }, f2: { b: 12, p: 6, k: 3 } },
    { label: "b", f1: { b: 12, p: 9, k: 5 }, f2: { b: 10, p: 6, k: 3 } },
    { label: "c", f1: { b: 12, p: 9, k: 3 }, f2: { b: 14, p: 13, k: 7 } },
    { label: "d", f1: { b: 8, p: 8, k: 3 }, f2: { b: 13, p: 8, k: 5 } },
    { label: "e", f1: { b: 12, p: 9, k: 5 }, f2: { b: 12, p: 7, k: 5 } },
  ];
  return `
    <div class="question-visual" aria-label="AI-Balkendiagramme zu Wertschätzung, Preis und Stückkosten">
      <div class="visual-grid">
        ${scenarios.map(renderRentScenario).join("")}
      </div>
    </div>
  `;
}

function renderAiIndifferenceVisual() {
  return `
    <div class="question-visual" aria-label="AI-Indifferenzkurve mit Produkten A und B">
      <svg viewBox="-75 0 760 380" role="img">
        <defs>
          <marker id="arrow-ai-q8" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#111"></path>
          </marker>
        </defs>
        <line x1="78" y1="325" x2="568" y2="325" stroke="#111" stroke-width="2" marker-end="url(#arrow-ai-q8)"/>
        <line x1="78" y1="325" x2="78" y2="42" stroke="#111" stroke-width="2" marker-end="url(#arrow-ai-q8)"/>
        <text x="58" y="38" font-size="20" font-weight="700">DK, P</text>
        <text x="565" y="355" font-size="20" font-weight="700">Qualität</text>

        <line x1="78" y1="252" x2="468" y2="252" stroke="#374151" stroke-width="1.5" stroke-dasharray="7 7"/>
        <line x1="78" y1="188" x2="248" y2="188" stroke="#374151" stroke-width="1.5" stroke-dasharray="7 7"/>
        <line x1="78" y1="96" x2="468" y2="96" stroke="#374151" stroke-width="1.5" stroke-dasharray="7 7"/>
        <line x1="248" y1="188" x2="248" y2="325" stroke="#374151" stroke-width="1.5" stroke-dasharray="7 7"/>
        <line x1="468" y1="96" x2="468" y2="325" stroke="#374151" stroke-width="1.5" stroke-dasharray="7 7"/>

        <path d="M138 300 C170 280, 198 213, 248 188 C308 158, 418 101, 468 96 C498 93, 525 92, 550 92" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/>
        <circle cx="248" cy="188" r="9" fill="#111"/>
        <circle cx="468" cy="96" r="9" fill="#111"/>

        <text x="44" y="256" text-anchor="end" font-size="17" font-weight="700">DK<tspan baseline-shift="sub" font-size="11">A</tspan> = DK<tspan baseline-shift="sub" font-size="11">B</tspan></text>
        <text x="55" y="192" text-anchor="end" font-size="18" font-weight="700">P<tspan baseline-shift="sub" font-size="11">A</tspan></text>
        <text x="55" y="100" text-anchor="end" font-size="18" font-weight="700">P<tspan baseline-shift="sub" font-size="11">B</tspan></text>
        <text x="248" y="354" text-anchor="middle" font-size="18" font-weight="700">Qualität<tspan baseline-shift="sub" font-size="11">A</tspan></text>
        <text x="468" y="354" text-anchor="middle" font-size="18" font-weight="700">Qualität<tspan baseline-shift="sub" font-size="11">B</tspan></text>
        <text x="188" y="154" font-size="18" font-weight="700">Produkt</text>
        <text x="188" y="177" font-size="18" font-weight="700">Firma A</text>
        <text x="406" y="63" font-size="18" font-weight="700">Produkt</text>
        <text x="406" y="86" font-size="18" font-weight="700">Firma B</text>
        <text x="496" y="106" font-size="19" font-weight="700">Indifferenzkurve</text>
      </svg>
    </div>
  `;
}

function renderAiExperienceVisual() {
  return `
    <div class="question-visual" aria-label="AI-Erfahrungskurve mit kumulierter Produktionsmenge">
      <svg viewBox="-45 0 825 360" role="img">
        <defs>
          <marker id="arrow-ai-q14" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#111"></path>
          </marker>
        </defs>
        <line x1="82" y1="300" x2="565" y2="300" stroke="#111" stroke-width="2" marker-end="url(#arrow-ai-q14)"/>
        <line x1="82" y1="300" x2="82" y2="38" stroke="#111" stroke-width="2" marker-end="url(#arrow-ai-q14)"/>
        <text x="66" y="36" font-size="20" font-weight="700">DK</text>
        <text x="566" y="315" font-size="18" font-weight="700">kumulierte</text>
        <text x="566" y="337" font-size="18" font-weight="700">Produktionsmenge Q</text>

        <path d="M96 70 C124 146 180 184 224 202 C304 232 390 251 450 262 C490 270 523 274 550 276" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/>
        <line x1="82" y1="202" x2="224" y2="202" stroke="#374151" stroke-width="1.6" stroke-dasharray="7 7"/>
        <line x1="82" y1="262" x2="450" y2="262" stroke="#374151" stroke-width="1.6" stroke-dasharray="7 7"/>
        <line x1="224" y1="202" x2="224" y2="300" stroke="#374151" stroke-width="1.6" stroke-dasharray="7 7"/>
        <line x1="450" y1="262" x2="450" y2="300" stroke="#374151" stroke-width="1.6" stroke-dasharray="7 7"/>

        <text x="65" y="207" text-anchor="end" font-size="18" font-weight="700">DK<tspan baseline-shift="sub" font-size="11">A</tspan> = 12</text>
        <text x="65" y="267" text-anchor="end" font-size="18" font-weight="700">DK<tspan baseline-shift="sub" font-size="11">B</tspan> = 9</text>
        <text x="224" y="328" text-anchor="middle" font-size="18" font-weight="700">Q<tspan baseline-shift="sub" font-size="11">A</tspan> = 80</text>
        <text x="450" y="328" text-anchor="middle" font-size="18" font-weight="700">Q<tspan baseline-shift="sub" font-size="11">B</tspan> = 240</text>
      </svg>
    </div>
  `;
}

function renderVeloProValueTable() {
  return `
    <div class="question-visual" aria-label="Wertschöpfungskette VeloPro">
      <table class="value-table">
        <thead>
          <tr>
            <th>Stufe</th>
            <th>Variable Stückkosten pro Stufe</th>
            <th>Fixkosten pro Stufe</th>
            <th>Verkaufspreis</th>
            <th>Verarbeitete Menge</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Stufe 1: Produktion</td>
            <td>12</td>
            <td>2'000'000</td>
            <td>55</td>
            <td>80'000</td>
          </tr>
          <tr>
            <td>Stufe 2: Vertrieb in eigenen Shops</td>
            <td>8</td>
            <td>1'100'000</td>
            <td>115</td>
            <td>50'000</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderValueChainTable(ariaLabel, rows) {
  return renderDataTable(
    ariaLabel,
    ["Stufe", "Variable Stückkosten pro Stufe", "Fixkosten pro Stufe", "Verarbeitete Menge", "Verkaufte Menge", "Verkaufspreis"],
    rows
  );
}

function renderAlpenMilkValueTable() {
  return renderValueChainTable(
    "Wertschöpfungskette AlpenMilk",
    [
      ["1. Rohmilch, Absatz Molkereien", "2", "80'000", "120'000", "30'000", "4"],
      ["2. Herstellung Joghurt, Absatz Grosshandel", "3", "60'000", "90'000", "50'000", "9"],
      ["3. Vertrieb Joghurt, Absatz eigene Shops", "1", "40'000", "40'000", "40'000", "13"],
    ]
  );
}

function renderBrewlyValueTable() {
  return renderValueChainTable(
    "Wertschöpfungskette Brewly",
    [
      ["1. Malzverarbeitung, Absatz Rohstoffmarkt", "2", "40'000", "90'000", "20'000", "5"],
      ["2. Abfüllung Bier, Absatz Grossverteiler", "4", "90'000", "70'000", "25'000", "14"],
      ["3. Distribution Bier, Absatz eigene Bars", "3", "120'000", "45'000", "45'000", "21"],
    ]
  );
}

function renderSolarisValueTable() {
  return renderValueChainTable(
    "Wertschöpfungskette Solaris",
    [
      ["1. Zellproduktion, Absatz Komponentenmarkt", "30", "400'000", "50'000", "15'000", "55"],
      ["2. Modulmontage, Absatz Installationsbetriebe", "20", "250'000", "35'000", "15'000", "85"],
      ["3. Projektvertrieb, Absatz Endkunden", "15", "300'000", "20'000", "20'000", "140"],
    ]
  );
}

function renderChocoLineValueTable() {
  return renderValueChainTable(
    "Wertschöpfungskette ChocoLine",
    [
      ["1. Kakaomasse, Absatz Rohstoffmarkt", "3", "270'000", "180'000", "40'000", "6"],
      ["2. Schokoladenproduktion, Absatz Grosshandel", "4", "180'000", "140'000", "80'000", "13"],
      ["3. Detailhandel, Absatz eigene Läden", "2", "150'000", "60'000", "60'000", "18"],
    ]
  );
}

function renderBikeMotionValueTable() {
  return renderValueChainTable(
    "Wertschöpfungskette BikeMotion",
    [
      ["1. Rahmenproduktion, Absatz Komponentenmarkt", "42", "900'000", "50'000", "20'000", "80"],
      ["2. Fahrradmontage, Absatz Fachhandel", "35", "630'000", "30'000", "12'000", "150"],
      ["3. Store-Vertrieb, Absatz Endkunden", "20", "300'000", "18'000", "18'000", "210"],
    ]
  );
}

function renderMediGlassValueTable() {
  return renderValueChainTable(
    "Wertschöpfungskette MediGlass",
    [
      ["1. Spezialglas, Absatz Industriemarkt", "18", "220'000", "42'000", "12'000", "34"],
      ["2. Laborflaschen, Absatz Grosshandel", "9", "160'000", "30'000", "12'000", "58"],
      ["3. Direktvertrieb, Absatz Spitäler", "7", "180'000", "18'000", "18'000", "95"],
    ]
  );
}

function renderTimberHausValueTable() {
  return renderValueChainTable(
    "Wertschöpfungskette TimberHaus",
    [
      ["1. Holzaufbereitung, Absatz Holzmarkt", "18", "280'000", "80'000", "25'000", "32"],
      ["2. Fertigteile, Absatz Bauunternehmen", "12", "520'000", "40'000", "18'000", "70"],
      ["3. Projektbau, Absatz Endkunden", "20", "420'000", "22'000", "22'000", "120"],
    ]
  );
}

function pickAnswer(displayIdx, timedOut = false) {
  if (state.answered) return;
  getAudioCtx();
  stopQuestionTimer();
  state.answered = true;
  state.picked = displayIdx;
  const questionIndex = state.order[state.idx];
  const q = QUESTIONS[questionIndex];
  const answerKeyAvailable = hasAnswerKey(q);
  const pickedOriginal = timedOut ? -1 : state.optionOrder[displayIdx];
  const correctDisplay = answerKeyAvailable ? state.optionOrder.indexOf(q.correct) : -1;
  const isCorrect = answerKeyAvailable && !timedOut && pickedOriginal === q.correct;

  if (isCorrect) {
    state.score++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    showPonyReward();
    playHappyPonySound();
  } else if (answerKeyAvailable) {
    state.streak = 0;
    showPonyOfDeath();
    playSadViolinSound();
    state.wrong.push({
      questionIndex,
      prompt: questionPromptText(q),
      picked: timedOut ? "Time expired" : q.options[pickedOriginal],
      correct: q.options[q.correct],
      explanation: q.explanation,
    });
  } else {
    state.streak = 0;
  }

  if (answerKeyAvailable) {
    recordAnswer(q, isCorrect);
    queueGistSave(state.data);
  }

  document.querySelectorAll("#options .option").forEach((btn, i) => {
    btn.disabled = true;
    if (answerKeyAvailable && i === correctDisplay) btn.classList.add("correct");
    else if (!timedOut && i === displayIdx) btn.classList.add(answerKeyAvailable ? "wrong" : "correct");
    else btn.classList.add("dimmed");
  });

  const slot = document.getElementById("feedbackSlot");
  slot.innerHTML = `
    <div class="feedback ${isCorrect || !answerKeyAvailable ? "" : "wrong"}">
      <div class="feedback-title ${isCorrect || !answerKeyAvailable ? "ok" : "bad"}">
        ${answerKeyAvailable
          ? (timedOut ? "Time expired" : (isCorrect ? "✓ Correct" : "✗ Not quite"))
          : "Answer key not available"}
      </div>
      <div class="feedback-body">${renderRichText(answerKeyAvailable ? q.explanation : "This question was imported from the scanned June 2017 PDF. The scan contains the question and choices, but no reliable official answer key.")}</div>
      ${renderTAccount(q.entry)}
    </div>
    <div class="next-btn-row">
      <button class="btn next-btn" id="nextBtn">
        ${state.idx + 1 < state.order.length ? "Next →" : "See results"}
      </button>
    </div>
  `;
  document.getElementById("nextBtn").addEventListener("click", next);
}

function renderTAccount(entry) {
  if (!entry) return "";
  const rows = Math.max(entry.debits.length, entry.credits.length);
  let cells = "";
  for (let i = 0; i < rows; i++) {
    const d = entry.debits[i];
    const c = entry.credits[i];
    cells += `
      <div class="t-cell dr">${d ? `<span>${escapeHtml(d[0])}</span><span class="amt">${escapeHtml(d[1] || "")}</span>` : ""}</div>
      <div class="t-cell cr">${c ? `<span style="padding-left:14px;">${escapeHtml(c[0])}</span><span class="amt">${escapeHtml(c[1] || "")}</span>` : ""}</div>
    `;
  }
  return `
    <div class="t-acct">
      <div class="t-head dr">DEBIT</div>
      <div class="t-head cr">CREDIT</div>
      ${cells}
    </div>
  `;
}

function next() {
  hidePonyReward();
  if (state.idx + 1 < state.order.length) {
    state.idx++;
    loadCurrent();
    render();
  } else {
    state.screen = "results";
    render();
  }
}

function recordCompletedDeckResult(scoredTotal, pct) {
  if (state.resultRecorded) return;
  state.resultRecorded = true;
  if (state.mode !== "deck" || !state.deckId || !scoredTotal) return;

  const deck = getDeckById(state.deckId);
  const progressId = deckProgressId(deck || state.deckId);
  const result = {
    pct,
    score: state.score,
    total: scoredTotal,
    completedAt: Date.now(),
    label: deck ? deck.label : state.deckId,
  };
  state.data.deckBestResults = { ...(state.data.deckBestResults || {}) };
  if (isBetterDeckResult(result, state.data.deckBestResults[progressId])) {
    state.data.deckBestResults[progressId] = result;
    state.data.lastUpdated = Date.now();
    queueGistSave(state.data);
  }
}

function renderResults() {
  stopQuestionTimer();
  const total = state.order.length;
  const scoredTotal = state.order.filter(i => hasAnswerKey(QUESTIONS[i])).length;
  const unscoredTotal = total - scoredTotal;
  const pct = scoredTotal ? Math.round((state.score / scoredTotal) * 100) : 0;
  const mistakeIndices = [...new Set(state.wrong.map(w => w.questionIndex))]
    .filter(i => Number.isInteger(i) && QUESTIONS[i] && hasAnswerKey(QUESTIONS[i]));
  const canPracticeMistakes = (state.mode === "deck" || state.mode === "mistakes") && mistakeIndices.length > 0;
  let msg = "Back to the books 📚";
  if (!scoredTotal) msg = "Scanned questions reviewed.";
  else if (pct === 100) msg = "Perfect. Auditor-grade. 🏆";
  else if (pct >= 90) msg = "Excellent — you know the ledgers cold.";
  else if (pct >= 75) msg = "Strong result.";
  else if (pct >= 60) msg = "Solid foundation — review the misses below.";
  else if (pct >= 40) {
    msg = state.subject === "BWL II"
      ? "Keep practicing - review the missed concepts."
      : "Keep practicing — focus on debit/credit rules.";
  }

  let modeTag = "Mixed practice";
  if (state.mode === "weak") modeTag = "Weakest practice";
  else if (state.mode === "bwl-selection") modeTag = "BWL Themenauswahl";
  else if (state.mode === "deck") {
    const deck = getDeckById(state.deckId);
    modeTag = deck ? deck.label : "Deck";
  } else if (state.mode === "mistakes") {
    const deck = getDeckById(state.deckId);
    modeTag = deck ? `${deck.label} mistakes` : "Practice mistakes";
  }
  recordCompletedDeckResult(scoredTotal, pct);

  app.innerHTML = `
    ${renderSubjectTabs()}
      <div class="results">
      <div class="cat-tag" style="margin-bottom:14px;">${escapeHtml(modeTag)}</div>
      <div class="score-big">${state.score} / ${scoredTotal || total}</div>
      <div class="score-pct">${scoredTotal ? `${pct}% correct · best streak ${state.bestStreak}` : "Unscored scanned set"}${unscoredTotal ? ` · ${unscoredTotal} unscored` : ""}</div>
      <div class="score-msg">${msg}</div>

      ${state.wrong.length ? `
        <div class="review-title">Review · ${state.wrong.length} to re-learn</div>
        ${state.wrong.map(w => `
          <div class="review-item">
            <div class="q">${renderRichText(w.prompt)}</div>
            <div class="yours">Your answer: ${renderRichText(w.picked)}</div>
            <div class="correct-text">Correct: ${renderRichText(w.correct)}</div>
            <div class="feedback-body" style="margin-top:8px;font-size:0.78rem;">${renderRichText(w.explanation)}</div>
          </div>
        `).join("")}
      ` : ""}

      <div class="action-row">
        <button class="btn btn-ghost" id="homeBtn">← Home</button>
        ${canPracticeMistakes ? `<button class="btn btn-ghost" id="mistakesBtn">Practice mistakes</button>` : ""}
        <button class="btn btn-primary" id="againBtn">${state.mode === "weak" ? "Practice weak again" : state.mode === "deck" ? "Replay deck" : "Play again"}</button>
      </div>
    </div>
  `;
  wireSubjectTabs();
  document.getElementById("homeBtn").addEventListener("click", () => {
    state.screen = "start";
    render();
  });
  document.getElementById("againBtn").addEventListener("click", () => {
    if (state.mode === "weak") startWeakQuiz();
    else if (state.mode === "deck") startDeckQuiz(state.deckId);
    else if (state.mode === "mistakes") startMistakeQuiz(state.order);
    else startQuiz();
  });
  document.getElementById("mistakesBtn")?.addEventListener("click", () => {
    startMistakeQuiz(mistakeIndices);
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function questionPromptText(q) {
  return String(q?.prompt ?? "").replace(/^\s*(?:\[\]\s*)?AI-Variante\s+\d+\s*:\s*/i, "");
}

function renderRichText(s) {
  return escapeHtml(s)
    .replace(/\b([A-Z]{1,3})_\{([^}]+)\}/g, "$1<sub>$2</sub>")
    .replace(/\b([A-Z]{1,3})_([A-Za-z0-9]+)\b/g, "$1<sub>$2</sub>")
    .replace(/\b(B|K|P|Q|PR|DK|TK)(\d+)\b/g, "$1<sub>$2</sub>")
    .replace(/\b(Q)([xy])\b/g, "$1<sub>$2</sub>");
}
