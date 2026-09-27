// Chapter 4: stops and reed banks. Each stop lets air into one bank: bass (an octave down), male (the
// note), female (an octave up) and a musette bank tuned a little sharp. Drone stops hold Sa and Pa.
import { THREE } from '../kit.js';
import { makeHarmonium, makeEngine, harmoniumKeys, spectrumBoard, boardMesh, compact, k, reedFreq, bankFreq, BANKS, BANK_ORDER, noteOf, fmtHz } from '../harmonium.js';

const S = 10;
const NOTES = [{ v: 0, label: 'Sa' }, { v: 7, label: 'Pa' }, { v: 12, label: 'high Sa' }];
const STOPKEYS = ['bass', 'male', 'female', 'musette', 'sa', 'pa'];

export default {
  id: 'stops',
  short: 'Stops and banks',
  title: 'Pull a stop, add a voice',
  subtitle: 'Bass, male and female reeds, a sharp musette and humming drones.',
  view: { pos: [1.6, 6.8, 8.6], target: [-0.9, 2.3, -0.6] },
  learn: `<p>Under every key sit several reeds, one in each <b>bank</b>. The <b>stop knobs</b> slide shutters that let air into a whole bank, or keep it out.</p>
    <p>On a three-reed harmonium the banks are named like voices. The <b>male</b> reeds sound the note you see on the key. The <b>bass</b> reeds sound <b>an octave lower</b>, with long, heavy tongues. The <b>female</b> reeds sound <b>an octave higher</b>. Add them together and one key plays two or three reeds at once, for a fuller, richer sound.</p>
    <p>Each reed gives a whole ladder of <b>harmonics</b>: 2, 3, 4 … times its frequency. An octave bank adds reeds whose harmonics land right on top of the male reed's, so the chart gets taller rather than more crowded. Reeds are never tuned exactly the same, so their harmonics <b>beat</b> slowly against each other and the sound shimmers. Some harmoniums add a second male bank tuned a few cents sharp on purpose. This <b>musette</b> gives a wavy, accordion-like beat of a few times a second.</p>
    <p><b>Drone stops</b> open extra reeds that sound all by themselves while the stop is out, usually <b>Sa</b> and the <b>Pa</b> below it, so a singer always hears the home note.</p>
    <p class="tip"><b>Try it:</b> hold Sa, then pull out the stops one by one and watch the spectrum. Turn on the musette and listen for the wobble. Keys 1 2 3 4 switch the stops too.</p>`,
  terms: [
    { t: 'Male reeds', d: 'The main bank, sounding the pitch written on the key.' },
    { t: 'Bass reeds', d: 'A bank sounding one octave below the key, with longer, heavier tongues.' },
    { t: 'Female reeds', d: 'A bank sounding one octave above the key.' },
    { t: 'Musette', d: 'A second bank tuned slightly sharp, so it beats against the main bank and the sound wobbles.' },
    { t: 'Beats', d: 'A slow rise and fall in loudness when two nearly equal frequencies sound together. Beat rate = the difference.' },
    { t: 'Drone', d: 'A note that sounds all the time under the music, usually Sa, and often Pa.' },
  ],
  defaults: { bass: false, male: true, female: false, musette: false, sa: false, pa: false, note: 0, hold: true, hear: false },
  controls: [
    { key: 'bass', type: 'toggle', label: 'Bass stop (an octave lower)' },
    { key: 'male', type: 'toggle', label: 'Male stop (the key’s own note)' },
    { key: 'female', type: 'toggle', label: 'Female stop (an octave higher)' },
    { key: 'musette', type: 'toggle', label: 'Musette stop (tuned 12 cents sharp)' },
    { key: 'sa', type: 'toggle', label: 'Sa drone' },
    { key: 'pa', type: 'toggle', label: 'Pa drone' },
    { key: 'note', type: 'seg', label: 'Key', options: NOTES },
    { key: 'hold', type: 'toggle', label: 'Hold the key down' },
    { key: 'hear', type: 'toggle', label: 'Hear it', hint: 'Or play keys A W S E D F on your keyboard.' },
  ],
  quiz: [
    { q: 'The male reed for a key plays 262 Hz. What do its bass and female reeds play?', options: ['131 Hz and 524 Hz', '262 Hz and 262 Hz', '196 Hz and 330 Hz', '524 Hz and 131 Hz'], answer: 0, why: 'Bass is an octave below (half the frequency) and female an octave above (double).' },
    { q: 'A musette reed plays 3 Hz higher than the male reed. What do you hear?', options: ['Two separate notes', 'One note that swells and fades 3 times a second', 'A note an octave higher', 'Silence'], answer: 1, why: 'Two close frequencies beat. The beat rate is their difference: 3 times a second.' },
    { q: 'What does a drone stop do?', options: ['Makes every note louder', 'Opens a reed that keeps sounding without any key pressed', 'Transposes the keyboard', 'Stops the bellows'], answer: 1, why: 'A drone reed has its own always-open valve, so it hums the home note under the music.' },
  ],
  reel: [
    { ms: 5800, caption: 'Pull the stops and one key plays three reeds: an octave down, the note, and an octave up.', set: { male: true, bass: false, female: false, musette: false, sa: false, pa: false, note: 0, hold: true }, act: (s) => { s.stage = 1; }, anim: { stage: [1, 3.99] }, view: { pos: [0.1, 4.9, 5.0], target: [-0.1, 3.0, -1.4] }, spin: 0 },
  ],
  onChange(s, key) {
    if (key === 'stage') { s.bass = s.stage >= 2; s.female = s.stage >= 3; }
  },

  build({ stage, s: S0 }) {
    const root = new THREE.Group(); root.scale.setScalar(S); stage.root.add(root);
    const h = makeHarmonium({ banks: ['bass', 'male', 'female', 'musette'] }); root.add(h.group);
    h.setXray(0.55);
    stage.pickables.push(...h.pickables);
    const E = makeEngine({ autoPump: true, V: 2.6 });
    const board = spectrumBoard();
    const bm = boardMesh(board, 7.2, 3.52); bm.position.set(-0.1, 4.5, -3.8); bm.rotation.x = -0.12; bm.scale.setScalar(0.85); stage.root.add(bm);
    const knobLabels = h.knobs.map((kn) => stage.label(kn.label, [0, 0.04, 0.02], kn.g, 'small'));
    const bankLabels = BANK_ORDER.map((b) => stage.label(`${BANKS[b].label} reeds`, [0.33, 0.175, 0], h.inner));
    const zRow = { bass: -0.112, musette: -0.062, male: -0.016, female: 0.022 };
    BANK_ORDER.forEach((b, j) => bankLabels[j].position.z = zRow[b]);
    const off = harmoniumKeys(E, { onStop: (b, v) => { S0[b] = v; } });
    return {
      pick(o) {
        const u = o.userData;
        if (u.key !== undefined) E.tap(u.key, 1.3);
        else if (u.stop) S0[u.stop] = !S0[u.stop];
        else if (u.bellows) E.pump(2);
      },
      update(dt, s) {
        dt = Math.max(0, dt);
        for (const b of BANK_ORDER) E.banks[b] = !!s[b];
        E.drones.sa = s.sa; E.drones.pa = s.pa;
        E.sustain = new Set(s.hold ? [k(s.note)] : []);
        E.hear = s.hear;
        E.update(dt);
        h.sync(E);
        board.update(E.sounding);
        const narrow = stage.host.clientWidth < 560;
        bm.visible = !narrow;
        knobLabels.forEach((l) => { l.visible = !narrow; });
        BANK_ORDER.forEach((b, j) => { bankLabels[j].visible = !narrow && !!s[b]; });
      },
      readout: (s) => {
        const f = reedFreq(k(s.note)), on = BANK_ORDER.filter((b) => s[b]);
        const rows = on.map((b) => `<div class="row"><span>${BANKS[b].label}</span><b>${fmtHz(bankFreq(f, b))}</b></div>`).join('');
        const beats = [];
        if (s.musette && s.male) beats.push(`musette against male: ${(bankFreq(f, 'musette') - f).toFixed(1)} beats/s`);
        if (s.bass && s.male) beats.push(`bass ×2 against male: ${Math.abs(2 * bankFreq(f, 'bass') - f).toFixed(2)} beats/s`);
        if (s.female && s.male) beats.push(`female against male ×2: ${Math.abs(bankFreq(f, 'female') - 2 * f).toFixed(2)} beats/s`);
        const drones = [s.sa && 'Sa', s.pa && 'Pa'].filter(Boolean).join(' + ');
        return compact(`<div class="big">${noteOf(f).name}: ${on.length} reed${on.length === 1 ? '' : 's'} per key${drones ? ` + ${drones} drone` : ''}</div>
          ${rows || '<div class="row no"><span>No bank open</span><b>keys are silent</b></div>'}
          ${beats.length ? `<small>${beats.join('<br>')}</small>` : '<small>Each bank is tuned a few cents apart, so banks shimmer together.</small>'}`, stage, 3);
      },
      dispose() { off(); E.stop(); },
    };
  },
};
