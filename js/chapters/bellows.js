// Chapter 3: the wind. A hand-pumped bellows fills a spring-loaded reservoir that keeps the pressure
// steady; every open reed drains it. A live trace shows the pressure, the pump strokes and the air used.
import { THREE } from '../kit.js';
import { makeHarmonium, makeEngine, harmoniumKeys, airFlow, pressureBoard, boardMesh, compact, k, V_MAX, V_STROKE, P_SPEAK } from '../harmonium.js';

const S = 10;
const CHORDS = { 0: [], 1: [0], 3: [0, 4, 7], 6: [0, 4, 7, 12, 16, 19] };
const BANKSETS = { 1: { male: true, bass: false, female: false }, 2: { male: true, bass: true, female: false }, 3: { male: true, bass: true, female: true } };

export default {
  id: 'bellows',
  short: 'Bellows and pressure',
  title: 'Pump, store, squeeze',
  subtitle: 'A spring-loaded reservoir turns uneven pumping into steady wind.',
  view: { pos: [-8.0, 7.6, -8.4], target: [0.2, 0.9, 1.4] },
  learn: `<p>Your hand can't push air perfectly evenly. So a harmonium has <b>two bellows</b>. The one you pump, at the back, swings open to suck in room air through a flap valve, then you push it shut and the air is forced through a <b>one-way valve</b> into the <b>reservoir</b> inside.</p>
    <p>The reservoir is a second bellows held shut by <b>springs</b>. As it fills, its top board rises and the springs push back harder. Their push, spread over the board, is the <b>wind pressure</b>: about <b>0.5 to 1.5 kilopascals</b>, the weight of a 5 to 15 cm column of water. That is only about 1% above the air around us, but it is plenty to make a reed speak.</p>
    <p>Every open reed lets air out, about a tenth of a litre each second. Hold a chord on three banks and nine reeds drain the reservoir quickly, so you must pump faster. Stop pumping and the springs keep the sound going for a few seconds, then the pressure falls and the reeds <b>stop speaking</b>. Pump harder and the reservoir sits fuller, the pressure rises, and the harmonium plays <b>louder</b>: that is its only volume control.</p>
    <p class="tip"><b>Try it:</b> hold a big chord on three banks, then stop pumping and watch the trace dive. Or hold the space bar to pump and play keys A W S E D F.</p>`,
  terms: [
    { t: 'Wind pressure', d: 'How far the air in the reservoir is squeezed above the room’s pressure, about 0.5–1.5 kPa here.' },
    { t: 'kPa', d: 'Kilopascal, 1,000 newtons on each square metre. The air around us is about 101 kPa.' },
    { t: 'One-way valve', d: 'A leather flap that lets air through in one direction only.' },
    { t: 'Relief valve', d: 'A valve that lets extra air out when the reservoir is full, so it cannot burst.' },
    { t: 'Flow', d: 'How much air passes each second, in litres per second.' },
  ],
  defaults: { pump: 'steady', rate: 30, stroke: 0.5, chord: 3, banks: 2, hear: false },
  controls: [
    { key: 'pump', type: 'seg', label: 'Pumping', options: [{ v: 'stop', label: 'Stop' }, { v: 'steady', label: 'Steady' }, { v: 'auto', label: 'Auto' }], hint: 'Auto pumps only when the reservoir gets low, like a good player.' },
    { key: 'rate', type: 'range', label: 'Strokes per minute', min: 20, max: 120, step: 1, fmt: (v) => Math.round(v) },
    { key: 'stroke', type: 'range', label: 'How hard you pump', min: 0.3, max: 1, step: 0.01, ends: ['gently', 'full swing'], fmt: (v) => (v * V_STROKE).toFixed(1) + ' L a stroke' },
    { key: 'chord', type: 'seg', label: 'Keys held down', options: [{ v: 0, label: 'None' }, { v: 1, label: 'Sa' }, { v: 3, label: 'Sa Ga Pa' }, { v: 6, label: 'Big chord' }] },
    { key: 'banks', type: 'seg', label: 'Reed banks open', options: [{ v: 1, label: '1' }, { v: 2, label: '2' }, { v: 3, label: '3' }] },
    { key: 'hear', type: 'toggle', label: 'Hear it', hint: 'Listen to the volume follow the pressure.' },
    { key: 'go', type: 'buttons', label: 'Pump', items: [{ label: 'One stroke', act: (s, inst) => inst.pump(1) }, { label: 'Three strokes', act: (s, inst) => inst.pump(3) }] },
  ],
  quiz: [
    { q: 'Why does a harmonium have a second, spring-loaded bellows inside?', options: ['To make a second note', 'To store air and keep the pressure steady between pumps', 'To cool the reeds', 'To make it lighter'], answer: 1, why: 'The reservoir smooths out your pumping. Its springs keep squeezing the stored air, so the wind stays steady.' },
    { q: 'You hold a chord on three reed banks instead of one. What changes?', options: ['Nothing', 'The reservoir drains about three times faster, so you pump harder', 'The chord gets quieter', 'The pitch drops'], answer: 1, why: 'Three banks means three times as many open reeds, and every reed lets air out.' },
    { q: 'How does a harmonium player play louder?', options: ['Press the keys harder', 'Pump harder so the reservoir is fuller and the pressure higher', 'Pull out the drone stops', 'Close the grill'], answer: 1, why: 'Key speed makes no difference. More wind pressure makes the reeds swing wider and louder.' },
  ],
  reel: [
    { ms: 5800, caption: 'Each push of the bellows fills a spring-loaded reservoir, which keeps the wind steady.', set: { pump: 'steady', rate: 45, stroke: 0.7, chord: 3, banks: 2 }, view: { pos: [-7.0, 4.6, -3.4], target: [0.2, 1.0, -0.6] }, spin: 0.25 },
    { ms: 5600, caption: 'Stop pumping and a big chord drains it in seconds. Below about 150 pascals the reeds fall silent.', set: { pump: 'stop', chord: 6, banks: 3 }, view: { pos: [-7.6, 4.2, -2.6], target: [-2.4, 1.6, 2.4] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.scale.setScalar(S); stage.root.add(root);
    const h = makeHarmonium({ banks: ['bass', 'male', 'female'] }); root.add(h.group);
    h.setXray(0.72);
    stage.pickables.push(...h.pickables);
    const E = makeEngine({ autoPump: false, V: 2.4 });
    const air = airFlow(root);
    const board = pressureBoard();
    const bm = boardMesh(board, 7.2, 3.52); bm.position.set(-5.0, 1.5, 4.6); bm.rotation.set(-0.45, -2.36, 0, 'YXZ'); bm.scale.setScalar(0.8); stage.root.add(bm);
    const L = (t, obj, pos, cls) => stage.label(t, pos, obj, cls);
    const lb = {
      bell: L('Bellows you pump', h.bell, [-0.5, 0.24, -0.06], 'hot'),
      valve: L('One-way valve', h.bell, [-0.46, 0.05, 0.02]),
      res: L('Reservoir', h.inner, [0.1, 0.04, -0.2], 'hot'),
      spr: L('Springs', h.inner, [0.18, 0.1, -0.02]),
      reeds: L('Reeds let air out', h.inner, [0.15, 0.2, -0.14]),
    };
    const off = harmoniumKeys(E);
    return {
      pump(n) { E.pump(n); },
      pick(o) { const u = o.userData; if (u.bellows) E.pump(1); else if (u.key !== undefined) E.tap(u.key, 1.2); },
      update(dt, s) {
        dt = Math.max(0, dt);
        E.pumpRate = s.rate / 60; E.stroke = s.stroke;
        E.autoPump = s.pump === 'auto';
        E.steady = s.pump === 'steady';
        Object.assign(E.banks, BANKSETS[s.banks]);
        E.sustain = new Set(CHORDS[s.chord].map(k));
        E.hear = s.hear;
        E.update(dt);
        h.sync(E);
        air.update(dt, E, true);
        const narrow = stage.host.clientWidth < 560;
        lb.valve.visible = lb.spr.visible = !narrow;
        bm.visible = !narrow;
        board.update(E);
      },
      readout: (s) => {
        const supply = (s.pump === 'stop' ? 0 : (s.rate / 60) * s.stroke * V_STROKE);
        const speaking = E.p > P_SPEAK && E.sounding.length;
        return compact(`<div class="big ${speaking || !E.sustain.size ? '' : 'no'}">${(E.p / 1000).toFixed(2)} kPa${speaking ? '' : E.sustain.size ? ': too little wind' : ''}</div>
          <div class="row"><span>Same as a water column of</span><b>${Math.round(E.p / 9.81)} mm</b></div>
          <div class="row"><span>Air in the reservoir</span><b>${E.V.toFixed(2)} of ${V_MAX} L${E.vent ? ' (venting)' : ''}</b></div>
          <div class="row"><span>Reeds sounding · air out</span><b>${E.sounding.length} · ${E.flowOut.toFixed(2)} L/s</b></div>
          <div class="row"><span>Pumping in (average)</span><b>${s.pump === 'auto' ? 'as needed' : supply.toFixed(2) + ' L/s'}</b></div>
          <div class="row"><span>Full reservoir lasts, no pumping</span><b>${E.sounding.length ? Math.round((V_MAX - 0.25) / E.flowOut) + ' s' : 'minutes (only leaks)'}</b></div>
          <small>Each open reed passes Q = Cd·a·√(2p/ρ): about 0.07 L/s for a middle reed at 1 kPa.</small>`, stage);
      },
      dispose() { off(); E.stop(); },
    };
  },
};
