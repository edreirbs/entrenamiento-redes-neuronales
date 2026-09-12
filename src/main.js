/**
 * Tú contra la mosca — dos duelos en 3D contra circuitos de Drosophila
 * simulados neurona por neurona en el navegador.
 *
 * El motor (src/lif.js) y los circuitos (src/circuits.js) son los mismos que
 * se calibraron midiendo; aquí sólo se orquestan y se dibujan.
 */
import * as THREE from '../vendor/three.module.js';
import {
  buildEscapeCircuit, retinaDrive, loomingFrame, loomingRadius, GRID_W, GRID_H,
  buildMemoryCircuit, memoryStep, chooseDoor, N_DOORS,
} from './circuits.js';
import { Arena } from './scene3d.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const P = GRID_W * GRID_H;
const DT = 0.5;
const FOCAL = 4, L_OVER_V = 40, MOTOR_DELAY = 5;
const SWAT_TOP = 4.2, SWAT_HIT = 0.12;
const TRIALS = 3;
const CUE_MS = 900, DARK_MS = 3000, PROBE_MS = 220;

const escape = buildEscapeCircuit();
const arena = new Arena($('stage'), null, escape.layout);
const flyH = arena.flies.human, flyF = arena.flies.fly;

const score = { human: 0, fly: 0 };
let results = [];

// ─── Bucle de dibujo, siempre corriendo ───────────────────────────────
let last = performance.now();
const v = new THREE.Vector3();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  arena.render(dt);
  place($('tagH'), $('numH'), flyH, 0.55);
  place($('tagF'), $('numF'), flyF, 0.55);
  requestAnimationFrame(loop);
}
function place(tag, num, fly, lift) {
  v.set(fly.group.position.x, fly.group.position.y + lift, fly.group.position.z);
  v.project(arena.camera);
  const x = (v.x * 0.5 + 0.5) * innerWidth;
  const y = (-v.y * 0.5 + 0.5) * innerHeight;
  num.style.left = tag.style.left = `${x}px`;
  num.style.top = `${y}px`;
  tag.style.top = `${y - 17}px`;
}
requestAnimationFrame(loop);

// ─── Pantallas ────────────────────────────────────────────────────────
const veil = $('veil'), panel = $('panel'), cue = $('cue');
const show = (html) => { panel.innerHTML = html; veil.classList.remove('hide'); };
const hide = () => veil.classList.add('hide');
const setCue = (html, big) => { cue.innerHTML = html; cue.classList.toggle('big', !!big); };
const dots = (list) => {
  $('dots').innerHTML = list.map((w) => `<i class="${w === 'human' ? 'h' : w === 'fly' ? 'f' : ''}"></i>`).join('');
};

function intro() {
  show(`<span class="bug">🪰</span>
    <h1>Tú contra la mosca</h1>
    <p>Dos duelos contra un cerebro simulado neurona por neurona. Ella tiene 166 mil; tú, 86 mil millones. Vas a perder el primero.</p>
    <button class="btn" id="go">Empezar</button>`);
  $('go').onclick = () => { score.human = 0; score.fly = 0; round1(); };
}

function between(title, text, label, next) {
  show(`<h2>${title}</h2><p>${text}</p><button class="btn" id="go">${label}</button>`);
  $('go').onclick = next;
}

function roundEnd(title, text, h, f, subtitle, label, next) {
  if (h > f) score.human++; else if (f > h) score.fly++;
  show(`<h2>${title}</h2>
    <div class="score"><span class="h">${h}</span> <span class="vs">—</span> <span class="f">${f}</span></div>
    <div class="sub">${subtitle}</div>
    <p>${text}</p><button class="btn" id="go">${label}</button>`);
  $('go').onclick = next;
}

// ─── RONDA 1 · el matamoscas ──────────────────────────────────────────
async function round1() {
  between(
    'El matamoscas',
    'Un matamoscas cae sobre las dos. Gana la primera en saltar. Tú tienes la barra espaciadora; ella tiene la neurona gigante, cinco sinapsis entre el fotón y el músculo del salto.',
    'Vamos', async () => {
      hide();
      document.body.classList.add('showing');
      arena.setCubes(false);
      arena.showSwatters(true);
      flyF.setBrain(escape.layout, 'escape');
      results = [];
      dots([]);
      for (let i = 0; i < TRIALS; i++) { results.push(await swatTrial(i)); dots(results.map((r) => r.winner)); await sleep(1500); }
      arena.showSwatters(false);
      document.body.classList.remove('showing');
      setCue('');
      const h = results.filter((r) => r.winner === 'human').length;
      const f = results.filter((r) => r.winner === 'fly').length;
      roundEnd(
        f > h ? 'Te ganó' : h > f ? 'Le ganaste' : 'Empate',
        f >= h
          ? 'Tu retina tarda unos 40 ms nada más en convertir la luz en señal, y después eso recorre corteza visual, corteza motora, médula y brazo. Ella se salta todo.'
          : 'Le ganaste a la neurona gigante. Casi no pasa.',
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
    setCue(`Intento ${trial + 1} de ${TRIALS}<em>prepárate</em>`);
    const wait = 1100 + Math.random() * 1800;
    let phase = 'wait', t0 = 0, simT = 0, humanMs = null, flyMs = null;
    let raf = 0;

    const onInput = (e) => {
      if (e.type === 'keydown' && e.code !== 'Space') return;
      e.preventDefault();
      if (phase === 'wait') { finishEarly(); return; }
      if (phase === 'strike' && humanMs === null) { humanMs = performance.now() - t0; flyH.jump(); }
    };
    addEventListener('keydown', onInput);
    addEventListener('pointerdown', onInput);
    const detach = () => { removeEventListener('keydown', onInput); removeEventListener('pointerdown', onInput); };

    const idleTimer = setInterval(() => { paint(); }, 33);
    const strikeTimer = setTimeout(() => { phase = 'strike'; t0 = performance.now(); setCue('¡AHORA!', true); raf = requestAnimationFrame(frame); }, wait);

    function finishEarly() {
      clearTimeout(strikeTimer); clearInterval(idleTimer); detach();
      setCue('Salida en falso.<em>adelantarse no es reaccionar</em>');
      flyH.squash();
      resolve({ winner: 'fly', human: null, fly: null, falseStart: true });
    }

    function paint() {
      flyF.paintBrain(net.trace);
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
      paint();

      const u = Math.min(1, elapsed / ttc);
      arena.setSwatterHeight(SWAT_TOP * (1 - u) + SWAT_HIT * u);
      $('numH').innerHTML = humanMs !== null ? `${Math.round(humanMs)}<small>ms</small>` : `${Math.round(Math.min(elapsed, ttc))}<small>ms</small>`;
      $('numF').innerHTML = flyMs !== null ? `${Math.round(flyMs)}<small>ms</small>` : `${Math.round(simT)}<small>ms</small>`;

      if (elapsed < ttc + 420 || simT < ttc) { raf = requestAnimationFrame(frame); return; }

      cancelAnimationFrame(raf); clearInterval(idleTimer); detach();
      const hOk = humanMs !== null && humanMs < ttc;
      const fOk = flyMs !== null && flyMs < ttc;
      if (!hOk) flyH.squash();
      if (!fOk) flyF.squash();
      const winner = hOk && fOk ? (humanMs < flyMs ? 'human' : 'fly') : hOk ? 'human' : fOk ? 'fly' : 'draw';
      setCue(winner === 'fly' && hOk
        ? `Saltó <b>${Math.round(humanMs - flyMs)} ms</b> antes que tú`
        : winner === 'fly' ? 'Te aplastó'
          : winner === 'human' ? `Le ganaste por <b>${Math.round(flyMs - humanMs)} ms</b>` : 'Las dos afuera');
      // retirar el matamoscas
      let y = SWAT_HIT;
      const lift = setInterval(() => { y += 0.35; arena.setSwatterHeight(y); if (y > SWAT_TOP + 1) clearInterval(lift); }, 16);
      resolve({ winner, human: humanMs, fly: flyMs });
    }
  });
}

// ─── RONDA 2 · la memoria ─────────────────────────────────────────────
async function round2() {
  between(
    'La memoria',
    'Se enciende un terrón de azúcar, se apaga la luz tres segundos y hay que recordar cuál era. Elige con las teclas 1 a 4, o tocando el terrón.',
    'Vamos', async () => {
      hide();
      document.body.classList.add('showing');
      arena.showSwatters(false);
      arena.setCubes(true);
      // El cerebro visible pasa a ser el del circuito que ahora corre.
      flyF.setBrain(buildMemoryCircuit().layout, 'memory');
      results = []; dots([]);
      for (let i = 0; i < TRIALS; i++) { results.push(await memoryTrial(i)); dots(results.map((r) => r.winner)); await sleep(1600); }
      document.body.classList.remove('showing');
      arena.setCubes(false); arena.setDark(0); setCue('');
      const h = results.filter((r) => r.winner === 'human').length;
      const f = results.filter((r) => r.winner === 'fly').length;
      roundEnd(
        h > f ? 'Ganaste' : f > h ? 'Te ganó' : 'Empate',
        'Su cuerpo fungiforme sí aprende: la dopamina marcó el terrón y potenció las sinapsis activas. Lo que no tiene es dónde guardarlo — la huella decae en poco más de un segundo.',
        h, f, 'aciertos', 'Ver el marcador', final);
    });
}

function memoryTrial(trial) {
  const mb = buildMemoryCircuit();
  const mbon = mb.layout.pops.MBON;
  const I = new Float32Array(mb.net.n);
  const target = Math.floor(Math.random() * N_DOORS);
  flyH.reset(); flyF.reset();
  $('numH').textContent = ''; $('numF').textContent = '';

  // La fase termina cuando se cumple el tiempo SIMULADO, no el de reloj. Si se
  // cortara por reloj, en un equipo lento la simulación se quedaría corta y la
  // mosca olvidaría menos de lo que debe: acertaría siempre, y por una razón
  // que no tiene nada que ver con su memoria.
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
      onFrame(Math.min(1, simT / ms));
      if (simT >= ms) { res(); return; }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });

  return (async () => {
    setCue(`Intento ${trial + 1} de ${TRIALS}<em>memoriza el terrón</em>`);
    await run(CUE_MS, target, 1, (p) => arena.litCube(target, 0.6 + 0.4 * Math.sin(p * 14)));
    arena.litCube(-1);

    setCue('', false);
    await run(DARK_MS, -1, 0, (p) => {
      arena.setDark(p < 0.12 ? p / 0.12 : p > 0.94 ? (1 - p) / 0.06 : 1);
      setCue(`<em>oscuridad · ${((DARK_MS * (1 - p)) / 1000).toFixed(1)} s</em>`);
    });
    arena.setDark(0);

    setCue('¿CUÁL ERA?', true);
    const pick = waitPick();
    const scores = [];
    for (let d = 0; d < N_DOORS; d++) {
      let s = 0;
      await run(PROBE_MS, d, 0, () => {}, (fired) => {
        for (const i of fired) if (i >= mbon.start && i < mbon.end) s++;
      });
      scores.push(s);
    }
    const flyPick = chooseDoor(scores);
    hopTo(flyF, flyPick);
    const humanPick = await pick;
    hopTo(flyH, humanPick);

    await sleep(700);
    arena.litCube(target, 1);
    const hOk = humanPick === target, fOk = flyPick === target;
    setCue(hOk && !fOk ? 'Tú sí, ella no.' : !hOk && fOk ? 'Ella sí, tú no.' : hOk ? 'Las dos.' : 'Ninguna.');
    $('numH').textContent = hOk ? '✓' : '✕';
    $('numF').textContent = fOk ? '✓' : '✕';
    await sleep(400);
    arena.litCube(-1);
    return { winner: hOk && !fOk ? 'human' : fOk && !hOk ? 'fly' : 'draw', hOk, fOk, scores };
  })();
}

function hopTo(fly, index) {
  const c = arena.cubes[index].mesh.position;
  fly.hopTo_(c.x, c.z + 0.45);
}

function waitPick() {
  return new Promise((resolve) => {
    const onKey = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= N_DOORS) { done(n - 1); } };
    const onTap = (e) => done(Math.max(0, Math.min(N_DOORS - 1, Math.floor(e.clientX / innerWidth * N_DOORS))));
    const done = (d) => { removeEventListener('keydown', onKey); removeEventListener('pointerdown', onTap); resolve(d); };
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', onTap);
  });
}

// ─── Final ────────────────────────────────────────────────────────────
function final() {
  const tie = score.human === score.fly;
  show(`<h2>${tie ? 'Uno cada quien' : score.fly > score.human ? 'Te ganó una mosca' : 'Le ganaste'}</h2>
    <div class="score"><span class="h">${score.human}</span> <span class="vs">—</span> <span class="f">${score.fly}</span></div>
    <div class="sub">rondas</div>
    <p>Te gana en reflejos, le ganas en memoria. Ninguno de los dos circuitos fue entrenado: la conducta sale del cableado.</p>
    <button class="btn" id="go">Otra vez</button>`);
  $('go').onclick = () => { score.human = 0; score.fly = 0; round1(); };
}

// Gancho de depuración: permite posar la escena desde fuera para revisar el
// encuadre y la iluminación sin depender de los tiempos de una partida.
window.__dbg = { arena, escape, flyH, flyF };

$('info').onclick = () => $('about').showModal();
$('closeAbout').onclick = () => $('about').close();

intro();
