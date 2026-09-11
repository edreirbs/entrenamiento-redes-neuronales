/**
 * RONDA 1 — El matamoscas.
 *
 * Una sombra se expande sobre los dos. El primero en saltar gana.
 * Tú tienes que ver, decidir y mover el dedo. La mosca tiene cinco sinapsis
 * entre el fotón y el músculo del salto, y la última es la neurona gigante.
 */
import { buildEscapeCircuit, retinaDrive, loomingFrame, loomingRadius, GRID_W, GRID_H }
  from '../circuits.js';
import { BrainView, ESCAPE_SPEC } from '../brainview.js';
import { sleep, fmtMs } from '../ui.js';

const P = GRID_W * GRID_H;
const DT = 0.5;                 // paso de integración, ms
const FOCAL = 4;                // escala del campo visual, en omatidios
const L_OVER_V = 40;            // razón tamaño/velocidad del objeto, ms
const MOTOR_DELAY = 5;          // retardo neuromuscular DNp01 → músculo, ms
const TRIALS = 3;

export async function runLooming(dom) {
  const { net, layout } = buildEscapeCircuit();
  const view = new BrainView(dom.cvBrain, layout, ESCAPE_SPEC);
  const gf = layout.pops.DNp01, mn = layout.pops.MN;

  const lum = new Float32Array(P), prev = new Float32Array(P), I = new Float32Array(net.n);
  const results = [];

  dom.tagH.textContent = 'espacio / toca';
  dom.tagF.textContent = 'DNp01 → motoneuronas';

  for (let trial = 0; trial < TRIALS; trial++) {
    dom.setScore(results);
    const ttc = 280 + Math.random() * 40;          // 280–320 ms hasta el impacto
    const r = await oneTrial(trial, ttc);
    results.push(r);
    dom.setScore(results);
    await sleep(1500);
  }

  const hWins = results.filter((r) => r.winner === 'human').length;
  const fWins = results.filter((r) => r.winner === 'fly').length;
  const hTimes = results.filter((r) => r.human != null && !r.falseStart).map((r) => r.human);
  const fTimes = results.map((r) => r.fly).filter((x) => x != null);

  return {
    winner: hWins > fWins ? 'human' : fWins > hWins ? 'fly' : 'draw',
    scoreH: hWins, scoreF: fWins,
    humanBest: hTimes.length ? Math.min(...hTimes) : null,
    flyBest: fTimes.length ? Math.min(...fTimes) : null,
    results,
  };

  // ───────────────────────────────────────────────────────────────
  async function oneTrial(trial, ttc) {
    net.reset();
    loomingFrame(prev, GRID_W / 2, GRID_H / 2, loomingRadius(ttc, L_OVER_V, FOCAL));
    dom.hudH.textContent = '—';
    dom.hudF.textContent = '—';

    // ── Espera. Adelantarse cuenta como salida en falso.
    dom.prompt.innerHTML = `Intento ${trial + 1} de ${TRIALS} · <strong>prepárate</strong>`;
    const wait = 1100 + Math.random() * 1900;
    const early = await raceWait(wait);
    if (early) {
      dom.prompt.innerHTML = '<strong>Salida en falso.</strong> Adelantarte no es reaccionar: la mosca no adivina, responde.';
      dom.hudH.innerHTML = 'falso <small>intento perdido</small>';
      dom.hudF.textContent = '—';
      return { winner: 'fly', human: null, fly: null, falseStart: true };
    }

    // ── El estímulo.
    dom.prompt.innerHTML = '<strong>¡AHORA!</strong>';
    let humanMs = null, flyMs = null, simT = 0, done = false;
    const t0 = performance.now();

    const onInput = () => { if (humanMs === null) humanMs = performance.now() - t0; };
    const detach = attachInput(onInput);

    await new Promise((resolve) => {
      const frame = (now) => {
        const elapsed = now - t0;
        let steps = 0;
        while (simT < elapsed && simT < ttc && steps < 120) {
          simT += DT;
          const rad = loomingRadius(ttc - simT, L_OVER_V, FOCAL);
          loomingFrame(lum, GRID_W / 2, GRID_H / 2, rad);
          I.fill(0);
          retinaDrive(lum, prev, DT, I.subarray(0, P));
          const fired = net.step(DT, I);
          prev.set(lum);
          for (const i of fired) {
            if (i >= gf.start && i < gf.end) view.pop();
            if (flyMs === null && i >= mn.start && i < mn.end) flyMs = simT + MOTOR_DELAY;
          }
          steps++;
        }

        const shown = Math.min(elapsed, ttc);
        const rad = loomingRadius(Math.max(ttc - shown, 1), L_OVER_V, FOCAL);
        drawHuman(dom.cvH, rad, humanMs, ttc, shown);
        loomingFrame(lum, GRID_W / 2, GRID_H / 2, rad);
        drawFly(dom.cvF, lum, flyMs, ttc, shown);
        view.draw(net.trace, { hot: flyMs !== null });
        dom.brainStats.textContent =
          `${net.n} neuronas · ${simT.toFixed(0)} ms simulados · DNp01 ${flyMs ? 'DISPARÓ' : 'en silencio'}`;
        dom.hudH.innerHTML = humanMs !== null ? fmtMs(humanMs) : `${Math.round(shown)} <small>ms</small>`;
        dom.hudF.innerHTML = flyMs !== null ? fmtMs(flyMs) : `${Math.round(simT)} <small>ms</small>`;

        if (!done && elapsed > ttc + 420) { done = true; resolve(); return; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    detach();

    // ── Veredicto.
    const hEscaped = humanMs !== null && humanMs < ttc;
    const fEscaped = flyMs !== null && flyMs < ttc;
    let winner = 'draw';
    if (hEscaped && fEscaped) winner = humanMs < flyMs ? 'human' : 'fly';
    else if (hEscaped) winner = 'human';
    else if (fEscaped) winner = 'fly';

    dom.hudH.innerHTML = humanMs !== null
      ? `${fmtMs(humanMs)} <small>${hEscaped ? 'escapaste' : 'te aplastó'}</small>`
      : 'sin reacción <small>te aplastó</small>';
    dom.hudF.innerHTML = flyMs !== null
      ? `${fmtMs(flyMs)} <small>${fEscaped ? 'escapó' : 'no alcanzó'}</small>`
      : 'sin reacción <small>no alcanzó</small>';

    dom.prompt.innerHTML = verdict(winner, humanMs, flyMs, ttc);
    return { winner, human: humanMs, fly: flyMs, falseStart: false, ttc };
  }

  function raceWait(ms) {
    return new Promise((resolve) => {
      let settled = false;
      // Durante la espera la red sigue corriendo: así se ve que en reposo la
      // neurona gigante no dispara sola, por más que el ruido la sacuda.
      const idle = setInterval(() => {
        I.fill(0);
        for (let k = 0; k < 8; k++) net.step(DT, I);
        view.draw(net.trace, { hot: false });
        dom.brainStats.textContent = `${net.n} neuronas · en reposo · DNp01 en silencio`;
      }, 16);
      const finish = (early) => {
        if (settled) return;
        settled = true;
        clearTimeout(id); clearInterval(idle); detach();
        resolve(early);
      };
      const detach = attachInput(() => finish(true));
      const id = setTimeout(() => finish(false), ms);
    });
  }
}

function attachInput(cb) {
  const onKey = (e) => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); cb(); } };
  const onTap = (e) => { e.preventDefault(); cb(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onTap);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', onTap);
  };
}

function verdict(winner, h, f, ttc) {
  if (winner === 'fly' && h === null) return 'No alcanzaste a reaccionar. La sombra tardó <strong>' + Math.round(ttc) + ' ms</strong> en llegar.';
  if (winner === 'fly') return `La mosca saltó <strong>${Math.round(h - f)} ms</strong> antes que tú.`;
  if (winner === 'human') return `Le ganaste por <strong>${Math.round(f - h)} ms</strong>. Eso casi no pasa.`;
  return 'Empate técnico.';
}

// ─── Dibujo ───────────────────────────────────────────────────────

function drawHuman(cv, radius, reacted, ttc, shown) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1b2030');
  sky.addColorStop(1, '#0a0c12');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);

  const scale = W / GRID_W;
  const cx = W / 2, cy = H / 2;
  const r = radius * scale;

  const halo = g.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.5);
  halo.addColorStop(0, 'rgba(0,0,0,0.9)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(cx, cy, r * 1.5, 0, 6.2832); g.fill();

  g.fillStyle = '#05060a';
  g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fill();
  g.strokeStyle = 'rgba(255,154,60,0.35)'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.stroke();

  bar(g, W, H, shown / ttc, reacted !== null ? reacted / ttc : null, '#ff9a3c');
}

function drawFly(cv, lum, reacted, ttc, shown) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.fillStyle = '#06070b'; g.fillRect(0, 0, W, H);
  const bw = W / GRID_W, bh = (H - 14) / GRID_H;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const v = lum[y * GRID_W + x];
      const c = Math.round(6 + v * 74);
      g.fillStyle = `rgb(${Math.round(c * 0.3)},${Math.round(c * 0.92)},${Math.round(c * 0.85)})`;
      g.fillRect(x * bw + 1.5, y * bh + 1.5, bw - 3, bh - 3);
    }
  }
  bar(g, W, H, shown / ttc, reacted !== null ? reacted / ttc : null, '#3fe0c5');
}

function bar(g, W, H, progress, mark, color) {
  const y = H - 8;
  g.fillStyle = '#1c202b'; g.fillRect(0, y, W, 8);
  g.fillStyle = color; g.globalAlpha = 0.45;
  g.fillRect(0, y, W * Math.min(1, progress), 8);
  g.globalAlpha = 1;
  if (mark !== null) {
    g.fillStyle = '#fff';
    g.fillRect(W * Math.min(1, mark) - 1.5, y - 3, 3, 14);
  }
}
