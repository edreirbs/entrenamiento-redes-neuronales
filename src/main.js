/**
 * Tú contra la mosca — dos duelos en 3D contra circuitos de Drosophila
 * simulados neurona por neurona en el navegador.
 *
 * El motor (lif.js) y los circuitos (circuits.js) son los mismos que se
 * calibraron midiendo; aquí se orquestan, se dibujan y se les deja aprender.
 */
import * as THREE from '../vendor/three.module.js';
import {
  buildEscapeCircuit, retinaDrive, loomingFrame, loomingRadius, GRID_W, GRID_H,
  buildMemoryCircuit, memoryStep, chooseDoor, N_DOORS,
} from './circuits.js';
import { Arena } from './scene3d.js';
import * as Aprendizaje from './learning.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const P = GRID_W * GRID_H;
const DT = 0.5;
const FOCAL = 4, L_OVER_V = 40, MOTOR_DELAY = 5;
const SWAT_TOP = 4.2, SWAT_HIT = 0.12;
const SWAT_TRIALS = 3;
const SEQ_LENGTHS = [1, 2, 3, 4];        // la secuencia crece en cada intento
const CUE_MS = 700, GAP_MS = 210, DARK_MS = 3000, PROBE_MS = 180;

const escape = buildEscapeCircuit();
const arena = new Arena($('stage'), null, escape.layout);
const flyH = arena.flies.human, flyF = arena.flies.fly;

let mem = Aprendizaje.load();
const score = { human: 0, fly: 0 };

// ─── Bucle de dibujo ──────────────────────────────────────────────────
let last = performance.now();
const v = new THREE.Vector3();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  arena.render(dt);
  place($('tagH'), $('numH'), flyH);
  place($('tagF'), $('numF'), flyF);
  requestAnimationFrame(loop);
}
function place(tag, num, fly) {
  v.set(fly.group.position.x, fly.group.position.y + 0.55, fly.group.position.z);
  v.project(arena.camera);
  const x = (v.x * 0.5 + 0.5) * innerWidth;
  const y = (-v.y * 0.5 + 0.5) * innerHeight;
  num.style.left = tag.style.left = `${x}px`;
  num.style.top = `${y}px`;
  tag.style.top = `${y - 17}px`;
}
requestAnimationFrame(loop);

// ─── Pantalla ─────────────────────────────────────────────────────────
const veil = $('veil'), panel = $('panel'), cue = $('cue');
const show = (html) => { panel.innerHTML = html; veil.classList.remove('hide'); };
const hide = () => veil.classList.add('hide');
const setCue = (html, big) => { cue.innerHTML = html; cue.classList.toggle('big', !!big); };
const setControls = (html) => { $('controls').innerHTML = html || ''; };
const dots = (list) => {
  $('dots').innerHTML = list.map((w) => `<i class="${w === 'human' ? 'h' : w === 'fly' ? 'f' : ''}"></i>`).join('');
};

const CONTROLS = {
  swat: '<span class="c"><kbd>espacio</kbd> saltar</span>'
      + '<span class="c tap"><kbd>◎</kbd> o toca la pantalla</span>',
  mem: '<span class="c"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> elegir terrón</span>'
     + '<span class="c tap"><kbd>◎</kbd> o toca el terrón</span>',
};

function paintLearn() {
  $('learn').hidden = false;
  $('barHab').style.width = `${Math.round(mem.hab / 0.85 * 100)}%`;
  $('barMem').style.width = `${Math.round(Aprendizaje.consolidacion(mem) * 100)}%`;
}

function intro() {
  setControls('');
  const veterana = mem.partidas > 0;
  show(`<span class="bug">🪰</span>
    <h1>Tú contra la mosca</h1>
    <p>Dos duelos contra un cerebro simulado neurona por neurona. Ella tiene 166 mil; tú, 86 mil millones.</p>
    ${veterana ? `<p style="color:#7f8799;font-size:13.5px">Esta mosca ya jugó ${mem.partidas} ${mem.partidas === 1 ? 'partida' : 'partidas'} contigo. Su escape se habituó y su memoria se consolidó — no es la misma de la primera vez.</p>` : ''}
    <button class="btn" id="go">${veterana ? 'Otra' : 'Empezar'}</button>`);
  $('go').onclick = () => { score.human = 0; score.fly = 0; round1(); };
  if (veterana) paintLearn();
}

function between(title, text, next) {
  setControls('');
  show(`<h2>${title}</h2><p>${text}</p><button class="btn" id="go">Vamos</button>`);
  $('go').onclick = next;
}

function roundEnd(title, text, h, f, unidad, label, next) {
  if (h > f) score.human++; else if (f > h) score.fly++;
  setControls('');
  show(`<h2>${title}</h2>
    <div class="score"><span class="h">${h}</span> <span class="vs">—</span> <span class="f">${f}</span></div>
    <div class="sub">${unidad}</div>
    <p>${text}</p><button class="btn" id="go">${label}</button>`);
  $('go').onclick = next;
}

// ─── RONDA 1 · el matamoscas ──────────────────────────────────────────
function round1() {
  between('El matamoscas',
    'Un matamoscas cae sobre las dos. Gana la primera en saltar. Tú tienes la barra espaciadora; ella tiene la neurona gigante, cinco sinapsis entre el fotón y el músculo del salto.',
    async () => {
      hide();
      document.body.classList.add('showing');
      setControls(CONTROLS.swat);
      arena.setCubes(false);
      arena.showSwatters(true);
      flyF.setBrain(escape.layout, 'escape');
      paintLearn();

      const res = [];
      dots([]);
      for (let i = 0; i < SWAT_TRIALS; i++) {
        escape.setHabituation(mem.hab);
        res.push(await swatTrial(i));
        Aprendizaje.habituar(mem);
        Aprendizaje.save(mem);
        paintLearn();
        dots(res.map((r) => r.winner));
        await sleep(1500);
      }

      arena.showSwatters(false);
      document.body.classList.remove('showing');
      setCue('');
      const h = res.filter((r) => r.winner === 'human').length;
      const f = res.filter((r) => r.winner === 'fly').length;
      const pct = Math.round(mem.hab / 0.85 * 100);
      roundEnd(f > h ? 'Te ganó' : h > f ? 'Le ganaste' : 'Empate',
        `Cada sombra que esquiva le deprime un poco las sinapsis que llegan a la neurona gigante: es habituación, y la vuelve más lenta. Va en ${pct} %. Siguiéndole el paso acabarás ganándole — o déjala descansar diez minutos y la encuentras fresca otra vez.`,
        h, f, 'saltos ganados', 'Ronda 2', round2);
    });
}

function swatTrial(trial) {
  const { net, layout } = escape;
  const gf = layout.pops.DNp01, mn = layout.pops.MN;
  const lum = new Float32Array(P), prev = new Float32Array(P), I = new Float32Array(net.n);
  const ttc = 280 + Math.random() * 40;

  net.reset();
  flyH.reset(); flyF.reset();
  arena.setSwatterHeight(SWAT_TOP + 1.2);
  $('numH').textContent = ''; $('numF').textContent = '';
  loomingFrame(prev, GRID_W / 2, GRID_H / 2, loomingRadius(ttc, L_OVER_V, FOCAL));

  return new Promise((resolve) => {
    setCue(`Intento ${trial + 1} de ${SWAT_TRIALS}<em>prepárate</em>`);
    const wait = 1100 + Math.random() * 1800;
    let phase = 'wait', t0 = 0, simT = 0, humanMs = null, flyMs = null, raf = 0;

    const onInput = (e) => {
      if (e.type === 'keydown' && e.code !== 'Space') return;
      e.preventDefault();
      if (phase === 'wait') { finishEarly(); return; }
      if (phase === 'strike' && humanMs === null) { humanMs = performance.now() - t0; flyH.jump(); }
    };
    addEventListener('keydown', onInput);
    addEventListener('pointerdown', onInput);
    const detach = () => { removeEventListener('keydown', onInput); removeEventListener('pointerdown', onInput); };

    const idle = setInterval(() => flyF.paintBrain(net.trace), 33);
    const strike = setTimeout(() => {
      phase = 'strike'; t0 = performance.now();
      setCue('¡AHORA!', true);
      raf = requestAnimationFrame(frame);
    }, wait);

    function finishEarly() {
      clearTimeout(strike); clearInterval(idle); detach();
      setCue('Salida en falso.<em>adelantarse no es reaccionar</em>');
      flyH.squash();
      resolve({ winner: 'fly', human: null, fly: null, falseStart: true });
    }

    function frame(now) {
      const elapsed = now - t0;
      let steps = 0;
      while (simT < elapsed && simT < ttc && steps < 2400) {
        simT += DT;
        loomingFrame(lum, GRID_W / 2, GRID_H / 2, loomingRadius(ttc - simT, L_OVER_V, FOCAL));
        I.fill(0);
        retinaDrive(lum, prev, DT, I.subarray(0, P));
        const fired = net.step(DT, I);
        prev.set(lum);
        for (const i of fired) {
          if (i >= gf.start && i < gf.end) flyF.fire();
          if (flyMs === null && i >= mn.start && i < mn.end) { flyMs = simT + MOTOR_DELAY; flyF.jump(); }
        }
        steps++;
      }
      flyF.paintBrain(net.trace);

      const u = Math.min(1, elapsed / ttc);
      arena.setSwatterHeight(SWAT_TOP * (1 - u) + SWAT_HIT * u);
      $('numH').innerHTML = `${Math.round(humanMs ?? Math.min(elapsed, ttc))}<small>ms</small>`;
      $('numF').innerHTML = `${Math.round(flyMs ?? simT)}<small>ms</small>`;

      if (elapsed < ttc + 420 || simT < ttc) { raf = requestAnimationFrame(frame); return; }

      cancelAnimationFrame(raf); clearInterval(idle); detach();
      const hOk = humanMs !== null && humanMs < ttc;
      const fOk = flyMs !== null && flyMs < ttc;
      if (!hOk) flyH.squash();
      if (!fOk) flyF.squash();
      const winner = hOk && fOk ? (humanMs < flyMs ? 'human' : 'fly') : hOk ? 'human' : fOk ? 'fly' : 'draw';
      setCue(
        winner === 'fly' && hOk ? `Saltó <b>${Math.round(humanMs - flyMs)} ms</b> antes que tú`
          : winner === 'fly' ? 'Te aplastó'
            : winner === 'human' && fOk ? `Le ganaste por <b>${Math.round(flyMs - humanMs)} ms</b>`
              : winner === 'human' ? 'Ya no alcanzó a saltar'
                : 'Las dos afuera');
      let y = SWAT_HIT;
      const lift = setInterval(() => { y += 0.35; arena.setSwatterHeight(y); if (y > SWAT_TOP + 1) clearInterval(lift); }, 16);
      resolve({ winner, human: humanMs, fly: flyMs });
    }
  });
}

// ─── RONDA 2 · la memoria, con secuencias que crecen ──────────────────
function round2() {
  between('La memoria',
    'Se encienden terrones de azúcar en orden y hay que repetir la secuencia después de tres segundos a oscuras. Empieza con uno y cada intento agrega otro.',
    async () => {
      hide();
      document.body.classList.add('showing');
      setControls(CONTROLS.mem);
      arena.showSwatters(false);
      arena.setCubes(true);

      // Una sola mosca para toda la ronda: es un cerebro, no uno por intento.
      const mb = buildMemoryCircuit(Math.random, { tauMem: Aprendizaje.tauMemoria(mem) });
      flyF.setBrain(mb.layout, 'memory');
      paintLearn();

      let hTot = 0, fTot = 0, total = 0;
      const res = [];
      dots([]);
      for (const len of SEQ_LENGTHS) {
        const r = await memoryTrial(mb, len);
        hTot += r.hOk; fTot += r.fOk; total += len;
        mem.entrenamientos += 1;
        Aprendizaje.save(mem);
        paintLearn();
        res.push(r); dots(res.map((x) => x.winner));
        await sleep(1500);
      }

      document.body.classList.remove('showing');
      arena.setCubes(false); arena.setDark(0); setCue('');
      const pct = Math.round(Aprendizaje.consolidacion(mem) * 100);
      roundEnd(hTot > fTot ? 'Ganaste' : fTot > hTot ? 'Te ganó' : 'Empate',
        `Su cuerpo fungiforme aprende cuál era, pero no en qué orden: no tiene dónde guardar una secuencia. Con cada entrenamiento su huella tarda un poco más en borrarse — va en ${pct} % de consolidación — y aun así el orden se le sigue escapando.`,
        hTot, fTot, `de ${total} posiciones`, 'Ver el marcador', final);
    });
}

async function memoryTrial(mb, len) {
  const mbon = mb.layout.pops.MBON;
  const I = new Float32Array(mb.net.n);
  flyH.reset(); flyF.reset();
  $('numH').textContent = ''; $('numF').textContent = '';

  const seq = [];
  while (seq.length < len) {
    const d = Math.floor(Math.random() * N_DOORS);
    if (d !== seq[seq.length - 1]) seq.push(d);
  }

  /** Corre el circuito `ms` SIMULADOS. Cortar por reloj falsearía el olvido. */
  const run = (ms, cueIdx, dop, onFrame, onFired) => new Promise((res) => {
    const t0 = performance.now();
    let simT = 0;
    const f = (now) => {
      const target = Math.min(ms, now - t0);
      let steps = 0;
      while (simT < target && steps < 2400) {
        I.fill(0);
        if (cueIdx >= 0) for (let i = 0; i < 10; i++) I[mb.layout.idx('PN', cueIdx * 10 + i)] = 0.12;
        const fired = memoryStep(mb, DT, I, dop);
        if (onFired) onFired(fired);
        simT += DT; steps++;
      }
      flyF.paintBrain(mb.net.trace);
      if (onFrame) onFrame(Math.min(1, simT / ms));
      if (simT >= ms) { res(); return; }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });

  // ── Se muestra la secuencia, un terrón a la vez, con dopamina en cada uno.
  for (let k = 0; k < len; k++) {
    setCue(`Secuencia de ${len}<em>memoriza el orden · ${k + 1} de ${len}</em>`);
    await run(CUE_MS, seq[k], 1, (p) => arena.litCube(seq[k], 0.65 + 0.35 * Math.sin(p * 12)));
    arena.litCube(-1);
    await run(GAP_MS, -1, 0);
  }

  // ── Oscuridad.
  await run(DARK_MS, -1, 0, (p) => {
    arena.setDark(p < 0.12 ? p / 0.12 : p > 0.94 ? (1 - p) / 0.06 : 1);
    setCue(`<em>oscuridad · ${((DARK_MS * (1 - p)) / 1000).toFixed(1)} s</em>`);
  });
  arena.setDark(0);

  // ── La mosca contesta: una sola lectura del MBON, porque no guarda orden.
  const scores = [];
  for (let d = 0; d < N_DOORS; d++) {
    let s = 0;
    await run(PROBE_MS, d, 0, null, (fired) => {
      for (const i of fired) if (i >= mbon.start && i < mbon.end) s++;
    });
    scores.push(s);
  }
  const flySeq = Array.from({ length: len }, () => chooseDoor(scores));

  // ── Contestas tú.
  const mySeq = [];
  for (let k = 0; k < len; k++) {
    setCue(len === 1 ? '¿CUÁL ERA?' : `¿CUÁL ERA EL ${k + 1}.º?`, true);
    const pick = await waitPick();
    mySeq.push(pick);
    arena.litCube(pick, 0.9);
    await sleep(190);
    arena.litCube(-1);
    await sleep(90);
  }

  // ── Se revela la secuencia buena.
  setCue('<em>era esta</em>');
  hopTo(flyH, mySeq[0]); hopTo(flyF, flySeq[0]);
  for (const d of seq) { arena.litCube(d, 1); await sleep(330); arena.litCube(-1); await sleep(110); }

  const hOk = seq.filter((d, i) => mySeq[i] === d).length;
  const fOk = seq.filter((d, i) => flySeq[i] === d).length;
  $('numH').textContent = `${hOk}/${len}`;
  $('numF').textContent = `${fOk}/${len}`;
  setCue(hOk > fOk ? 'Tú lo recordaste mejor.' : fOk > hOk ? 'Ella lo recordó mejor.'
    : hOk === len ? 'Las dos completo.' : 'Empate.');

  return { winner: hOk > fOk ? 'human' : fOk > hOk ? 'fly' : 'draw', hOk, fOk, len };
}

function hopTo(fly, index) {
  const c = arena.cubes[index].mesh.position;
  fly.hopTo_(c.x, c.z + 0.5);
}

function waitPick() {
  return new Promise((resolve) => {
    const onKey = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= N_DOORS) done(n - 1); };
    const onTap = (e) => done(Math.max(0, Math.min(N_DOORS - 1, Math.floor(e.clientX / innerWidth * N_DOORS))));
    const done = (d) => { removeEventListener('keydown', onKey); removeEventListener('pointerdown', onTap); resolve(d); };
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', onTap);
  });
}

// ─── Final ────────────────────────────────────────────────────────────
function final() {
  mem.partidas += 1;
  Aprendizaje.save(mem);
  paintLearn();
  const tie = score.human === score.fly;
  show(`<h2>${tie ? 'Uno cada quien' : score.fly > score.human ? 'Te ganó una mosca' : 'Le ganaste'}</h2>
    <div class="score"><span class="h">${score.human}</span> <span class="vs">—</span> <span class="f">${score.fly}</span></div>
    <div class="sub">rondas · partida ${mem.partidas}</div>
    <p>Te gana en reflejos, le ganas en memoria. Y aprende de las dos: el escape se le habitúa —se vuelve más lenta— mientras su memoria se consolida. Vuelve a jugar y no será la misma.</p>
    <button class="btn" id="go">Otra vez</button>`);
  $('go').onclick = () => { score.human = 0; score.fly = 0; round1(); };
}

$('info').onclick = () => $('about').showModal();
$('closeAbout').onclick = () => $('about').close();
$('forget').onclick = () => {
  mem = Aprendizaje.reset();
  escape.setHabituation(0);
  paintLearn();
  $('about').close();
};

window.__dbg = { arena, escape, flyH, flyF, mem };
intro();
