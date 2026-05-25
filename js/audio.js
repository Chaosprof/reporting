// Web Audio helpers: tone generation + UI sound effects.
let audioCtx = null;

function getAudioCtx() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

function playTone(freq, start, duration, opts = {}) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(freq, start);
  if (opts.toFreq) osc.frequency.exponentialRampToValueAtTime(opts.toFreq, start + duration);
  filter.type = opts.filterType || "lowpass";
  filter.frequency.setValueAtTime(opts.filterFreq || 6000, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(opts.gain || 0.08, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function playClockTick() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  playTone(1150, t, 0.045, { type: "square", gain: 0.035, filterFreq: 3500 });
  playTone(2300, t + 0.012, 0.025, { type: "triangle", gain: 0.018, filterFreq: 5000 });
}

function playHappyPonySound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    playTone(freq, t + i * 0.075, 0.16, { type: "triangle", gain: 0.06, filterFreq: 7000 });
  });
  playTone(1318.51, t + 0.32, 0.24, { type: "sine", gain: 0.045, filterFreq: 8000 });
}

function playSadViolinSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  [
    [440, 415.3],
    [392, 369.99],
    [349.23, 329.63],
    [293.66, 277.18],
  ].forEach(([from, to], i) => {
    playTone(from, t + i * 0.18, 0.34, { type: "sawtooth", toFreq: to, gain: 0.045, filterFreq: 1200 });
  });
}
