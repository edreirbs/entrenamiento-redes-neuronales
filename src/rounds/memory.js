/**
 * RONDA 3 — La memoria.
 *
 * Se enciende una de cuatro puertas, se apaga la luz unos segundos, y hay que
 * recordar cuál era. Para ti es trivial. Para la mosca no.
 *
 * Su cuerpo fungiforme SÍ aprende: una neurona dopaminérgica marca la puerta
 * correcta y potencia las sinapsis de las células de Kenyon activas en ese
 * momento. Lo que no tiene es dónde guardarlo: esa huella decae con una
 * constante de tiempo de alrededor de un segundo, y a los tres segundos ya no
 * queda casi nada que leer.
 *
 * Esta es la ronda que ganas, y la razón por la que la ganas es la misma por la
 * que un cerebro cableado de fábrica no puede hacerlo todo.
 */
import { buildMemoryCircuit, memoryStep, chooseDoor, N_DOORS } from '../circuits.js';
import { BrainView, MEMORY_SPEC } from '../brainview.js';
import { sleep } from '../ui.js';

const DT = 0.5;
const CUE_MS = 900;
const DARK_MS = 3000;
const PROBE_MS = 220;
const TRIALS = 3;

export async function runMemory(dom) {
  const mb = buildMemoryCircuit();
  const view = new BrainView(dom.cvBrain, mb.layout, MEMORY_SPEC);
  const mbon = mb.layout.pops.MBON;
  const I = new Float32Array(mb.net.n);

  dom.tagH.textContent = '1 · 2 · 3 · 4 o toca';
  dom.tagF.textContent = 'células de Kenyon → MBON';

  const results = [];
  for (let trial = 0; trial < TRIALS; trial++) {
    dom.setScore(results);
    results.push(await oneTrial(trial));
    dom.setScore(results);
    await sleep(1400);
  }

  const h = results.filter((r) => r.humanOk).length;
  const f = results.filter((r) => r.flyOk).length;
  return {
    winner: h > f ? 'human' : f > h ? 'fly' : 'draw',
    scoreH: h, scoreF: f, results,
  };

  // ───────────────────────────────────────────────────────────────
  async function oneTrial(trial) {
    const target = Math.floor(Math.random() * N_DOORS);
    let humanPick = null;

    // ── Se enciende la puerta. La dopamina marca cuál es la buena.
    dom.prompt.innerHTML = `Intento ${trial + 1} de ${TRIALS} · <strong>memoriza la puerta</strong>`;
    await phase(CUE_MS, target, 1, (p) => {
      paint(dom.cvH, target, null, 'cue', p);
      paint(dom.cvF, target, null, 'cue', p);
      dom.hudH.innerHTML = 'memoriza';
      dom.hudF.innerHTML = 'aprendiendo';
    });

    // ── Oscuridad. Aquí la huella de la mosca se apaga sola.
    dom.prompt.innerHTML = 'Oscuridad…';
    await phase(DARK_MS, -1, 0, (p) => {
      paint(dom.cvH, -1, null, 'dark', p);
      paint(dom.cvF, -1, null, 'dark', p);
      const left = ((DARK_MS * (1 - p)) / 1000).toFixed(1);
      dom.hudH.innerHTML = `${left} <small>s</small>`;
      dom.hudF.innerHTML = `huella ${(traceStrength() * 100).toFixed(0)}<small>%</small>`;
    });

    // ── Elección.
    dom.prompt.innerHTML = '<strong>¿Cuál era?</strong>';
    const pickPromise = waitPick(dom.cvH);
    const flyScores = [];
    for (let d = 0; d < N_DOORS; d++) {
      let s = 0;
      await phase(PROBE_MS, d, 0, (p) => {
        paint(dom.cvH, -1, humanPick, 'choose', p);
        paint(dom.cvF, -1, null, 'probe', p, d);
        dom.hudF.innerHTML = `evaluando puerta ${d + 1}`;
      }, (fired) => {
        for (const i of fired) if (i >= mbon.start && i < mbon.end) s++;
      });
      flyScores.push(s);
    }
    const flyPick = chooseDoor(flyScores);

    humanPick = await pickPromise;

    const humanOk = humanPick === target, flyOk = flyPick === target;
    paint(dom.cvH, target, humanPick, 'reveal', 1);
    paint(dom.cvF, target, flyPick, 'reveal', 1);
    dom.hudH.innerHTML = humanOk ? 'correcto' : 'incorrecto';
    dom.hudF.innerHTML = flyOk ? 'correcto' : 'incorrecto';
    dom.prompt.innerHTML = flyOk
      ? `La mosca acertó — con la huella casi apagada, una de cada cuatro le sale por azar. Respuestas del MBON: <code>${flyScores.join(' · ')}</code>`
      : `La mosca ya no sabe cuál era. Respuestas del MBON por puerta: <code>${flyScores.join(' · ')}</code> — todas casi iguales.`;

    return { target, humanPick, flyPick, humanOk, flyOk, flyScores };
  }

  function traceStrength() {
    let m = 0;
    for (const w of mb.w) if (w > m) m = w;
    return Math.min(1, m / 0.30);
  }

  /** Corre el circuito `ms` milisegundos mostrando la clave `cue`. */
  function phase(ms, cue, dopamine, render, onFired) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      let simT = 0;
      const frame = (now) => {
        const elapsed = now - t0;
        let steps = 0;
        while (simT < elapsed && simT < ms && steps < 140) {
          I.fill(0);
          if (cue >= 0) for (let i = 0; i < 10; i++) I[mb.layout.idx('PN', cue * 10 + i)] = 0.12;
          const fired = memoryStep(mb, DT, I, dopamine);
          if (onFired) onFired(fired);
          simT += DT;
          steps++;
        }
        render(Math.min(1, elapsed / ms));
        view.draw(mb.net.trace, { hot: dopamine > 0 });
        dom.brainStats.textContent =
          `${mb.net.n} neuronas · huella de memoria ${(traceStrength() * 100).toFixed(0)}% · decae con τ = ${mb.tauMem} ms`;
        if (elapsed >= ms) { resolve(); return; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }
}

function waitPick(canvas) {
  return new Promise((resolve) => {
    const onKey = (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= N_DOORS) { cleanup(); resolve(n - 1); }
    };
    const onTap = (e) => {
      const r = canvas.getBoundingClientRect();
      const d = Math.floor(((e.clientX - r.left) / r.width) * N_DOORS);
      if (d >= 0 && d < N_DOORS) { cleanup(); resolve(d); }
    };
    const cleanup = () => {
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onTap);
    };
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onTap);
  });
}

// ─── Dibujo ───────────────────────────────────────────────────────

function paint(cv, lit, pick, mode, p, probing) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.fillStyle = '#06070b'; g.fillRect(0, 0, W, H);

  const pad = 16, gap = 12;
  const w = (W - pad * 2 - gap * (N_DOORS - 1)) / N_DOORS;
  const h = H - 80, y = 44;

  for (let d = 0; d < N_DOORS; d++) {
    const x = pad + d * (w + gap);
    const isLit = d === lit && (mode === 'cue' || mode === 'reveal');
    const isProbe = mode === 'probe' && d === probing;
    const isPick = d === pick;

    g.fillStyle = isLit ? '#ffd166' : isProbe ? '#1e3a38' : '#11141c';
    if (isLit && mode === 'cue') g.globalAlpha = 0.78 + 0.22 * Math.sin(p * 12);
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;

    g.lineWidth = isPick ? 3 : 1.5;
    g.strokeStyle = isPick ? (d === lit ? '#3fe0c5' : '#ff4d6d') : '#262a36';
    g.strokeRect(x, y, w, h);

    g.fillStyle = isLit ? '#5a4200' : '#4a5266';
    g.font = '700 22px ui-monospace, monospace';
    g.textAlign = 'center';
    g.fillText(String(d + 1), x + w / 2, y + h / 2 + 8);
  }

  g.textAlign = 'left';
  g.fillStyle = '#6b7286';
  g.font = '600 11px ui-monospace, monospace';
  const label = { cue: 'MEMORIZA', dark: 'OSCURIDAD', choose: 'ELIGE', probe: 'EVALUANDO', reveal: 'RESULTADO' }[mode];
  g.fillText(label, pad, 26);
}
