// Chapter 6: the harmonium in India. A player sits on the floor, pumps with the left hand and plays
// with the right, over a Sa drone: a short phrase in raag Bhupali.
import { THREE, M, box, canvasTexture } from '../kit.js';
import { makeHarmonium, makeEngine, makePlayer, harmoniumKeys, compact, k, keyX, SARGAM, noteOf, fmtHz, NKEYS } from '../harmonium.js';

const S = 10;
// Raag Bhupali uses Sa Re Ga Pa Dha. A simple, traditional-style phrase (our own), in semitones from Sa.
const PHRASE = [[0, 0.5], [2, 0.5], [4, 0.5], [7, 1.0], [9, 0.5], [7, 0.5], [4, 1.0], [2, 0.5], [4, 0.5], [2, 0.5], [0, 1.2], [-3, 0.5], [0, 1.4], [null, 0.5]];

export default {
  id: 'india',
  short: 'The harmonium in India',
  title: 'From church organ to every stage in India',
  subtitle: 'Pumped with one hand, played on the floor, heard in every kind of music.',
  view: { pos: [-5.4, 7.6, -14.6], target: [-1.8, 3.6, 1.4] },
  learn: `<p>European <b>reed organs</b> stood on the floor with foot pedals. Missionaries and traders brought them to India in the 1800s, but Indian musicians sit on the floor. In Calcutta, <b>Dwarkanath Ghose</b> of Dwarkin & Son, who opened his firm in 1875, is widely credited with the answer: a small box with a <b>bellows at the back pumped by hand</b>, and drone stops for Indian music.</p>
    <p>It was cheap, easy to carry, loud enough for a crowd and always in tune with itself. Within a few decades it was everywhere: <b>bhajan</b> and <b>kirtan</b>, the <b>Sikh kirtan</b> of the gurdwaras, Sufi <b>qawwali</b> (think of Nusrat Fateh Ali Khan's party), Marathi and Parsi <b>theatre</b>, and later <b>film songs</b>.</p>
    <p>Not everyone was happy. Its fixed, equal-tempered notes can't glide or match the shrutis, and from <b>1 March 1940</b> <b>All India Radio banned it</b> from its music broadcasts. The ban was only partly lifted in <b>1971</b>. Meanwhile great players showed what it could do: <b>Govindrao Tembe</b>, <b>Appa Jalgaonkar</b>, <b>Manohar Chimote</b>, and <b>Tulsidas Borkar</b>, who received the Padma Shri in 2016.</p>
    <p class="tip"><b>Try it:</b> watch the left hand keep the bellows going while the right hand plays a phrase in raag Bhupali over a Sa drone. Change how often the player pumps and see the wind hold up, or not.</p>`,
  terms: [
    { t: 'Bhajan', d: 'A Hindu devotional song, very often sung to harmonium.' },
    { t: 'Kirtan', d: 'Singing the divine names or hymns together. Sikh kirtan sets the Guru Granth Sahib to ragas.' },
    { t: 'Qawwali', d: 'Sufi devotional music of South Asia: lead singers, a chorus clapping, harmonium and tabla.' },
    { t: 'Raag', d: 'A melodic framework in Indian music: which notes to use and how to move between them.' },
    { t: 'Accompanist', d: 'A player who follows and supports the singer, echoing their phrases.' },
  ],
  defaults: { play: true, drone: true, rate: 40, hear: false },
  controls: [
    { key: 'play', type: 'toggle', label: 'Play the phrase' },
    { key: 'drone', type: 'toggle', label: 'Sa drone stop' },
    { key: 'rate', type: 'range', label: 'Pump strokes per minute', min: 0, max: 80, step: 1, fmt: (v) => (v ? Math.round(v) : 'not pumping') },
    { key: 'hear', type: 'toggle', label: 'Hear it' },
  ],
  quiz: [
    { q: 'How is an Indian hand harmonium usually played?', options: ['Standing, with foot pedals', 'Sitting on the floor, pumping with one hand and playing with the other', 'Held under the chin', 'With a bow'], answer: 1, why: 'Indian musicians sit on the floor, so the pedal organ became a box you pump by hand from the back.' },
    { q: 'Why did All India Radio ban the harmonium from 1940?', options: ['It was too expensive', 'Its fixed, equal-tempered tuning was thought wrong for Indian music', 'It was too quiet for radio', 'It was an Indian invention'], answer: 1, why: 'Critics said its fixed Western tuning could not play the shrutis and slides of Indian music.' },
    { q: 'Which of these does NOT usually use the harmonium?', options: ['Qawwali', 'Bhajan and kirtan', 'Marathi theatre music', 'A Carnatic veena recital'], answer: 3, why: 'The harmonium is everywhere in North Indian and Pakistani devotional and light music, but rarely used in Carnatic concerts.' },
  ],
  reel: [
    { ms: 6000, caption: 'In India it went to the floor: pumped with one hand, played with the other, in bhajan, kirtan and qawwali.', set: { play: true, drone: true, rate: 40 }, act: (s, inst) => inst.restart(), view: { pos: [-4.2, 6.2, -9.6], target: [-0.2, 2.8, 1.4] }, spin: 0.3 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.scale.setScalar(S); stage.root.add(root);
    // A durrie (cotton rug) with a simple striped border.
    const rugTex = canvasTexture(512, 384, (c, w, h) => {
      c.fillStyle = '#8e2323'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e0b04a'; c.fillRect(18, 18, w - 36, h - 36);
      c.fillStyle = '#7a1d1d'; c.fillRect(34, 34, w - 68, h - 68);
      c.strokeStyle = '#e8d6a8'; c.lineWidth = 3;
      for (let i = 0; i < 9; i++) { const y = 60 + i * 30; c.beginPath(); for (let x = 50; x <= w - 50; x += 20) c.lineTo(x, y + ((x / 20) % 2 ? 8 : -8)); c.stroke(); }
    });
    const rug = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.008, 1.2), M.matte(0xffffff, { map: rugTex.tex })); rug.position.set(0, 0.004, 0.25); rug.receiveShadow = true; root.add(rug);
    const h = makeHarmonium({ banks: ['bass', 'male', 'female'] }); h.group.position.y = 0.008; root.add(h.group);
    stage.pickables.push(...h.keys.map((kk) => kk.m));
    const P = makePlayer(); P.group.position.set(0, 0.008, 0.02); root.add(P.group);
    const E = makeEngine({ autoPump: false, V: 2.6 });
    E.banks.bass = true;
    const off = harmoniumKeys(E);
    const lbl = stage.label('Left hand pumps the bellows', [-0.42, 0.34, -0.12], root, 'hot');
    const lbl2 = stage.label('Right hand plays', [0.2, 0.3, 0.1], root);
    const v = new THREE.Vector3();
    let cur = 0, handX = keyX(k(0)), lastNote = '';
    const start = () => E.play(PHRASE.map(([n, d]) => ({ k: n === null ? [] : [k(n)], d })), true);
    start();
    return {
      restart() { start(); },
      pick(o) { const u = o.userData; if (u.key !== undefined) E.tap(u.key, 1.0); },
      update(dt, s) {
        dt = Math.max(0, dt);
        if (s.play && !E.phrase) start();
        if (!s.play && E.phrase) E.stop();
        E.drones.sa = s.drone;
        E.steady = s.rate > 0; E.pumpRate = Math.max(0.01, s.rate / 60); E.stroke = 0.55;
        E.hear = s.hear;
        E.update(dt);
        h.sync(E);
        // Right hand follows the key being played; left hand holds the bellows handle.
        const held = E.heldKeys();
        if (held.length) cur = held[held.length - 1];
        handX += (keyX(cur) - handX) * Math.min(1, dt * 14);
        const down = held.length ? 0.012 : 0;
        h.handle.getWorldPosition(v); P.group.worldToLocal(v);
        P.pose([handX, 0.27 - down, 0.12], [v.x - 0.01, v.y + 0.01, v.z - 0.02]);
        if (E.sounding.length && held.length) { const semi = cur - k(0); lastNote = `${SARGAM[((semi % 12) + 12) % 12]}${semi < 0 ? ' (low)' : semi >= 12 ? ' (high)' : ''}`; }
        const narrow = stage.host.clientWidth < 560;
        lbl2.visible = !narrow;
      },
      readout: (s) => compact(`<div class="big">${s.play ? 'Raag Bhupali: Sa Re Ga Pa Dha' : 'The harmonium at rest'}</div>
          <div class="row"><span>Now playing</span><b>${lastNote || 'rest'}</b></div>
          <div class="row"><span>Sa drone</span><b>${s.drone ? noteOf(130.81).name + ', ' + fmtHz(130.81) : 'off'}</b></div>
          <div class="row"><span>Pumping</span><b>${s.rate ? Math.round(s.rate) + ' strokes a minute' : 'stopped'}</b></div>
          <div class="row"><span>Wind pressure</span><b class="${E.p < 300 ? 'no' : ''}">${(E.p / 1000).toFixed(2)} kPa</b></div>`, stage),
      dispose() { off(); E.stop(); },
    };
  },
};
