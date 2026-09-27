// Chapter 2: the free reed. A brass tongue riveted over a slot swings through it and chops the air
// into puffs at its own natural frequency, set by its length and thickness (a cantilever beam).
import { THREE, M, box, rod, swarm, clamp, canvasTexture } from '../kit.js';
import { reedF, scrapeRatio, scrapeProfile, modeShape, noteOf, fmtHz, compact, voice, boardMesh, TAU, E_BRASS, RHO_BRASS } from '../harmonium.js';

const U = 0.004;                          // 1 scene unit = 4 mm: a close-up of one reed
const TP = 1.2e-3;                        // plate thickness, m
const Y0 = 2.4;                           // height of the plate's middle, scene units
const NSEG = 48, NP = 260;
const WHERE = [{ v: 0.1, label: 'Near the root' }, { v: 0.5, label: 'Middle' }, { v: 0.88, label: 'Near the tip' }];

const freq = (s) => reedF(s.L / 1000, s.t / 1000) * scrapeRatio(s.where, s.scrape);

export default {
  id: 'reed',
  short: 'The free reed',
  title: 'A brass tongue that chops the air',
  subtitle: 'Every note is a tiny springboard swinging through a slot.',
  view: { pos: [-1.6, 10.8, 13.4], target: [-2.6, 1.3, 0.6] },
  learn: `<p>Each reed is a thin <b>brass tongue</b>, riveted at one end over a slot cut in a brass <b>plate</b>. The tongue fits the slot so closely that you can barely see light around it.</p>
    <p>Air under pressure pushes the tongue <b>into the slot</b>. Like a diving board, it bends, then <b>springs back</b>, overshoots and swings through again. Each time the tongue leaves the slot, a gap opens and a <b>puff</b> of air escapes. Hundreds of puffs a second are the sound. It is called a <b>free reed</b> because the tongue swings freely through its slot, instead of beating against a frame like a clarinet reed. How fast the air squeezes through the gap follows Bernoulli's rule (see <a href="/bernoulliclear/#jets">BernoulliClear</a>).</p>
    <p>The tongue swings at its own <b>natural frequency</b>, like a ruler twanged on a desk. For a strip clamped at one end, <b>f = 0.56 · (t / L²) · √(E / 12ρ)</b>: thicker is higher, and <b>longer is much lower</b>, because length counts twice. Brass gives about <b>580 × t / L²</b>.</p>
    <p>Makers tune a reed by <b>scraping</b> it. Scrape near the <b>tip</b> and you remove weight where it swings most, so the pitch goes <b>up</b>. Scrape near the <b>root</b> and you weaken the spring, so the pitch goes <b>down</b>.</p>
    <p class="tip"><b>Try it:</b> make the tongue shorter and watch the note climb. Then scrape the tip, and then the root, and compare the change in cents.</p>`,
  terms: [
    { t: 'Free reed', d: 'A tongue that swings freely through a slot, without hitting anything. Used in harmoniums, accordions, harmonicas and the sheng.' },
    { t: 'Tongue', d: 'The thin, springy strip of brass that vibrates.' },
    { t: 'Natural frequency', d: 'The rate an object swings at by itself when disturbed, set by its stiffness and its mass.' },
    { t: 'Cantilever', d: 'A beam fixed at one end and free at the other, like a diving board.' },
    { t: 'Cent', d: 'One hundredth of a semitone. Trained ears notice a few cents.' },
  ],
  defaults: { L: 27.5, t: 0.34, where: 0.88, scrape: 0, hear: false },
  controls: [
    { key: 'L', type: 'range', label: 'Tongue length', min: 12, max: 60, step: 0.5, fmt: (v) => v.toFixed(1) + ' mm' },
    { key: 't', type: 'range', label: 'Tongue thickness', min: 0.2, max: 0.8, step: 0.01, fmt: (v) => v.toFixed(2) + ' mm' },
    { key: 'where', type: 'seg', label: 'Scrape where?', options: WHERE },
    { key: 'scrape', type: 'range', label: 'How much to scrape', min: 0, max: 0.3, step: 0.01, ends: ['none', '30% thinner'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'hear', type: 'toggle', label: 'Hear the reed', hint: 'Plays the tongue’s own note.' },
  ],
  quiz: [
    { q: 'A reed tongue is made twice as long, with the same thickness. What happens to its note?', options: ['It doubles', 'It halves', 'It drops to a quarter, two octaves lower', 'It stays the same'], answer: 2, why: 'f depends on t/L². Doubling L divides f by four: two octaves down.' },
    { q: 'A reed is a little flat. Where should the tuner scrape?', options: ['Near the root', 'Near the tip', 'Anywhere, it makes no difference', 'Scraping always lowers the pitch'], answer: 1, why: 'Scraping the tip removes mass where the tongue moves most, so it swings faster and the pitch rises.' },
    { q: 'Why is it called a “free” reed?', options: ['It costs nothing', 'The tongue swings through its slot without hitting the frame', 'It can be taken out easily', 'It needs no air'], answer: 1, why: 'Unlike a clarinet reed, which beats against the mouthpiece, a free reed passes cleanly through its slot.' },
  ],
  reel: [
    { ms: 5600, caption: 'Each note is a brass tongue riveted over a slot. Air pushes it through, and it springs back.', set: { L: 27.5, t: 0.34, scrape: 0 }, view: { pos: [5.2, 5.4, 7.4], target: [0.4, 2.0, 0] }, spin: 0 },
    { ms: 5600, caption: 'A shorter tongue swings faster: halve its length and the note climbs two octaves.', set: { t: 0.34, scrape: 0 }, anim: { L: [48, 24] }, view: { pos: [-1.6, 9.0, 11.0], target: [-2.0, 2.0, 1.2] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const brass = M.metal(0xd2ab58, { roughness: 0.3 }), brassDark = M.metal(0xa9853c, { roughness: 0.35 });
    const plate = new THREE.Group(); root.add(plate);
    const tongueMat = M.metal(0xe8c46c, { roughness: 0.22, side: THREE.DoubleSide });
    const geo = new THREE.BoxGeometry(1, 1, 1, NSEG, 1, 1);
    const base = geo.attributes.position.array.slice();
    const tongue = new THREE.Mesh(geo, tongueMat); tongue.castShadow = true; root.add(tongue);
    const scr = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.glow(0xff7a59, { transparent: true, opacity: 0.6 })); root.add(scr);
    const file = new THREE.Group(); root.add(file);
    const fb = box(1.4, 0.18, 0.5, M.metal(0x8a9099, { roughness: 0.6 })); fb.rotation.z = 0.35; file.add(fb);
    const fh = box(1.6, 0.3, 0.55, M.matte(0x3b2616)); fh.position.set(1.4, 0.49, 0); fh.rotation.z = 0.35; file.add(fh);
    const rivets = [0, 1].map(() => { const r = rod(-0.12, 0.12, 0.28, 0.28, M.metal(0xb9bec8)); r.rotation.z = Math.PI / 2; root.add(r); return r; });
    // A slice of reed-cell wood under the plate.
    const cell = box(1, 1.2, 1, M.matte(0x7a4a28, { transparent: true, opacity: 0.22, depthWrite: false })); cell.castShadow = false; root.add(cell);
    // Puffs below the slot, pressure above.
    const puff = swarm(NP, new THREE.SphereGeometry(0.07, 8, 6), M.glow(0x8ef0ff)); root.add(puff);
    const hi = swarm(90, new THREE.SphereGeometry(0.06, 8, 6), M.glow(0xffb547)); root.add(hi);
    let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const P = Array.from({ length: NP }, () => ({ age: 9, x: 0, z: 0, vx: 0, vz: 0, vy: 0 }));
    const HI = Array.from({ length: 90 }, () => ({ x: rnd(), z: rnd() - 0.5, y: rnd() }));
    let pi = 0, phase = 0, lastBuild = '', lastChart = '';
    // The chart: frequency against length for three thicknesses, and where this reed sits.
    const chart = canvasTexture(900, 440, (c, W, H, s = { L: 27.5, t: 0.34, f: 262 }) => {
      c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(7,8,12,.86)'; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '28px sans-serif'; c.fillText('Note against tongue length', 26, 44);
      c.font = '20px sans-serif'; c.fillStyle = 'rgba(255,255,255,.55)'; c.fillText('f = 580 · t / L²   (brass, clamped at one end)', 26, 76);
      const x0 = 80, x1 = W - 40, y0 = H - 60, y1 = 100;
      const lx = (L) => x0 + ((Math.log(L) - Math.log(12)) / (Math.log(60) - Math.log(12))) * (x1 - x0);
      const ly = (f) => y0 - ((Math.log(f) - Math.log(30)) / (Math.log(5000) - Math.log(30))) * (y0 - y1);
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y1 - 10); c.lineTo(x0, y0); c.lineTo(x1, y0); c.stroke();
      c.font = '18px sans-serif'; c.fillStyle = 'rgba(255,255,255,.5)';
      [12, 20, 30, 40, 60].forEach((L) => c.fillText(L + ' mm', lx(L) - 18, y0 + 26));
      [['C2', 65.4], ['C3', 130.8], ['C4', 261.6], ['C5', 523.3], ['C6', 1046.5], ['C7', 2093]].forEach(([n, f]) => { c.fillText(n, 30, ly(f) + 6); c.strokeStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.moveTo(x0, ly(f)); c.lineTo(x1, ly(f)); c.stroke(); });
      [[0.25, 'rgba(122,162,255,.7)'], [0.4, 'rgba(255,181,71,.7)'], [0.6, 'rgba(255,122,182,.7)']].forEach(([t, col]) => {
        c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath();
        for (let L = 12; L <= 60; L += 1) { const f = reedF(L / 1000, t / 1000), x = lx(L), y = ly(clamp(f, 30, 5000)); if (L === 12) c.moveTo(x, y); else c.lineTo(x, y); }
        c.stroke(); c.fillStyle = col; c.fillText(t + ' mm', x1 - 70, ly(clamp(reedF(0.058, t / 1000), 30, 5000)) - 8);
      });
      const x = lx(s.L), y = ly(clamp(s.f, 30, 5000));
      c.fillStyle = '#8ef0ff'; c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill();
      c.font = 'bold 22px sans-serif'; c.fillText(`${noteOf(s.f).name}  ${fmtHz(s.f)}`, Math.min(x + 16, x1 - 190), y - 14);
    });
    const bm = boardMesh(chart, 7.2, 3.52); bm.position.set(-5.6, 1.6, 4.6); bm.rotation.set(-0.72, 0.12, 0, 'YXZ'); bm.scale.setScalar(0.85); root.add(bm);
    const lab = {
      tongue: stage.label('Brass tongue', [0, 0, 0], root, 'hot'),
      rivet: stage.label('Rivets', [0, 0, 0], root),
      plate: stage.label('Plate with a slot', [0, 0, 0], root),
      hi: stage.label('Air under pressure', [0, 0, 0], root),
      puff: stage.label('Puffs of air: the sound', [0, 0, 0], root),
    };

    const layout = (s) => {
      const L = s.L / 1000 / U, w = Math.max(0.0028, Math.min(0.0055, 0.0042 * Math.sqrt(27.5 / s.L))) / U;
      const key = `${L}|${w}`;
      if (key === lastBuild) return { L, w };
      lastBuild = key;
      plate.children.slice().forEach((c) => { plate.remove(c); c.geometry.dispose(); });
      const tp = TP / U, gap = 0.05 / 1000 / U, lr = 2.4, lt = 1.0, side = 1.4;
      const x0 = -L / 2, x1 = L / 2 + gap;
      const add = (w_, d_, x, z) => { const b = box(w_, tp, d_, brass); b.position.set(x, Y0, z); plate.add(b); };
      add(lr, w + 2 * side, x0 - lr / 2, 0);                                   // root end (under the rivets)
      add(lt, w + 2 * side, x1 + lt / 2, 0);                                   // tip end
      add(x1 - x0, side, (x0 + x1) / 2, w / 2 + gap + side / 2);              // the two long sides of the slot
      add(x1 - x0, side, (x0 + x1) / 2, -(w / 2 + gap + side / 2));
      rivets.forEach((r, j) => r.position.set(x0 - 1.2, Y0 + tp / 2 + 0.25, (j - 0.5) * w * 0.6));
      cell.scale.set(L + lr + lt + 1, 1, w + 2 * side); cell.position.set((x0 - lr + x1 + lt) / 2, Y0 - tp / 2 - 0.6, 0);
      lab.tongue.position.set(L * 0.15, Y0 + 1.6, 0);
      lab.rivet.position.set(x0 - 1.5, Y0 + 1.2, -w);
      lab.plate.position.set(x1 + 0.2, Y0 - 0.5, w / 2 + side + 0.4);
      lab.hi.position.set(-L * 0.1, Y0 + 3.4, -w);
      lab.puff.position.set(L * 0.25, Y0 - 3.4, 0);
      return { L, w };
    };

    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        const { L, w } = layout(s);
        const tpv = TP / U, t = (s.t / 1000) / U;
        const f = freq(s);
        // Slowed down: shown at about 0.7 swings a second. Rest: set a little above the plate.
        const fv = 0.7;
        phase += TAU * fv * dt;
        const rest = tpv / 2 + 0.3e-3 / U, A = 1.9e-3 / U;
        const tipY = rest + A * Math.sin(phase) - A * 0.18;
        // Deform the tongue: x from 0 (root, at −L/2 − 1.6 over the rivets) to 1 (tip).
        const pos = geo.attributes.position.array, xr = -L / 2 - 2.0, Lt = L + 2.0;
        for (let i = 0; i < pos.length; i += 3) {
          const bx = base[i] + 0.5, by = base[i + 1], bz = base[i + 2];
          const xx = xr + bx * Lt, u = clamp((xx + L / 2) / L, 0, 1);
          const hh = t * scrapeProfile(u, s.where, s.scrape);
          const dy = u > 0 ? tipY * modeShape(u) + rest * (1 - modeShape(u)) : rest;
          pos[i] = xx; pos[i + 1] = Y0 + dy + (by + 0.5) * hh; pos[i + 2] = bz * w;
        }
        geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
        // The scraped patch and the file.
        const xs = -L / 2 + s.where * L, ys = Y0 + tipY * modeShape(s.where) + rest * (1 - modeShape(s.where));
        scr.visible = s.scrape > 0.005; scr.scale.set(L * 0.14, 0.02, w * 0.9); scr.position.set(xs, ys + t + 0.01, 0);
        file.visible = s.scrape > 0.005; file.position.set(xs + 0.4, ys + t + 0.9 + 0.15 * Math.sin(phase * 3), 0);
        // Air escapes when the tongue is out of the slot, above or below it.
        const open = Math.max(0, tipY - tpv / 2) + Math.max(0, -tpv / 2 - (tipY + t));
        const emit = open * 55 * dt * 30;
        for (let e = 0; e < emit; e++) {
          const q = P[pi = (pi + 1) % NP];
          q.age = 0; q.x = -L / 2 + L * (0.35 + 0.65 * rnd()); q.z = (rnd() - 0.5) * w * 1.6; q.vx = (rnd() - 0.3) * 0.8; q.vz = (rnd() - 0.5) * 1.6; q.vy = -(3.2 + rnd() * 1.5);
        }
        P.forEach((q, i) => {
          q.age += dt;
          const alive = q.age < 1.4;
          puff.place(i, [q.x + q.vx * q.age, Y0 - tpv / 2 - 0.1 + q.vy * q.age * (1 - q.age * 0.25), q.z + q.vz * q.age], null, alive ? 1.2 - q.age * 0.6 : 0.0001);
        });
        puff.done();
        HI.forEach((q, i) => {
          q.y -= dt * (0.4 + open * 0.8); if (q.y < 0) q.y += 1;
          hi.place(i, [-L / 2 + q.x * L * 1.05, Y0 + 0.4 + q.y * 2.4, q.z * w * 1.8], null, 1);
        });
        hi.done();
        const ck = `${s.L}|${s.t}|${f.toFixed(2)}`; if (ck !== lastChart) { lastChart = ck; chart.redraw({ L: s.L, t: s.t, f }); }
        if (s.hear) voice.set([{ id: 'reed', bank: 'male', f }], 0.75, 0.45); else voice.set([], 0, 0.4);
        const narrow = stage.host.clientWidth < 560;
        lab.rivet.visible = lab.hi.visible = !narrow;
        bm.visible = !narrow;
      },
      readout: (s) => {
        const f0 = reedF(s.L / 1000, s.t / 1000), f = freq(s), n = noteOf(f), dc = 1200 * Math.log2(f / f0);
                return compact(`<div class="big">${n.name}, ${fmtHz(f)}</div>
          <div class="row"><span>Unscraped: 580 · t / L²</span><b>${fmtHz(f0)}</b></div>
          <div class="row"><span>Scraping changed it by</span><b class="${dc > 0.5 ? 'ok' : dc < -0.5 ? 'no' : ''}">${s.scrape > 0 ? (dc > 0 ? '+' : '') + dc.toFixed(0) + ' cents (' + (dc > 0 ? 'higher' : 'lower') + ')' : 'not scraped'}</b></div>
          <div class="row"><span>Puffs of air each second</span><b>${Math.round(f)}</b></div>
          <small>Drawn about ${Math.round(f / 0.7)} times slower than life. A blown reed sounds a hair below this natural frequency.</small>`, stage);
      },
      dispose() { voice.off(); },
    };
  },
};
