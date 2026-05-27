// Entry point: load JSON data files, populate QUESTIONS/PONY_IMAGES,
// run post-processing, then render the first screen.
(async function boot() {
  const questionFiles = [
    "accounting",
    "accounting-practice-exams",
    "bwl-fruhjahr-2017",
    "bwl-fs25",
    "bwl-jun17-sm",
    "bwl-math-ai",
    "bwl-jun17-hrm",
    "bwl-jun17-org",
  ];

  try {
    const [
      ponyImages,
      prefixes,
      ...questionGroups
    ] = await Promise.all([
      fetch("data/pony-images.json").then(r => r.json()),
      fetch("data/bwl-both-source-prefixes.json").then(r => r.json()),
      ...questionFiles.map(name => fetch(`data/questions/${name}.json`).then(r => r.json())),
    ]);

    PONY_IMAGES.push(...ponyImages);
    BWL_BOTH_SOURCE_PREFIXES = prefixes;
    for (const group of questionGroups) QUESTIONS.push(...group);

    postProcessQuestions();
  } catch (err) {
    console.error("Failed to load question data:", err);
    document.getElementById("app").innerHTML =
      `<div style="padding:40px;text-align:center;color:#7a3f37;font-family:system-ui;">
         Could not load question data. Open the developer console for details.
       </div>`;
    return;
  }

  render();

  // If a PAT is configured, pull the gist on load so the latest cross-device
  // progress wins. Merge with local in case the local copy has newer answers
  // recorded while offline.
  if (getPat()) {
    setSyncStatus("saving");
    loadGistData()
      .then(async remote => {
        if (remote) {
          state.data = mergeData(state.data, remote);
          saveLocalData(state.data);
        }
        await saveGistData(state.data);
        saveLocalData(state.data);
        if (state.screen === "start") render();
        setSyncStatus("synced");
      })
      .catch(e => {
        console.warn("Initial gist load failed:", e);
        setSyncStatus("error", syncErrorText(e));
      });
  }
})();
