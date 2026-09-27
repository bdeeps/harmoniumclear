// Chapter 5: tuning. A harmonium's reeds are fixed: equal temperament (12-TET) versus the pure ratios
// (just intonation) that Hindustani singers lean towards. Beats show the difference. The scale changer
// slides the keyboard over the reed board, so Sa stays under the same finger in any key.
import { THREE, canvasTexture } from '../kit.js';
import { makeHarmonium, makeEngine, harmoniumKeys, boardMesh, compact, k, reedFreq, noteOf, fmtHz, cents, JUST, SARGAM, SARGAM_SHORT, NKEYS } from '../harmonium.js';

const S = 10;
const KEYSTEP = 0.013;                       // the scale changer slides the keyboard about 13 mm a step
// Pure intervals: [semitones, p, q] with f_upper / f_Sa = p / q.
const IVL = { 4: [5, 4], 7: [3, 2], 5: [4, 3], 9: [5, 3], 2: [9, 8], 11: [15, 8] };
const CHORD = [{ v: 4, label: 'Sa + Ga' }, { v: 7, label: 'Sa + Pa' }, { v: 5, label: 'Sa + Ma' }, { v: 9, label: 'Sa + Dha' }];

export default {
  id: 'scale',
  short: 'Tuning and shrutis',
  title: 'Twelve fixed notes, and the notes in between',
  subtitle: 'Equal temperament, pure intervals, and the scale changer.',
  view: { pos: [-1.0, 8.2, 3.6], target: [-1.0, 1.0, 1.5] },
  learn: `<p>A singer or a sarangi player can slide to any pitch. A harmonium can't: each key has <b>reeds tuned once, in the factory</b>. Most are tuned to <b>equal temperament</b> (12-TET), the same system as a piano, where every semitone is exactly 100 <b>cents</b> (see <a href="/pianoclear/#scale">PianoClear</a>).</p>
    <p>Equal temperament is a clever compromise. It lets you play in any key, but only the octave is truly pure. The <b>pure</b> intervals, which singers settle into naturally, are simple ratios: Pa is 3/2 of Sa (702 cents), Ga is 5/4 (<b>386 cents</b>, not 400). Hindustani music goes further, with <b>shrutis</b>, finer pitches that shift from raga to raga, and slides (meend) between notes.</p>
    <p>When two notes are a little off a pure ratio, their harmonics clash and <b>beat</b>. An equal-tempered Sa and Ga on a harmonium beat about ten times a second. This is why many musicians, including <b>Rabindranath Tagore</b> and the British critics behind the 1940 ban on <b>All India Radio</b>, called it the wrong instrument for Indian music. Players answer with how they play: short notes, graces, and following the singer.</p>
    <p>Many harmoniums have a <b>scale changer</b>: the whole keyboard slides sideways over the reed board, so the key you play as Sa can sound a different reed. You keep your fingering and the singer gets their own pitch.</p>
    <p class="tip"><b>Try it:</b> hold Sa + Ga and switch between equal and pure tuning. Then choose pure tuning and slide the scale changer: in a new key some pure notes go badly out.</p>`,
  terms: [
    { t: 'Equal temperament', d: 'Tuning where every semitone is the same size, 100 cents, so all keys sound equally good (and equally slightly impure).' },
    { t: 'Just intonation', d: 'Tuning with pure, whole-number frequency ratios such as 3/2 and 5/4.' },
    { t: 'Cent', d: 'A hundredth of a semitone. An octave is 1,200 cents.' },
    { t: 'Shruti', d: 'One of the fine pitch steps of Indian music; tradition counts 22 in an octave.' },
    { t: 'Sargam', d: 'The Indian note names: Sa Re Ga Ma Pa Dha Ni.' },
    { t: 'Scale changer', d: 'A keyboard that slides over the reeds to move every note up or down by semitones.' },
  ],
  defaults: { tuning: 'et', chord: 4, shift: 0, hold: true, hear: false },
  controls: [
    { key: 'tuning', type: 'seg', label: 'Reeds tuned to', options: [{ v: 'et', label: 'Equal (12-TET)' }, { v: 'just', label: 'Pure ratios (in C)' }] },
    { key: 'chord', type: 'seg', label: 'Hold two keys', options: CHORD },
    { key: 'shift', type: 'range', label: 'Scale changer', min: -5, max: 6, step: 1, fmt: (v) => (v === 0 ? 'Sa = C' : `Sa = ${noteOf(reedFreq(12 + v)).name.replace(/\d/, '')} (${v > 0 ? '+' : ''}${v})`) },
    { key: 'hold', type: 'toggle', label: 'Hold the keys down' },
    { key: 'hear', type: 'toggle', label: 'Hear it', hint: 'Listen for the slow wobble of beats.' },
    { key: 'go', type: 'buttons', label: 'Play', items: [{ label: '♪ Sa Re Ga Ma Pa Dha Ni Sa', act: (s, inst) => inst.scale() }] },
  ],
  quiz: [
    { q: 'On an equal-tempered harmonium, how far is Ga above Sa, and how far is a pure Ga (5/4)?', options: ['400 and 386 cents', '386 and 400 cents', 'Both 400 cents', '500 and 498 cents'], answer: 0, why: 'Equal temperament makes four semitones exactly 400 cents. The pure ratio 5/4 is 386 cents, 14 cents lower.' },
    { q: 'What does a scale changer do?', options: ['Retunes every reed', 'Slides the keyboard over the reeds so each key sounds a different reed', 'Adds a drone', 'Makes the reeds louder'], answer: 1, why: 'It moves the keys relative to the reed board by whole semitones. Same fingers, different pitch.' },
    { q: 'Why did some musicians criticise the harmonium for Indian music?', options: ['It was too loud', 'Its fixed, equal-tempered notes cannot bend or match shrutis', 'It needed electricity', 'It had no black keys'], answer: 1, why: 'Its pitches are fixed and slightly impure, and it cannot slide between notes like a voice.' },
  ],
  reel: [
    { ms: 5800, caption: 'Its reeds are tuned once and fixed: Ga sits at 400 cents, but a pure Ga is 386.', set: { tuning: 'et', chord: 4, shift: 0, hold: true }, view: { pos: [-0.2, 5.6, 3.9], target: [-0.2, 1.1, 1.9] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.scale.setScalar(S); stage.root.add(root);
    const h = makeHarmonium({ banks: ['male'], stops: false }); root.add(h.group);
    h.setXray(0.35);
    stage.pickables.push(...h.keys.map((kk) => kk.m));
    const E = makeEngine({ autoPump: true, V: 2.6 });
    const home = h.keysG.position.x;
    // Sargam on one octave of keys, from the Sa key.
    const labs = [];
    for (let j = 0; j <= 12; j++) {
      const kk = h.keys[k(j)];
      const wi = labs.filter((l) => !l.black).length;
      const l = stage.label(j === 12 ? 'Sa′' : SARGAM_SHORT[j], [0, kk.black ? 0.03 : 0.018, kk.black ? 0.035 - (labs.filter((q) => q.black).length % 2) * 0.03 : 0.08 - (wi % 2) * 0.03], kk.m, j === 0 || j === 12 ? 'hot' : '');
      Object.assign(l.element.style, { padding: '1px 5px', fontSize: '11px' });
      l.black = kk.black; labs.push(l);
    }
    const chart = canvasTexture(900, 440, (c, W, H, st = { tuning: 'et', chord: 4, shift: 0 }) => {
      c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(7,8,12,.86)'; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '28px sans-serif'; c.fillText('Equal steps against pure ratios', 26, 44);
      c.font = '20px sans-serif'; c.fillStyle = 'rgba(255,255,255,.55)'; c.fillText('Cents above Sa. Numbers: how far equal temperament is from pure.', 26, 76);
      const x0 = 50, x1 = W - 40, X = (ct) => x0 + (ct / 1200) * (x1 - x0), yE = 170, yJ = 300;
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2;
      [yE, yJ].forEach((y) => { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); });
      c.fillStyle = '#ffb547'; c.font = '20px sans-serif'; c.fillText('Equal temperament (a harmonium)', x0, yE - 36);
      c.fillStyle = '#5ce1a9'; c.fillText('Pure ratios (a singer, a tanpura)', x0, yJ + 58);
      const notes = [[0, 1], [2, 9 / 8], [4, 5 / 4], [5, 4 / 3], [7, 3 / 2], [9, 5 / 3], [11, 15 / 8], [12, 2]];
      notes.forEach(([n, r]) => {
        const e = n * 100, j = cents(r), on = n === st.chord || n === 0;
        c.strokeStyle = on ? 'rgba(142,240,255,.9)' : 'rgba(255,255,255,.25)'; c.lineWidth = on ? 3 : 1.5;
        c.beginPath(); c.moveTo(X(e), yE); c.lineTo(X(j), yJ); c.stroke();
        c.fillStyle = '#ffb547'; c.fillRect(X(e) - 3, yE - 14, 6, 28);
        c.fillStyle = '#5ce1a9'; c.fillRect(X(j) - 3, yJ - 14, 6, 28);
        c.fillStyle = on ? '#fff' : 'rgba(255,255,255,.75)'; c.font = on ? 'bold 22px sans-serif' : '20px sans-serif';
        const name = n === 12 ? 'Sa′' : SARGAM_SHORT[n];
        c.fillText(name, X(e) - 12, yE - 22);
        c.font = '17px sans-serif'; c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText(Math.round(j), X(j) - 16, yJ + 34);
        const d = e - j;
        if (Math.abs(d) > 0.5) { c.fillStyle = d > 0 ? '#ff7a59' : '#7aa2ff'; c.font = 'bold 18px sans-serif'; c.fillText((d > 0 ? '+' : '') + Math.round(d), (X(e) + X(j)) / 2 + 6, (yE + yJ) / 2 + 6); }
      });
    });
    const bm = boardMesh(chart, 7.2, 3.52); bm.position.set(-0.2, 0.2, 3.35); bm.rotation.x = -1.3; bm.scale.setScalar(0.55); stage.root.add(bm);
    const off = harmoniumKeys(E);
    let lastKey = '';
    const freqs = (s) => {
      const r = (semi) => reedFreq(k(semi) + s.shift, s.tuning);
      return { sa: r(0), up: r(s.chord) };
    };
    return {
      scale() { const st = [0, 2, 4, 5, 7, 9, 11, 12].map((n) => ({ k: [k(n)], d: 0.5 })); st.push({ k: [], d: 0.3 }); E.play(st); },
      pick(o) { const u = o.userData; if (u.key !== undefined) E.tap(u.key, 1.3); },
      update(dt, s) {
        dt = Math.max(0, dt);
        E.tuning = s.tuning; E.shift = s.shift;
        E.sustain = new Set(s.hold && !E.phrase ? [k(0), k(s.chord)] : []);
        E.hear = s.hear;
        E.update(dt);
        h.sync(E);
        // The keyboard slides; the reed board stays put.
        h.keysG.position.x += (home + s.shift * KEYSTEP - h.keysG.position.x) * Math.min(1, dt * 8);
        const ck = `${s.tuning}|${s.chord}|${s.shift}`;
        if (ck !== lastKey) { lastKey = ck; chart.redraw({ tuning: s.tuning, chord: s.chord, shift: s.shift }); }
        const narrow = stage.host.clientWidth < 560;
        bm.visible = !narrow;
      },
      readout: (s) => {
        const { sa, up } = freqs(s), [p, q] = IVL[s.chord];
        const now = cents(up / sa), pure = cents(p / q), beat = Math.abs(q * up - p * sa);
        const name = SARGAM[s.chord];
        return compact(`<div class="big">Sa + ${name}: ${beat < 0.05 ? 'no beats' : beat.toFixed(1) + ' beats a second'}</div>
          <div class="row"><span>Sa sounds</span><b>${noteOf(sa).name}, ${fmtHz(sa)}</b></div>
          <div class="row"><span>${name} on this harmonium</span><b>${now.toFixed(0)} cents above Sa</b></div>
          <div class="row"><span>Pure ${name} (${p}/${q})</span><b>${pure.toFixed(0)} cents</b></div>
          <div class="row"><span>Off by</span><b class="${Math.abs(now - pure) > 8 ? 'no' : 'ok'}">${(now - pure > 0 ? '+' : '') + (now - pure).toFixed(1)} cents</b></div>
          <small>Beats = |${q}·f(${name}) − ${p}·f(Sa)|: harmonic ${q} of ${name} against harmonic ${p} of Sa.</small>`, stage);
      },
      dispose() { off(); E.stop(); },
    };
  },
};
