// HarmoniumClear's shared parts: free-reed physics (a brass cantilever), the wind system (a hand-pumped
// bellows filling a spring-loaded reservoir), tuning maths (equal temperament and just intonation),
// a playing engine, a WebAudio free-reed voice, computer-keyboard input, a 3D Indian hand harmonium,
// and canvas boards for live charts.
// The harmonium is built in metres and scaled up by the chapters: x runs along the keyboard (low notes
// on the left, +x to the player's right), y is up, and +z points towards the player. The keys are at
// the front (+z), the bellows at the back (−z), hinged on the right so their left end swings open.
import { THREE, M, clamp, smooth, box, beam, spring, swarm, canvasTexture } from './kit.js';
import { audio } from './ui.js';

export const TAU = Math.PI * 2;

// ---------------------------------------------------------------- notes and tuning
// Equal temperament with A4 = 440 Hz: every semitone is ×2^(1/12), so every interval except the octave is
// slightly "off" from a pure ratio (see PianoClear's scale chapter).
export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const midiOf = (f) => 69 + 12 * Math.log2(f / 440);
export const freqOfMidi = (m) => 440 * 2 ** ((m - 69) / 12);
export function noteOf(f) {
  const x = midiOf(f), m = Math.round(x);
  return { midi: m, name: NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1), cents: (x - m) * 100 };
}
export const fmtHz = (f) => (f < 1000 ? f.toFixed(f < 100 ? 1 : 0) + ' Hz' : (f / 1000).toFixed(2) + ' kHz');
export const cents = (ratio) => 1200 * Math.log2(ratio);
// Hindustani note names (sargam), in semitones from Sa. Lower case = komal (flat); Ma♯ = tivra Ma.
export const SARGAM = ['Sa', 'komal Re', 'Re', 'komal Ga', 'Ga', 'Ma', 'tivra Ma', 'Pa', 'komal Dha', 'Dha', 'komal Ni', 'Ni'];
export const SARGAM_SHORT = ['Sa', 're', 'Re', 'ga', 'Ga', 'Ma', 'Ma♯', 'Pa', 'dha', 'Dha', 'ni', 'Ni'];
// Five-limit just intonation (the ratios of the harmonic series), a common textbook model of the pure
// intervals singers drift to: Re 9/8, Ga 5/4, Ma 4/3, Pa 3/2, Dha 5/3, Ni 15/8 (Helmholtz, On the
// Sensations of Tone; Jairazbhoy & Stone 1963 measured real Hindustani intonation, which varies by raga).
export const JUST = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];

// ---------------------------------------------------------------- the keyboard
// A common Indian portable harmonium has 39 keys (3¼ octaves). We give ours the compass C3–D6; makers vary.
export const NKEYS = 39, MIDI0 = 48;
const BLACK = new Set([1, 3, 6, 8, 10]);
export const isBlack = (i) => BLACK.has((MIDI0 + i) % 12);
export const KEYNAME = (i) => noteOf(freqOfMidi(MIDI0 + i)).name;
// The frequency of reed r of the male (main) bank. Just tuning is tuned to C as Sa.
export function reedFreq(r, tuning = 'et') {
  const m = MIDI0 + r;
  if (tuning !== 'just') return freqOfMidi(m);
  const pc = ((m % 12) + 12) % 12, c = m - pc;
  return freqOfMidi(c) * JUST[pc];
}
// Reed banks: bass sounds an octave below the key, male at the key, female an octave above. Each bank is
// set a hair off the others so they chorus, and "musette" is a second male bank tuned deliberately sharp.
export const BANKS = {
  bass: { mult: 0.5, detune: -2, label: 'Bass', color: '#7aa2ff', lvl: 0.95 },
  male: { mult: 1, detune: 0, label: 'Male', color: '#ffb547', lvl: 0.8 },
  female: { mult: 2, detune: 3, label: 'Female', color: '#ff7ab6', lvl: 0.5 },
  musette: { mult: 1, detune: 12, label: 'Musette', color: '#5ce1a9', lvl: 0.6 },
};
export const BANK_ORDER = ['bass', 'male', 'female', 'musette'];
export const bankFreq = (f, b) => f * BANKS[b].mult * 2 ** (BANKS[b].detune / 1200);
// Drone stops: extra reeds that sound all the time their stop is out, no key needed. Sa and Pa below it.
export const DRONES = { sa: { r: 0, mult: 1, label: 'Sa drone' }, pa: { r: 7, mult: 0.5, label: 'Pa drone' } };

// ---------------------------------------------------------------- the free reed
// A reed tongue is a thin brass cantilever riveted at one end. Its first bending mode is
//   f = (β₁²/2π)·(t/L²)·√(E/12ρ),  β₁ = 1.8751  (Euler–Bernoulli beam; e.g. Blevins, Formulas for
// Natural Frequency and Mode Shape, table 8-1). Reed brass (about 70/30 copper–zinc): E ≈ 110 GPa,
// ρ ≈ 8530 kg/m³ (Copper Development Association data for C26000). A reed "speaks" at, or a little below,
// this natural frequency (Fletcher & Rossing, The Physics of Musical Instruments, §13.2; Cottingham 2011).
export const E_BRASS = 110e9, RHO_BRASS = 8530, BETA1 = 1.8751;
const C_BEAM = (BETA1 * BETA1) / TAU * Math.sqrt(E_BRASS / (12 * RHO_BRASS));    // ≈ 580 m/s
export const reedF = (L, t) => (C_BEAM * t) / (L * L);
export const reedLengthFor = (f, t) => Math.sqrt((C_BEAM * t) / f);
// The first mode shape of a uniform cantilever, and its curvature, at x = 0 (root) … 1 (tip).
const SIG = 0.7341;
export const modeShape = (x) => { const b = BETA1 * x; return (Math.cosh(b) - Math.cos(b) - SIG * (Math.sinh(b) - Math.sin(b))) / 2.7242; };
const curv = (x) => { const b = BETA1 * x; return Math.cosh(b) + Math.cos(b) - SIG * (Math.sinh(b) + Math.sin(b)); };
// Tuning by scraping. A scrape at position xs (0 root … 1 tip) thins the tongue there by a fraction d.
// Rayleigh's method: f² ∝ ∫EI·φ''² / ∫ρA·φ², with I ∝ t³ and A ∝ t. Thinning near the tip removes mass
// where the tongue moves most (pitch up); thinning near the root removes stiffness where it bends most
// (pitch down). Returns the new/old frequency ratio.
const NQ = 160, XS = Array.from({ length: NQ }, (_, i) => (i + 0.5) / NQ);
const K0 = XS.reduce((a, x) => a + curv(x) ** 2, 0), M0 = XS.reduce((a, x) => a + modeShape(x) ** 2, 0);
export const scrapeProfile = (x, xs, d) => 1 - d * Math.exp(-(((x - xs) / 0.09) ** 2));
export function scrapeRatio(xs, d) {
  if (d <= 0) return 1;
  let K = 0, Mm = 0;
  for (const x of XS) { const h = scrapeProfile(x, xs, d); K += h ** 3 * curv(x) ** 2; Mm += h * modeShape(x) ** 2; }
  return Math.sqrt((K / K0) / (Mm / M0));
}
// Typical reed sizes for a note: middle C about 27 mm long and 0.34 mm thick. Makers make bass tongues
// longer, wider and often weighted at the tip; here the length follows f^−0.45 and the thickness
// follows from the beam formula.
export function reedSize(f) {
  const L = 0.0275 * (261.6 / f) ** 0.45;
  return { L, t: (f * L * L) / C_BEAM, w: clamp(0.0042 * (261.6 / f) ** 0.25, 0.0026, 0.0065) };
}

// ---------------------------------------------------------------- the wind
// Air through an open reed: orifice flow Q = Cd·a·√(2p/ρ), Cd ≈ 0.6, with a the reed's average open
// area over a cycle: about 3 mm² for a middle reed, more for big bass reeds (our estimate for harmonium
// reeds; accordion reeds measured by Ricot et al. 2005 pass air on this scale).
export const RHO_AIR = 1.2, CD = 0.6;
export const reedArea = (f) => 3e-6 * Math.sqrt(261.6 / f);
export const reedFlow = (f, p) => CD * reedArea(f) * Math.sqrt((2 * Math.max(0, p)) / RHO_AIR) * 1000;   // L/s
// Reeds need a small pressure before they start to swing ("speak"). Free reeds speak at a few tens of mm of water.
export const P_SPEAK = 150;
// The reservoir: an inner bellows about 3 L, held shut by springs. The springs' push over the board's
// area sets the pressure: about 0.45 kPa as it starts to lift, 1.5 kPa when full (roughly 45–150 mm of
// water, the range quoted for reed organs and harmoniums). Past full, a relief valve lets air out.
export const V_MAX = 3.0, V_STROKE = 2.4;                                // litres
export const pOfV = (V) => (450 + 1050 * clamp(V / V_MAX, 0, 1)) * smooth(V / 0.25);   // Pa
export const LEAK = 0.02;                                                 // L/s, the whole instrument's leaks
// How loud the reeds are for a pressure: silent below P_SPEAK, rising with pressure.
export const ampOfP = (p) => clamp((p - P_SPEAK) / 1250, 0, 1) ** 0.7;

// ---------------------------------------------------------------- the engine
// Holds the keys, stops, tuning and wind, and turns them into reeds that sound, air use, pressure and sound.
export function makeEngine(o = {}) {
  const E = {
    banks: { bass: false, male: true, female: false, musette: false, ...(o.banks || {}) },
    drones: { sa: false, pa: false },
    tuning: 'et', shift: 0,
    keys: new Array(NKEYS).fill(0),          // held by the computer keyboard
    taps: new Array(NKEYS).fill(0),          // seconds left from clicks and phrases
    down: new Array(NKEYS).fill(0),          // shown (smoothed) key position
    V: o.V ?? 2.2, p: 0, flowOut: 0, flowIn: 0, vent: false,
    autoPump: o.autoPump ?? true, pumpHeld: false, steady: false, pumpRate: 1.1, stroke: 0.8, strokesLeft: 0,
    theta: 0, phase: 0, pumping: false, openness: 0,       // bellows: 0 closed … 1 wide open
    phrase: null, t: 0, hist: [], histT: 0, sounding: [], amp: 0, quiet: false, hear: true, sustain: new Set(),
    held(i) { return this.keys[i] > 0 || this.taps[i] > 0 || this.sustain.has(i); },
    // Sound only when asked to, or when someone is actually playing.
    get silent() { return this.quiet || (!this.hear && !this.phrase && !this.keys.some((x) => x > 0) && !this.taps.some((x) => x > 0)); },
    tap(i, d = 1.1) { if (i >= 0 && i < NKEYS) this.taps[i] = Math.max(this.taps[i], d); },
    pump(n = 2) { this.strokesLeft = Math.max(this.strokesLeft, n); },
    // steps: [{ k: [key indices], d: seconds }]
    play(steps, loop = false) { this.phrase = { steps, i: 0, t: 0, loop }; },
    stop() { this.phrase = null; this.taps.fill(0); },
    heldKeys() { const a = []; for (let i = 0; i < NKEYS; i++) if (this.held(i)) a.push(i); return a; },
    // Every reed that has air: { id, bank, r, f, q (L/s) }.
    reeds(p = this.p) {
      const out = [];
      const add = (id, bank, r, f) => out.push({ id, bank, r, f, q: reedFlow(f, p) });
      for (const i of this.heldKeys()) {
        const r = i + this.shift, f = reedFreq(r, this.tuning);
        for (const b of BANK_ORDER) if (this.banks[b]) add(b + r, b, r, bankFreq(f, b));
      }
      for (const [k, d] of Object.entries(DRONES)) if (this.drones[k]) add('d' + k, 'drone', d.r, reedFreq(d.r, this.tuning) * d.mult);
      return out;
    },
    update(dt) {
      dt = Math.max(0, Math.min(0.1, dt));
      this.t += dt;
      // Phrases press keys for set times.
      const ph = this.phrase;
      if (ph) {
        const st = ph.steps[ph.i];
        if (st) {
          if (ph.t === 0) (st.k || []).forEach((k) => { this.taps[k] = Math.max(this.taps[k], st.d * 0.94); });
          ph.t += dt;
          if (ph.t >= st.d) { ph.i++; ph.t = 0; }
        } else if (ph.loop) { ph.i = 0; ph.t = 0; } else this.phrase = null;
      }
      for (let i = 0; i < NKEYS; i++) {
        this.taps[i] = Math.max(0, this.taps[i] - dt);
        this.down[i] += ((this.held(i) ? 1 : 0) - this.down[i]) * Math.min(1, dt * 30);
      }
      // Bellows. A stroke opens the flap (drawing room air in through the intake valve), then pushes it
      // shut, which forces that air through a one-way valve into the reservoir.
      const autoWant = this.autoPump && (this.V < V_MAX * 0.62 || (this.pumping && this.V < V_MAX * 0.85));
      const want = this.pumpHeld || this.steady || this.strokesLeft > 0 || autoWant;
      if (want || this.phase % 1 > 1e-6) {
        const was = this.phase;
        this.phase += dt * this.pumpRate;
        if (Math.floor(this.phase) > Math.floor(was)) {
          this.strokesLeft = Math.max(0, this.strokesLeft - 1);
          if (!(this.pumpHeld || this.steady || this.strokesLeft > 0 || autoWant)) this.phase = Math.floor(this.phase);
        }
      }
      this.pumping = want;
      const c = this.phase % 1, open = c < 0.5 ? smooth(c / 0.5) : 1 - smooth((c - 0.5) / 0.5);
      const shut = Math.max(0, this.openness - open * this.stroke);
      this.openness = open * this.stroke;
      this.flowIn = dt > 0 ? (shut * V_STROKE) / dt : 0;
      // Reservoir: air in from the bellows, out through the reeds and leaks.
      this.p = pOfV(this.V);
      const rs = this.p > P_SPEAK ? this.reeds(this.p) : [];
      this.flowOut = rs.reduce((a, r) => a + r.q, 0) + (this.V > 0 ? LEAK : 0);
      this.V += shut * V_STROKE - this.flowOut * dt;
      this.vent = this.V > V_MAX;
      this.V = clamp(this.V, 0, V_MAX);
      this.p = pOfV(this.V);
      this.amp += (ampOfP(this.p) - this.amp) * Math.min(1, dt * 25);
      this.sounding = rs;
      this.histT += dt;
      if (this.histT >= 0.05) { this.histT = 0; this.hist.push({ p: this.p, q: this.flowOut, pump: shut > 0, n: rs.length }); if (this.hist.length > 240) this.hist.shift(); }
      voice.set(this.silent ? [] : rs, this.amp, clamp((this.p - 400) / 1100, 0, 1));
      return this;
    },
  };
  E.p = pOfV(E.V);
  return E;
}

// ---------------------------------------------------------------- voice
// A free-reed voice. Each sounding reed is an oscillator with a buzzy, sawtooth-like spectrum (a free reed
// chops the air into sharp puffs, so it is rich in harmonics). All reeds share a "formant" filter for the
// reed cell and the wooden case, and a low-pass that opens as the pressure rises. Banks are slightly
// detuned, so two banks together chorus. Volume follows the reservoir pressure. It starts only after a
// real click or key press, respects the mute button and never plays while the studio records.
let ctx = null, gestured = false, V = null;
if (typeof window !== 'undefined') {
  const mark = () => { gestured = true; };
  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, mark, { capture: true, passive: true }));
}
export const recording = () => typeof document !== 'undefined' && (document.body.classList.contains('gb-reel') || /[?&]reel=1/.test(location.search));
function ready() {
  if (audio.muted || recording()) return null;
  if (!gestured && !navigator.userActivation?.hasBeenActive) return null;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!V) {
      const master = ctx.createGain(); master.gain.value = 0.85;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.knee.value = 8;
      master.connect(comp).connect(ctx.destination);
      const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = rnd() * Math.exp((-6 * i) / len); }
      conv.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.14; wet.connect(conv).connect(master);
      const bus = ctx.createGain(); bus.gain.value = 0;               // follows the wind pressure
      const f1 = ctx.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = 1150; f1.Q.value = 1.3; f1.gain.value = 7;
      const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 2700; f2.Q.value = 2.2; f2.gain.value = 4;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 0.5;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 55;
      bus.connect(f1).connect(f2).connect(lp).connect(hp);
      hp.connect(master); hp.connect(wet);
      // A free reed's airflow is a train of sharp puffs: harmonics fall off slowly, about 1/n^0.8.
      const N = 32, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) im[n] = (1 / n ** 0.8) * (n % 2 ? 1 : 0.8);
      const wave = ctx.createPeriodicWave(re, im);
      V = { master, bus, lp, wave, notes: new Map(), last: { amp: -1, bright: -1 } };
    }
    return ctx;
  } catch { return null; }
}
const setT = (param, v, tc) => { try { param.setTargetAtTime(v, ctx.currentTime, tc); } catch { /* ignore */ } };
function release(id) {
  const n = V.notes.get(id); if (!n) return;
  setT(n.g.gain, 0, 0.03);
  try { n.o.stop(ctx.currentTime + 0.3); } catch { /* ignore */ }
  V.notes.delete(id);
}
export const voice = {
  set(reeds, amp, bright) {
    if (!ctx && !reeds.length) return;
    if (!ready()) { if (V && ctx) { setT(V.master.gain, 0, 0.02); [...V.notes.keys()].forEach(release); } return; }
    setT(V.master.gain, 0.85, 0.02);
    const seen = new Set();
    const n = Math.max(1, reeds.length);
    for (const r of reeds) {
      seen.add(r.id);
      let v = V.notes.get(r.id);
      const lvl = ((r.bank === 'drone' ? 0.7 : BANKS[r.bank].lvl) * 0.2) / Math.sqrt(Math.max(1, n / 3));
      if (!v) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.setPeriodicWave(V.wave); o.frequency.value = r.f;
        g.gain.value = 0; o.connect(g).connect(V.bus); o.start();
        setT(g.gain, lvl, 0.025);                                // a free reed takes a few cycles to swing up
        v = { o, g, f: r.f, lvl }; V.notes.set(r.id, v);
      } else {
        if (Math.abs(v.f - r.f) > 0.01) { setT(v.o.frequency, r.f, 0.01); v.f = r.f; }
        if (Math.abs(v.lvl - lvl) > 0.003) { setT(v.g.gain, lvl, 0.05); v.lvl = lvl; }
      }
    }
    [...V.notes.keys()].forEach((id) => { if (!seen.has(id)) release(id); });
    if (Math.abs(amp - V.last.amp) > 0.004) { setT(V.bus.gain, amp, 0.04); V.last.amp = amp; }
    if (Math.abs(bright - V.last.bright) > 0.02) { setT(V.lp.frequency, 1800 + 4500 * bright, 0.06); V.last.bright = bright; }
  },
  off() { if (V && ctx) [...V.notes.keys()].forEach(release); },
};

// ---------------------------------------------------------------- computer keyboard
// A W S E D F T G Y H U J K O L P ; play C4 … E5 like a piano (A = Sa on the middle C key). Z and X move
// that row down or up an octave. Hold the space bar to pump the bellows. 1–4 toggle the bass, male, female
// and musette stops. Returns a remover.
const ROW = 'awsedftgyhujkolp;';
export function harmoniumKeys(E, { onStop } = {}) {
  let oct = 0;
  const busy = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.getElementById('modal')?.hidden === false;
  const keyOf = (e) => { const j = ROW.indexOf(e.key.toLowerCase()); return j < 0 ? -1 : clamp(12 + 12 * oct + j, 0, NKEYS - 1); };
  const down = new Map();
  const kd = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || busy()) return;
    if (e.code === 'Space') { if (document.activeElement?.tagName === 'BUTTON') document.activeElement.blur(); e.preventDefault(); E.pumpHeld = true; return; }
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.repeat) { oct = Math.max(-1, oct - 1); return; }
    if (k === 'x' && !e.repeat) { oct = Math.min(1, oct + 1); return; }
    if ('1234'.includes(k) && k && !e.repeat) { const b = BANK_ORDER[+k - 1]; E.banks[b] = !E.banks[b]; onStop?.(b, E.banks[b]); return; }
    const i = keyOf(e);
    if (i >= 0 && !e.repeat) { E.keys[i] = 1; down.set(e.code, i); E.phrase = null; e.preventDefault(); }
  };
  const ku = (e) => {
    if (e.code === 'Space') E.pumpHeld = false;
    if (down.has(e.code)) { E.keys[down.get(e.code)] = 0; down.delete(e.code); }
  };
  const blur = () => { E.pumpHeld = false; E.keys.fill(0); down.clear(); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
  return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); blur(); voice.off(); };
}
// Sa = the middle C key (index 12). Semitones from Sa → key index.
export const SA = 12;
export const k = (semi) => SA + semi;

// ---------------------------------------------------------------- 3D: the harmonium
// A 39-key Indian hand harmonium, about 60 × 32 × 24 cm (without the bellows). Parts can be exploded
// and the case made see-through to show the reeds, pallets, reservoir and air.
const WOOD = 0x6b3a1f, WOOD2 = 0x8a4f2a, BRASS = 0xc9a24f;
export const H = { W: 0.6, D: 0.32, Hh: 0.24, pitch: 0.022 };
export function keyX(i) {
  // White keys every 22 mm; a black key sits between its neighbours.
  let w = 0; for (let j = 0; j < i; j++) if (!isBlack(j)) w++;
  const nW = 23, x0 = -((nW * H.pitch) / 2);
  return isBlack(i) ? x0 + w * H.pitch : x0 + (w + 0.5) * H.pitch;
}
const BANK_Z = { bass: -0.112, musette: -0.062, male: -0.016, female: 0.022 };
const BANK_MAXLEN = { bass: 0.058, musette: 0.044, male: 0.044, female: 0.03 };
export function makeHarmonium({ banks = ['bass', 'male', 'female'], stops = true } = {}) {
  const g = new THREE.Group();
  const { W, D, Hh } = H;
  const wood = M.matte(WOOD, { roughness: 0.55 }), wood2 = M.matte(WOOD2, { roughness: 0.5 });
  const caseMats = [wood, wood2];
  const shell = new THREE.Group(); g.add(shell);
  // The case: a floor, two ends, a front panel below the keys and a back frame the bellows fix to.
  const floor = box(W, 0.015, D, wood); floor.position.set(0, 0.0075, 0); shell.add(floor);
  const endL = box(0.018, Hh, D, wood2); endL.position.set(-W / 2 + 0.009, Hh / 2, 0); shell.add(endL);
  const endR = endL.clone(); endR.position.x = W / 2 - 0.009; shell.add(endR);
  const front = box(W, Hh - 0.03, 0.015, wood); front.position.set(0, (Hh - 0.03) / 2, D / 2 - 0.0075); shell.add(front);
  const back = box(W, Hh - 0.026, 0.01, wood); back.position.set(0, 0.02 + (Hh - 0.026) / 2, -D / 2 + 0.005); shell.add(back);
  // Carved trim on the front, a common touch on Indian harmoniums.
  const trim = box(W * 0.8, 0.012, 0.004, M.metal(BRASS, { roughness: 0.4 })); trim.position.set(0, 0.07, D / 2 + 0.002); shell.add(trim);
  // The lid over the reed board, with a louvred grill that lets the sound out.
  const lid = new THREE.Group(); lid.position.set(0, Hh, -0.055); g.add(lid);
  const lidTop = box(W, 0.012, 0.21, wood2); lid.add(lidTop);
  const grillBars = [];
  const grillMat = M.plastic(0x1a1110, { roughness: 0.9 });
  for (let j = 0; j < 14; j++) { const b = box(0.006, 0.013, 0.12, grillMat); b.position.set(-0.2 + j * 0.031, 0.001, 0); lid.add(b); grillBars.push(b); }
  // The stop rail with its knobs, just behind the keys, facing the player.
  const stopsG = new THREE.Group(); g.add(stopsG);
  const rail = box(W - 0.04, 0.05, 0.022, wood); rail.position.set(0, Hh + 0.025, 0.045); stopsG.add(rail);
  const knobDefs = stops ? [...banks.map((b) => ({ id: b, label: BANKS[b].label })), { id: 'sa', label: 'Sa drone' }, { id: 'pa', label: 'Pa drone' }] : [];
  const knobs = knobDefs.map((d, j) => {
    const kg = new THREE.Group();
    const x = -0.2 + j * (0.4 / Math.max(1, knobDefs.length - 1));
    kg.position.set(x, Hh + 0.034, 0.056);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 12), M.metal(BRASS)); stem.rotation.x = Math.PI / 2; stem.position.z = 0.0;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 24), M.plastic(d.id.length === 2 ? 0xe9dcc0 : 0x2b1a12)); head.rotation.x = Math.PI / 2; head.position.z = 0.012;
    head.castShadow = true; kg.add(stem, head); stopsG.add(kg);
    head.userData.stop = d.id; stem.userData.stop = d.id;
    return { ...d, g: kg, head, out: 0 };
  });
  // Keys: white and black, each a lever. Pressing tips it down at the front.
  const keysG = new THREE.Group(); keysG.position.set(0, Hh, 0.115); g.add(keysG);
  const whiteM = M.plastic(0xf3efe6, { roughness: 0.35 }), blackM = M.plastic(0x16120f, { roughness: 0.3 });
  const keyHot = M.plastic(0xffd9a0, { roughness: 0.35, emissive: 0x6a3a00, emissiveIntensity: 0.4 });
  const keys = [];
  for (let i = 0; i < NKEYS; i++) {
    const b = isBlack(i), x = keyX(i);
    const pv = new THREE.Group(); pv.position.set(x, 0, -0.035); keysG.add(pv);
    const m = b ? box(0.011, 0.012, 0.06, blackM) : box(H.pitch - 0.0015, 0.012, 0.1, whiteM);
    m.position.set(0, b ? 0.012 : 0.006, b ? 0.018 : 0.035); pv.add(m);
    m.userData.key = i;
    keys.push({ pv, m, black: b, base: b ? blackM : whiteM });
  }
  // Inside: the reservoir (inner bellows) with springs, the wind chest, the reed board and pallets.
  const inner = new THREE.Group(); g.add(inner);
  const resBase = box(W - 0.06, 0.008, D - 0.08, wood2); resBase.position.set(0, 0.02, -0.02); inner.add(resBase);
  const resTop = box(W - 0.08, 0.01, D - 0.1, wood2); resTop.position.set(0, 0.06, -0.02); inner.add(resTop);
  const clothMat = M.matte(0x3a2a40, { roughness: 0.9, transparent: true, opacity: 0.85 });
  const cloth = box(W - 0.07, 1, D - 0.09, clothMat); cloth.position.set(0, 0.04, -0.02); cloth.scale.y = 0.04; inner.add(cloth);
  const springs = [-0.18, 0, 0.18].map((x) => {
    const sp = spring(0, 1, 0.012, 0.0022, 5, M.metal(0xc8ccd4)); sp.rotation.z = Math.PI / 2; sp.position.set(x, 0.065, -0.02); inner.add(sp); return sp;
  });
  const chestTopY = 0.14;
  const chestFloor = box(W - 0.05, 0.01, D - 0.07, wood); chestFloor.position.set(0, 0.12, -0.02); inner.add(chestFloor);
  const trunk = box(0.05, 0.05, 0.05, wood2); trunk.position.set(-0.22, 0.095, -0.1); inner.add(trunk);
  // Reed board: one row of reed cells per bank, running along the keyboard.
  const board = box(W - 0.06, 0.03, 0.19, M.matte(0x9c6b3e, { transparent: true, opacity: 0.55, depthWrite: false })); board.position.set(0, chestTopY + 0.015, -0.05); inner.add(board);
  const brass = M.metal(BRASS, { roughness: 0.32 }), brassHot = M.glow(0xffd27a);
  const reeds = {};
  for (const b of banks) {
    reeds[b] = [];
    for (let r = 0; r < NKEYS; r++) {
      const f = bankFreq(reedFreq(r), b), sz = reedSize(Math.max(40, f));
      const len = clamp(sz.L * 1.35, 0.012, BANK_MAXLEN[b]);
      const plate = box(0.009, 0.003, len, brass);
      plate.position.set(keyX(r), chestTopY + 0.031, BANK_Z[b]);
      inner.add(plate); reeds[b].push(plate);
    }
  }
  // Drone reeds live in their own cells at the right-hand end.
  const droneReeds = { sa: box(0.012, 0.003, 0.05, brass), pa: box(0.014, 0.003, 0.062, brass) };
  droneReeds.sa.position.set(0.272, chestTopY + 0.031, -0.03); droneReeds.pa.position.set(0.272, chestTopY + 0.031, -0.1);
  inner.add(droneReeds.sa, droneReeds.pa);
  // Pallets: one padded valve per key over its reed cells. The key's lever lifts it.
  const palletM = M.matte(0xe8e0cf), palletHot = M.glow(0x8ef0ff);
  const pallets = [];
  for (let i = 0; i < NKEYS; i++) { const p = box(0.009, 0.006, 0.18, palletM); p.position.set(keyX(i), chestTopY + 0.037, -0.05); inner.add(p); pallets.push(p); }
  // The bellows: a hand flap on the back, hinged along its right-hand edge, with pleated cloth folds.
  const bell = new THREE.Group(); bell.position.set(W / 2 - 0.01, 0.02, -D / 2); g.add(bell);
  const flapPiv = new THREE.Group(); bell.add(flapPiv);
  const flapW = W - 0.02, flapH = Hh - 0.026;
  const flap = box(flapW, flapH, 0.012, wood2); flap.position.set(-flapW / 2, flapH / 2, -0.006); flapPiv.add(flap);
  const handle = box(0.02, 0.1, 0.02, M.matte(0x2a1a10)); handle.position.set(-flapW + 0.03, flapH / 2, -0.022); flapPiv.add(handle);
  const strap = box(0.012, 0.13, 0.006, M.matte(0x7a1f1f)); strap.position.set(-flapW + 0.03, flapH / 2, -0.036); flapPiv.add(strap);
  flap.userData.bellows = true; handle.userData.bellows = true; strap.userData.bellows = true;
  const pleatMat = M.matte(0x5a1e22, { side: THREE.DoubleSide, roughness: 0.8 });
  const pleats = [1, 2, 3, 4].map(() => { const p = new THREE.Mesh(new THREE.PlaneGeometry(flapW, flapH), pleatMat); p.position.y = flapH / 2; const pg = new THREE.Group(); p.position.x = -flapW / 2; pg.add(p); bell.add(pg); return pg; });
  // A top and bottom gusset for the wedge (drawn as thin triangles that follow the flap).
  const gusGeo = new THREE.BufferGeometry(); gusGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
  const gus = new THREE.Mesh(gusGeo, pleatMat); bell.add(gus);
  // The intake valve (on the flap) and the one-way valve into the reservoir (on the back frame).
  const valveM = M.matte(0xd9c9a8);
  const valveIn = box(0.05, 0.035, 0.003, valveM); valveIn.position.set(-flapW * 0.55, flapH * 0.5, 0.001); flapPiv.add(valveIn);
  const valvePiv = new THREE.Group(); valvePiv.position.set(-0.46, 0.08, 0.012); bell.add(valvePiv);
  const valveOut = box(0.05, 0.035, 0.003, valveM); valveOut.position.set(0, -0.0175, 0.0015); valvePiv.add(valveOut);
  // X-ray: make the case see-through.
  const xrayMats = [wood, wood2, grillMat];
  const api = {
    group: g, shell, lid, stopsG, rail, knobs, endL, endR, front, back, trim, floor, keysG, keys, inner, resTop, cloth, springs, board, reeds, droneReeds, pallets, bell, flapPiv, handle, pleats, valveOut, valveIn, trunk,
    pickables: [...keys.map((k) => k.m), ...knobs.flatMap((kn) => [kn.head, kn.stem]), flap, handle, strap],
    setXray(k) {
      xrayMats.forEach((m) => { const on = k > 0.01; if (m.transparent !== on) { m.transparent = on; m.depthWrite = !on; m.needsUpdate = true; } m.opacity = 1 - 0.8 * k; });
    },
    // E: an engine. Shows keys, pallets, sounding reeds, stops, bellows and reservoir.
    sync(E) {
      keys.forEach((kk, i) => { const d = E.down[i]; kk.pv.rotation.x = d * 0.06; kk.m.material = d > 0.5 ? keyHot : kk.base; });
      pallets.forEach((p, i) => { const d = E.down[i]; p.position.y = chestTopY + 0.037 + d * 0.012; p.material = d > 0.5 && E.p > P_SPEAK ? palletHot : palletM; });
      const on = new Set(E.sounding.map((r) => r.id));
      for (const b of banks) reeds[b].forEach((pl, r) => { pl.material = on.has(b + r) ? brassHot : brass; pl.position.y = chestTopY + 0.031 + (on.has(b + r) ? 0.0012 * Math.sin(E.t * 90 + r) : 0); });
      droneReeds.sa.material = on.has('dsa') ? brassHot : brass; droneReeds.pa.material = on.has('dpa') ? brassHot : brass;
      knobs.forEach((kn) => {
        const want = kn.id in E.banks ? E.banks[kn.id] : !!E.drones[kn.id];
        kn.out += ((want ? 1 : 0) - kn.out) * 0.25; kn.g.position.z = 0.056 + kn.out * 0.02;
      });
      this.setBellows(E.openness);
      const fill = E.V / V_MAX;
      resTop.position.y = 0.032 + fill * 0.05;
      cloth.scale.y = Math.max(0.005, resTop.position.y - 0.02); cloth.position.y = 0.02 + cloth.scale.y / 2;
      springs.forEach((sp) => { const top = chestTopY - 0.02, bot = resTop.position.y + 0.005; sp.position.y = bot; sp.scale.x = Math.max(0.01, top - bot); });
      valvePiv.rotation.x = E.flowIn > 0.05 ? 0.6 : 0;
      valveIn.visible = true; valveIn.position.z = E.openness > 0 && E.flowIn <= 0 ? 0.008 : 0.001;
    },
    setBellows(open) {
      const a = open * 0.3;                         // up to about 17°: the free end opens roughly 10 cm
      flapPiv.rotation.y = -a;
      pleats.forEach((p, j) => { p.rotation.y = -a * (j + 1) / 5; });
      const pos = gusGeo.attributes.position.array, ex = -flapW * Math.cos(a), ez = -flapW * Math.sin(a);
      pos.set([0, 0.001, 0, -flapW, 0.001, 0, ex, 0.001, ez, 0, flapH, 0, ex, flapH, ez, -flapW, flapH, 0]);
      gusGeo.attributes.position.needsUpdate = true; gusGeo.computeVertexNormals(); gus.visible = a > 0.005;
    },
  };
  api.setBellows(0);
  return api;
}

// Particles of air along a path. pts: [x,y,z] waypoints. speed follows flow; returns { mesh, update(dt, rate) }.
export function airPath(swarmMesh, start, count, paths) {
  const st = Array.from({ length: count }, (_, i) => ({ s: (i / count) * 1.0001, p: i % paths.length, j: (i * 7919) % 1000 / 1000 }));
  const seg = paths.map((pts) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2])); return L; });
  const at = (pi, s) => {
    const pts = paths[pi], L = seg[pi], d = s * L[L.length - 1];
    let i = 1; while (i < L.length - 1 && L[i] < d) i++;
    const k = (d - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]), a = pts[i - 1], b = pts[i];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
  return {
    update(dt, rate, visible = true, jitter = 0.004) {
      st.forEach((q, i) => {
        q.s += dt * rate * (0.8 + 0.4 * q.j);
        if (q.s > 1) { q.s -= 1; }
        const [x, y, z] = at(q.p, q.s);
        swarmMesh.place(start + i, [x + (q.j - 0.5) * jitter * 2, y + ((q.j * 13) % 1 - 0.5) * jitter, z + ((q.j * 7) % 1 - 0.5) * jitter * 2], null, visible && rate > 0.001 ? 1 : 0.0001);
      });
    },
    setPaths(newPaths) { newPaths.forEach((p, i) => { if (paths[i]) { paths[i] = p; const L = [0]; for (let j = 1; j < p.length; j++) L.push(L[j - 1] + Math.hypot(p[j][0] - p[j - 1][0], p[j][1] - p[j - 1][1], p[j][2] - p[j - 1][2])); seg[i] = L; } }); },
  };
}

// The air in a harmonium, as particles: orange from the bellows through the one-way valve into the
// reservoir, blue from the reservoir up the wind trunk into the chest, through the reeds of the held keys
// and out of the grill. Speeds follow the real flows.
export function airFlow(parent, { NS = 70, ND = 150, size = 0.0042 } = {}) {
  const mesh = swarm(NS + ND, new THREE.SphereGeometry(size, 8, 6), M.glow(0xffffff)); parent.add(mesh);
  const col = new THREE.Color();
  for (let i = 0; i < NS + ND; i++) mesh.setColorAt(i, col.set(i < NS ? 0xffb547 : 0x8ef0ff));
  const supply = airPath(mesh, 0, NS, [
    [[-0.2, 0.14, -0.2], [-0.19, 0.1, -0.175], [-0.17, 0.08, -0.155], [-0.16, 0.05, -0.11], [0.0, 0.04, -0.03]],
    [[-0.05, 0.1, -0.2], [-0.12, 0.09, -0.18], [-0.17, 0.08, -0.155], [-0.12, 0.045, -0.08], [0.12, 0.04, 0.0]],
  ]);
  const outPath = (x) => [[0.05, 0.04, -0.02], [-0.22, 0.05, -0.1], [-0.22, 0.13, -0.1], [x, 0.133, -0.06], [x, 0.155, -0.02], [x, 0.19, -0.05], [x, 0.3, -0.06]];
  const demand = airPath(mesh, NS, ND, [0, 1, 2, 3].map(() => outPath(0)));
  return {
    mesh,
    update(dt, E, show = true) {
      const held = E.heldKeys().slice(0, 4);
      if (E.drones.sa || E.drones.pa) held.push(-1);
      demand.setPaths([0, 1, 2, 3].map((j) => outPath(held.length ? (held[j % held.length] < 0 ? 0.272 : keyX(held[j % held.length])) : keyX(12))));
      supply.update(dt, E.flowIn * 0.5, show);
      demand.update(dt, held.length && E.p > P_SPEAK ? 0.25 + E.flowOut * 0.6 : 0, show);
      mesh.done();
    },
  };
}

// ---------------------------------------------------------------- 3D: a seated player
const SKIN = 0xa86f4f;
export function makePlayer() {
  const g = new THREE.Group();
  const skin = M.plastic(SKIN, { roughness: 0.7 }), kurta = M.matte(0xefe6d2), dhoti = M.matte(0xd8cdb4), hair = M.matte(0x1c1512);
  const cap = (a, b, r, mat) => { const m = beam(a, b, r, mat, 14); const s1 = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); s1.position.set(...a); const s2 = s1.clone(); s2.position.set(...b); const gg = new THREE.Group(); gg.add(m, s1, s2); return gg; };
  // Cross-legged on the floor, facing −z. Metres.
  g.add(cap([-0.2, 0.07, 0.42], [0.12, 0.07, 0.2], 0.065, dhoti));
  g.add(cap([0.2, 0.07, 0.42], [-0.12, 0.07, 0.2], 0.065, dhoti));
  const torso = cap([0, 0.14, 0.44], [0, 0.52, 0.38], 0.13, kurta); g.add(torso);
  const neck = cap([0, 0.6, 0.37], [0, 0.66, 0.36], 0.04, skin); g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 16), skin); head.scale.set(1, 1.12, 1); head.position.set(0, 0.76, 0.35); head.castShadow = true; g.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 12, 0, TAU, 0, Math.PI * 0.55), hair); hairM.position.set(0, 0.785, 0.365); hairM.rotation.x = -0.35; g.add(hairM);
  // Arms: an upper arm and a forearm per side, re-aimed every frame from shoulder to elbow to hand.
  const Y = new THREE.Vector3(0, 1, 0), va = new THREE.Vector3(), vb = new THREE.Vector3();
  const limb = (r, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 14), mat); m.castShadow = true; g.add(m); return m; };
  const joint = (r, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); m.castShadow = true; g.add(m); return m; };
  const aim = (m, a, b) => { va.set(...a); vb.set(...b); m.position.copy(va).add(vb).multiplyScalar(0.5); m.scale.set(1, Math.max(1e-3, va.distanceTo(vb)), 1); m.quaternion.setFromUnitVectors(Y, vb.clone().sub(va).normalize()); };
  const arms = ['R', 'L'].map(() => ({ up: limb(0.045, kurta), fore: limb(0.034, skin), sh: joint(0.05, kurta), el: joint(0.04, kurta), hand: joint(0.04, skin) }));
  arms.forEach((a) => a.hand.scale.set(1, 0.5, 1.2));
  const api = {
    group: g,
    // Hand targets in the player's frame (metres); elbows go out to the side and a little down.
    pose(right, left) {
      [[arms[0], right, [0.17, 0.54, 0.36], 1], [arms[1], left, [-0.17, 0.54, 0.36], -1]].forEach(([a, hand, sh, out]) => {
        const el = [(sh[0] + hand[0]) / 2 + out * 0.1, (sh[1] + hand[1]) / 2 - 0.05, (sh[2] + hand[2]) / 2 + 0.05];
        aim(a.up, sh, el); aim(a.fore, el, hand);
        a.sh.position.set(...sh); a.el.position.set(...el); a.hand.position.set(...hand);
      });
    },
  };
  return api;
}

// ---------------------------------------------------------------- boards
function panel(c, W, H, title, sub) {
  c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(7,8,12,.86)'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '28px sans-serif'; c.fillText(title, 26, 44);
  if (sub) { c.font = '20px sans-serif'; c.fillStyle = 'rgba(255,255,255,.55)'; c.fillText(sub, 26, 76); }
}
export function boardMesh(b, w, h) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: b.tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
}

// Pressure in the reservoir over the last 12 s, with the air the reeds use and each pump stroke.
export function pressureBoard(w = 900, h = 440) {
  let hist = [];
  const b = canvasTexture(w, h, (c, W, H) => {
    panel(c, W, H, 'Wind pressure in the reservoir', 'Last 12 seconds. Orange ticks: pump strokes. Blue: air the reeds use.');
    const x0 = 70, x1 = W - 30, y0 = H - 50, y1 = 100, pMax = 1800;
    const Y = (p) => y0 - (p / pMax) * (y0 - y1);
    c.fillStyle = 'rgba(92,225,169,.12)'; c.fillRect(x0, Y(1500), x1 - x0, Y(500) - Y(1500));
    c.fillStyle = 'rgba(92,225,169,.8)'; c.font = '18px sans-serif'; c.fillText('usual playing range', x1 - 170, Y(1500) - 8);
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y1 - 10); c.lineTo(x0, y0); c.lineTo(x1, y0); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '18px sans-serif';
    [0, 500, 1000, 1500].forEach((p) => c.fillText((p / 1000).toFixed(1), 20, Y(p) + 6));
    c.fillText('kPa', 20, y1 - 14);
    c.fillStyle = 'rgba(255,122,89,.8)'; c.fillText(`speaks above ${P_SPEAK} Pa`, x0 + 10, Y(P_SPEAK) - 6);
    c.strokeStyle = 'rgba(255,122,89,.5)'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(x0, Y(P_SPEAK)); c.lineTo(x1, Y(P_SPEAK)); c.stroke(); c.setLineDash([]);
    const n = 240, X = (i) => x1 - ((hist.length - 1 - i) / (n - 1)) * (x1 - x0);
    c.fillStyle = 'rgba(122,162,255,.35)';
    hist.forEach((q, i) => { const hh = Math.min(1, q.q / 1.5) * 90; c.fillRect(X(i) - 1.5, y0 - hh, 3, hh); });
    c.fillStyle = 'rgba(255,181,71,.9)';
    hist.forEach((q, i) => { if (q.pump) c.fillRect(X(i) - 1, y0 + 6, 3, 10); });
    c.strokeStyle = '#8ef0ff'; c.lineWidth = 4; c.beginPath();
    hist.forEach((q, i) => { const x = X(i), y = Y(q.p); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
  });
  b.update = (E) => { hist = E.hist; b.redraw(); };
  return b;
}

// The spectrum of what is sounding: every harmonic of every reed, on a log frequency axis.
export function spectrumBoard(w = 900, h = 440) {
  let rs = [], cellF = 1150;
  const b = canvasTexture(w, h, (c, W, H) => {
    panel(c, W, H, 'Spectrum: the harmonics you hear', 'Each reed gives a full ladder of harmonics. Colours: which bank.');
    const x0 = 60, x1 = W - 30, y0 = H - 60, y1 = 100, lo = Math.log(50), hi = Math.log(6000);
    const X = (f) => x0 + ((Math.log(f) - lo) / (hi - lo)) * (x1 - x0);
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '18px sans-serif';
    [50, 100, 200, 500, 1000, 2000, 5000].forEach((f) => c.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), X(f) - 14, y0 + 26));
    c.fillText('Hz', x1 - 24, y0 + 48);
    if (!rs.length) { c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '24px sans-serif'; c.fillText('Silence: press a key and keep pumping', x0 + 120, (y0 + y1) / 2); return; }
    const col = (bk) => (bk === 'drone' ? '#c49bff' : BANKS[bk].color);
    for (const r of rs) {
      for (let n = 1; n <= 24; n++) {
        const f = r.f * n; if (f > 6000) break;
        const form = 1 + 1.2 * Math.exp(-(((Math.log(f / cellF)) / 0.35) ** 2));
        const a = (1 / n ** 0.8) * form * (r.bank === 'drone' ? 0.7 : BANKS[r.bank].lvl);
        const hh = clamp(a, 0, 1.4) / 1.4 * (y0 - y1);
        c.fillStyle = col(r.bank); c.globalAlpha = 0.75; c.fillRect(X(f) - 2, y0 - hh, 4, hh);
      }
    }
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([5, 6]); c.beginPath(); c.moveTo(X(cellF), y1); c.lineTo(X(cellF), y0); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText('reed-cell resonance', X(cellF) + 6, y1 + 16);
  });
  b.update = (reeds) => { const key = reeds.map((r) => r.id + r.f.toFixed(1)).join('|'); if (key !== b.key) { b.key = key; rs = reeds; b.redraw(); } };
  return b;
}

// On narrow screens, keep the headline and the first rows of a readout.
export function compact(html, stage, rows = 2) {
  if (stage.host.clientWidth >= 560) return html;
  let n = 0;
  return html.replace(/<small>[\s\S]*?<\/small>/g, '').replace(/<div class="(row|no)">[\s\S]*?<\/div>/g, (m) => (++n <= rows ? m : ''));
}
