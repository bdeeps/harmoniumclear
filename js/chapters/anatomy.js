// Chapter 1: an Indian hand harmonium, taken apart and made see-through, with the air flowing.
import { THREE, exploder } from '../kit.js';
import { makeHarmonium, makeEngine, harmoniumKeys, airFlow, noteOf, fmtHz, compact, NKEYS, V_MAX, k, BANKS } from '../harmonium.js';

const S = 10;                                  // 1 scene unit = 10 cm

export default {
  id: 'anatomy',
  short: 'Inside the box',
  title: 'A box of brass reeds and a bellows',
  subtitle: 'Keys, valves, reeds, stops and two bellows: follow the air.',
  view: { pos: [3.8, 6.8, 7.8], target: [-0.8, 1.1, -0.2] },
  learn: `<p>An Indian <b>harmonium</b> is a wooden box about the size of a small suitcase. You pump air with one hand and play the <b>keys</b> with the other.</p>
    <p>At the back is the <b>bellows</b>, a hinged flap you swing open and shut. Each push forces air through a one-way <b>valve</b> into an inner <b>reservoir</b>, a second bellows held shut by <b>springs</b>. The springs squeeze the air, so it waits under a small, steady <b>pressure</b>.</p>
    <p>Above the reservoir sits the <b>reed board</b>: rows of little chambers called <b>reed cells</b>, each holding a <b>brass reed</b>. There is one row, or <b>bank</b>, of reeds for each voice. Pressing a key lifts a padded valve, the <b>pallet</b>, and the air rushes out through that key's reeds. <b>Stop knobs</b> choose which banks get air. The sound escapes through the <b>grill</b>.</p>
    <p>No pipes and no strings: each note is a tiny brass tongue buzzing in a slot. Unlike a flute, where the air in a tube sets the note (see <a href="/fluteclear/#edge">FluteClear</a>), here the <b>reed</b> sets it.</p>
    <p class="tip"><b>Try it:</b> take it apart, turn on the see-through view and click a key or a stop knob. Or play with your computer keyboard: A W S E D F … are the keys, hold the space bar to pump, and 1 2 3 switch the bass, male and female stops.</p>`,
  terms: [
    { t: 'Bellows', d: 'The hinged flap at the back that you pump by hand to push air into the harmonium.' },
    { t: 'Reservoir', d: 'An inner, spring-loaded bellows that stores air and keeps its pressure steady.' },
    { t: 'Pallet', d: 'A padded valve under each key. Pressing the key opens it and lets air through the reeds.' },
    { t: 'Reed cell', d: 'The small wooden chamber that holds one reed and guides air through it.' },
    { t: 'Reed bank', d: 'One full row of reeds, one per key. Each bank is a different voice.' },
    { t: 'Stop', d: 'A knob that opens or closes the air to one bank of reeds, or to a drone reed.' },
  ],
  defaults: { explode: 0, xray: 0.45, air: true },
  controls: [
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'apart'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'xray', type: 'range', label: 'See through the case', min: 0, max: 1, step: 0.01, ends: ['wood', 'glass'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'air', type: 'toggle', label: 'Show the air', hint: 'Orange: air pumped into the reservoir. Blue: air leaving through the reeds.' },
    { key: 'play', type: 'buttons', label: 'Play', items: [
      { label: '♪ Sa', act: (s, inst) => inst.tap([k(0)]) },
      { label: '♪ Sa Ga Pa', act: (s, inst) => inst.tap([k(0), k(4), k(7)]) },
      { label: '♪ A little tune', act: (s, inst) => inst.tune() },
      { label: 'Pump twice', act: (s, inst) => inst.pump() },
    ] },
  ],
  quiz: [
    { q: 'What actually makes the sound in a harmonium?', options: ['Air in a long pipe', 'Strings hit by hammers', 'Small brass reeds buzzing in slots', 'A loudspeaker'], answer: 2, why: 'Each note is a brass tongue that swings through a slot and chops the airflow into puffs.' },
    { q: 'What does the spring-loaded reservoir do?', options: ['It tunes the reeds', 'It stores air and keeps its pressure steady between pumps', 'It makes the keys spring back', 'It holds the drone notes'], answer: 1, why: 'The springs squeeze the stored air, so the pressure stays steady even between strokes of the bellows.' },
    { q: 'What happens when you press a key?', options: ['A hammer hits a reed', 'A pallet valve opens and air flows through that key’s reeds', 'The bellows opens', 'A pipe gets shorter'], answer: 1, why: 'The key lifts a padded pallet. Air under pressure escapes through the reeds for that note, and they sound.' },
  ],
  reel: [
    { ms: 5600, caption: 'A harmonium is a wooden box of brass reeds, a keyboard and a bellows you pump by hand.', set: { xray: 0, air: false }, anim: { explode: [0, 0.85] }, view: { pos: [4.2, 4.6, 6.6], target: [-0.2, 1.3, 0] }, spin: 0.35 },
    { ms: 6000, caption: 'Pump, and air waits under pressure. Press a key, and it rushes out through brass reeds.', set: { explode: 0, xray: 0.75, air: true }, act: (s, inst) => inst.tune(true), view: { pos: [-2.6, 3.6, -4.2], target: [0.1, 1.3, 0] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.scale.setScalar(S); stage.root.add(root);
    const h = makeHarmonium({ banks: ['bass', 'male', 'female'] }); root.add(h.group);
    stage.pickables.push(...h.pickables);
    const E = makeEngine({ banks: { bass: false, male: true, female: false }, autoPump: true, V: 2.4 });

    const setExplode = exploder([
      { obj: h.lid, off: [0, 0.2, -0.04] },
      { obj: h.stopsG, off: [0, 0.13, 0.03] },
      { obj: h.keysG, off: [0, 0.08, 0.1] },
      { obj: h.bell, off: [0, 0, -0.18] },
      { obj: h.endL, off: [-0.12, 0, 0] },
      { obj: h.endR, off: [0.12, 0, 0] },
      { obj: h.front, off: [0, 0, 0.17] },
      { obj: h.trim, off: [0, 0, 0.17] },
      { obj: h.back, off: [0, 0, -0.1] },
    ]);

    const air = airFlow(root);

    const L = (t, obj, pos, cls) => stage.label(t, pos, obj, cls);
    const labels = {
      keys: L('Keys', h.keysG, [0.2, 0.03, 0.06], 'hot'),
      stops: L('Stop knobs', h.stopsG, [-0.25, 0.31, 0.06]),
      grill: L('Grill', h.lid, [0.2, 0.03, 0]),
      bell: L('Bellows (pumped by hand)', h.bell, [-0.3, 0.26, -0.03], 'hot'),
      res: L('Reservoir + springs', h.inner, [0.2, 0.06, 0.08]),
      reeds: L('Brass reeds in their cells', h.inner, [0.14, 0.175, -0.13]),
      pallets: L('Pallets (valves)', h.inner, [-0.12, 0.2, 0.0]),
      drone: L('Drone reeds', h.inner, [0.27, 0.18, -0.07]),
    };
    const inner = [labels.res, labels.reeds, labels.pallets, labels.drone];
    const off = harmoniumKeys(E);
    let last = '';
    const api = {
      tap(ks, d = 1.3) { E.phrase = null; ks.forEach((i) => E.tap(i, d)); },
      pump() { E.pump(2); },
      tune(loop = false) {
        const n = (sem, d) => ({ k: [k(sem)], d });
        E.play([n(0, 0.5), n(2, 0.5), n(4, 0.5), n(5, 0.5), n(7, 1.0), n(5, 0.5), n(4, 0.5), n(2, 0.5), n(0, 1.1), { k: [], d: 0.4 }], loop);
      },
      pick(o) {
        const u = o.userData;
        if (u.key !== undefined) { E.phrase = null; E.tap(u.key, 1.2); }
        else if (u.stop) { if (u.stop in E.banks) E.banks[u.stop] = !E.banks[u.stop]; else E.drones[u.stop] = !E.drones[u.stop]; }
        else if (u.bellows) E.pump(2);
      },
      update(dt, s) {
        dt = Math.max(0, dt);
        E.update(dt);
        h.sync(E);
        setExplode(s.explode);
        const x = Math.max(s.xray, s.explode > 0.05 ? 0.6 : 0);
        h.setXray(x);
        air.update(dt, E, s.air && x > 0.2);
        const narrow = stage.host.clientWidth < 560;
        inner.forEach((l) => { l.visible = x > 0.3 && (!narrow || l === labels.reeds); });
        labels.grill.visible = labels.stops.visible = !narrow;
        if (E.sounding.length) {
          const r = E.sounding.find((q) => q.bank === 'male') || E.sounding[0];
          last = `${noteOf(r.f).name}, ${fmtHz(r.f)}${E.sounding.length > 1 ? ` (${E.sounding.length} reeds)` : ''}`;
        }
      },
      readout: () => {
        const banks = Object.entries(E.banks).filter(([, v]) => v).map(([b]) => BANKS[b].label).join(' + ') || 'none';
        return compact(`<div class="big">39 keys, 3 banks of reeds</div>
          <div class="row"><span>Size (without bellows)</span><b>60 × 32 × 24 cm</b></div>
          <div class="row"><span>Reeds</span><b>${NKEYS} × 3 banks + 2 drones = ${NKEYS * 3 + 2}</b></div>
          <div class="row"><span>Stops open</span><b>${banks}</b></div>
          <div class="row"><span>Air in the reservoir</span><b>${E.V.toFixed(1)} of ${V_MAX} L, ${(E.p / 1000).toFixed(2)} kPa</b></div>
          ${last ? `<div class="row"><span>Last note</span><b>${last}</b></div>` : '<small>Click a key, or press A on your keyboard for Sa.</small>'}`, stage);
      },
      dispose() { off(); E.stop(); },
    };
    return api;
  },
};
