/**
 * RONDA DESCARTADA — El rastro de olor.  ⚠ NO ESTÁ CONECTADA A LA PÁGINA.
 *
 * Se midió y no pasó la prueba. El circuito olfativo hace lo que debe: avanza
 * contra el viento mientras huele y barre de lado al perder el rastro, con las
 * dos conductas saliendo de la competencia entre poblaciones. Pero como
 * navegador es inútil: su tasa de éxito resultó IDÉNTICA a la de un control que
 * simplemente va en línea recta contra el viento sin oler nada (100% vs 100%,
 * 18% vs 18%, 25% vs 23% en distintas configuraciones). El barrido, de unas
 * 0.05 unidades de amplitud, nunca alcanza a recuperar un penacho del que ya
 * salió, y ensancharlo modulando la adaptación del oscilador sólo lo llevó de
 * 0.035 a 0.053.
 *
 * O sea: estaba ganando por la razón equivocada. Publicarla como demostración
 * de rastreo olfativo habría sido exactamente el tipo de cosa que esta página
 * critica en las demos virales, así que salió.
 *
 * Para que sirva haría falta otro mecanismo de navegación — dirección referida
 * al viento con estimación de la línea central del penacho, o una arena mucho
 * más grande y lenta. Eso es otro proyecto, no un ajuste de parámetros.
 *
 * Se conserva el código porque el circuito y el banco de pruebas headless son
 * el punto de partida de ese trabajo.
 *
 * El viento sopla hacia ti. En algún punto contra el viento hay comida. No ves
 * el penacho de olor: sólo recibes bocanadas sueltas, y entre una y otra puede
 * no haber nada. Esa es la situación real de una mosca buscando fruta podrida.
 *
 * La mosca no lleva programado ningún algoritmo de búsqueda. Corre contra el
 * viento mientras huele algo, y cuando lo pierde se pone a barrer de lado. Las
 * dos conductas salen de la misma red: el avance del DNsurge, el barrido del
 * oscilador CL/CR, y el arbitraje de la traza de contacto.
 */
import { buildPlumeCircuit, plumeStep } from '../circuits.js';
import { BrainView, PLUME_SPEC } from '../brainview.js';
import { steering, seeded, sleep } from '../ui.js';

const DT = 0.5;
const SPEED = 0.26;        // unidades de arena por segundo
const TURN = 4.2;          // rad/s
const CAST_ANGLE = Math.PI / 2;  // Exactamente perpendicular al viento. Con
                           // cualquier componente hacia adelante, el barrido
                           // acaba clavando a la mosca contra el borde de
                           // arriba, sobrepasando la fuente sin poder volver.
const CATCH = 0.070;
const TIME_CAP = 32000;    // ms
const GRACE = 8000;        // margen para el rezagado una vez que el otro llegó

/** Mundo compartido: el mismo penacho para los dos competidores. */
export function createWorld(seed, tune = {}) {
  const rng = seeded(seed);
  const w = {
    meanderAmp: tune.meanderAmp ?? 0.010,
    meanderRate: tune.meanderRate ?? 0.30,
    startOff: tune.startOff ?? 0.18,
    emitEvery: tune.emitEvery ?? 38,
    diffusion: tune.diffusion ?? 0.034,
    rng,
    src: { x: 0.20 + rng() * 0.6, y: 0.15 },
    packets: [],
    emitAcc: 0,
    meander: rng() * 6.28,
    t: 0,
  };
  // El penacho tarda unos segundos en recorrer la arena. Si empezáramos con la
  // arena vacía, la mosca alcanzaría la fuente antes de que llegara el olor y
  // la ronda no probaría nada. Lo dejamos ya establecido.
  for (let t = 0; t < 9000; t += 16.7) stepWorld(w, 16.7);
  w.t = 0;
  // Los dos arrancan en el mismo punto, cerca del rastro pero no encima. La
  // ronda es sobre SEGUIR un rastro intermitente, que es lo que el circuito
  // resuelve; encontrar un penacho perdido en campo abierto es otro problema,
  // y uno que las moscas reales tampoco resuelven bien.
  // El desvío tiene que ser mayor que el radio de captura: si arrancaran casi
  // alineados con la fuente, ir recto contra el viento resolvería la ronda sin
  // rastrear nada. Con este desvío hay que encontrar el penacho y seguirlo.
  const side = rng() < 0.5 ? -1 : 1;
  const off = side * w.startOff * (0.6 + rng() * 0.8);
  w.start = { x: Math.min(0.92, Math.max(0.08, w.src.x + off)), y: 0.90 };
  return w;
}

export function stepWorld(w, dtMs) {
  const dt = dtMs / 1000;
  w.t += dtMs;
  w.meander += dt * (w.meanderRate ?? 0.30);
  w.emitAcc += dtMs;
  while (w.emitAcc > (w.emitEvery ?? 38)) {
    w.emitAcc -= (w.emitEvery ?? 38);
    w.packets.push({
      x: w.src.x + (w.rng() - 0.5) * 0.015,
      y: w.src.y,
      r: 0.020,
      vx: Math.sin(w.meander) * (w.meanderAmp ?? 0.010) + (w.rng() - 0.5) * 0.030,
    });
  }
  for (const p of w.packets) {
    p.y += 0.16 * dt;                 // arrastre del viento
    p.x += p.vx * dt;
    p.r += (w.diffusion ?? 0.034) * dt;   // difusión
  }
  if (w.packets.length > 260) w.packets.splice(0, w.packets.length - 260);
  for (let i = w.packets.length - 1; i >= 0; i--) if (w.packets[i].y > 1.15) w.packets.splice(i, 1);
}

/** Concentración de olor en un punto, 0..1. */
export function odorAt(w, x, y) {
  let best = 0;
  for (const p of w.packets) {
    const dx = x - p.x, dy = y - p.y;
    const d2 = dx * dx + dy * dy;
    const s2 = p.r * p.r;
    if (d2 > s2 * 9) continue;
    const v = Math.exp(-d2 / (2 * s2));
    if (v > best) best = v;
  }
  return Math.min(1, best);
}

export function createAgent(w) {
  return { x: w.start.x, y: w.start.y, heading: 0, trail: [], hits: 0, done: null };
}

/** Avanza un agente con un rumbo dado (rumbo 0 = contra el viento). */
export function moveAgent(a, w, dtMs) {
  const dt = dtMs / 1000;
  a.x += Math.sin(a.heading) * SPEED * dt;
  a.y -= Math.cos(a.heading) * SPEED * dt;
  a.x = Math.min(0.97, Math.max(0.03, a.x));
  a.y = Math.min(0.97, Math.max(0.03, a.y));
  if (a.trail.length === 0 || Math.hypot(a.x - a.trail.at(-1)[0], a.y - a.trail.at(-1)[1]) > 0.006) {
    a.trail.push([a.x, a.y]);
    if (a.trail.length > 900) a.trail.shift();
  }
  return Math.hypot(a.x - w.src.x, a.y - w.src.y) < CATCH;
}

/**
 * Traduce la actividad del circuito en un rumbo. Aquí no hay ninguna regla de
 * búsqueda: sólo se lee quién está disparando.
 *
 * Se acumulan los disparos de todo el fotograma, no los del último paso de
 * 0.5 ms — un solo paso es ruido, no una tasa.
 *
 * @param {{cl:number, cr:number, trace:number}} act actividad acumulada
 */
export function flyControl(a, act, dtMs) {
  const surging = act.trace > 0.10;
  let target;
  if (surging) {
    target = 0;                                     // contra el viento
  } else {
    const side = act.cl > act.cr ? -1 : act.cr > act.cl ? 1 : (a.castSide ?? 1);
    a.castSide = side;
    target = side * CAST_ANGLE;
  }
  const diff = Math.atan2(Math.sin(target - a.heading), Math.cos(target - a.heading));
  const max = TURN * dtMs / 1000;
  a.heading += Math.max(-max, Math.min(max, diff));
  return surging;
}

/** Acumula los disparos de una población durante varios pasos. */
export function tally(pl, fired, acc) {
  const P = pl.layout.pops;
  for (const i of fired) {
    if (i >= P.CL.start && i < P.CL.end) acc.cl++;
    else if (i >= P.CR.start && i < P.CR.end) acc.cr++;
    else if (i >= P.DNsurge.start && i < P.DNsurge.end) acc.surge++;
  }
  return acc;
}

// ───────────────────────────────────────────────────────────────────────────

export async function runPlume(dom) {
  const pl = buildPlumeCircuit();
  const view = new BrainView(dom.cvBrain, pl.layout, PLUME_SPEC);
  const seed = (Math.random() * 1e9) | 0;
  const world = createWorld(seed);
  const human = createAgent(world), fly = createAgent(world);
  const steer = steering(dom.cvH);

  dom.tagH.textContent = '← → o arrastra';
  dom.tagF.textContent = 'DNsurge vs. oscilador CL/CR';
  dom.prompt.innerHTML = 'El viento sopla <strong>hacia ti</strong>. La comida está contra el viento. No verás el olor: sólo lo hueles cuando lo cruzas.';

  const t0 = performance.now();
  let last = t0, simAcc = 0, deadline = TIME_CAP;

  await new Promise((resolve) => {
    const frame = (now) => {
      const elapsed = now - t0;
      const dtMs = Math.min(50, now - last);
      last = now;

      stepWorld(world, dtMs);

      // ── Humano
      if (human.done === null) {
        human.heading += Math.max(-1, Math.min(1, steer.value())) * TURN * 0.55 * dtMs / 1000;
        if (moveAgent(human, world, dtMs)) human.done = elapsed;
      }
      const hOdor = odorAt(world, human.x, human.y);
      if (hOdor > 0.25) human.hits++;

      // ── Mosca: el olor entra al circuito, el circuito decide el rumbo.
      if (fly.done === null) {
        const conc = odorAt(world, fly.x, fly.y);
        simAcc += dtMs;
        let steps = 0;
        const acc = { cl: 0, cr: 0, surge: 0 };
        while (simAcc > DT && steps < 120) { tally(pl, plumeStep(pl, DT, conc), acc); simAcc -= DT; steps++; }
        flyControl(fly, { ...acc, trace: pl.trace }, dtMs);
        if (conc > 0.25) fly.hits++;
        if (moveAgent(fly, world, dtMs)) fly.done = elapsed;
      }

      drawArena(dom.cvH, world, human, hOdor, '#ff9a3c', human.done !== null);
      drawArena(dom.cvF, world, fly, odorAt(world, fly.x, fly.y), '#3fe0c5', fly.done !== null);
      view.draw(pl.net.trace, { hot: pl.trace > 0.2 });
      dom.brainStats.textContent =
        `${pl.net.n} neuronas · traza de contacto ${pl.trace.toFixed(2)} · ${pl.trace > 0.12 ? 'AVANZA contra el viento' : 'barre de lado'}`;

      const secs = (x) => x === null ? `${(elapsed / 1000).toFixed(1)} <small>s buscando</small>` : `${(x / 1000).toFixed(1)} <small>s</small>`;
      dom.hudH.innerHTML = secs(human.done);
      dom.hudF.innerHTML = secs(fly.done);

      // En cuanto uno llega, el otro tiene un margen y se acaba: esperar el tope
      // completo con un solo competidor en pista no aporta nada.
      const first = [human.done, fly.done].filter((x) => x !== null).sort((a, b) => a - b)[0];
      if (first !== undefined) deadline = Math.min(TIME_CAP, first + GRACE);
      if ((human.done !== null && fly.done !== null) || elapsed > deadline) { resolve(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  steer.detach();
  const winner = human.done !== null && (fly.done === null || human.done < fly.done) ? 'human'
    : fly.done !== null ? 'fly' : 'draw';
  dom.prompt.innerHTML = winner === 'fly'
    ? 'Mira los dos rastros: el de la mosca es un zigzag regular contra el viento. Eso no está programado — es el oscilador encendiéndose cada vez que pierde el olor.'
    : winner === 'human'
      ? 'Le ganaste. Fíjate igual en la diferencia entre los dos rastros.'
      : 'Ninguno encontró la comida a tiempo.';
  await sleep(600);

  return { winner, human: human.done, fly: fly.done, hitsH: human.hits, hitsF: fly.hits };
}

function drawArena(cv, w, a, odor, color, done) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.fillStyle = '#06070b'; g.fillRect(0, 0, W, H);

  // viento
  g.strokeStyle = '#141824'; g.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const x = (i + 0.5) * W / 12;
    const off = (w.t * 0.05 + i * 17) % 40;
    g.beginPath(); g.moveTo(x, off); g.lineTo(x, off + 14); g.stroke();
  }

  // rastro
  if (a.trail.length > 1) {
    g.strokeStyle = color; g.globalAlpha = 0.55; g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(a.trail[0][0] * W, a.trail[0][1] * H);
    for (const [x, y] of a.trail) g.lineTo(x * W, y * H);
    g.stroke(); g.globalAlpha = 1;
  }

  // fuente, sólo al encontrarla
  if (done) {
    g.fillStyle = '#ffd166';
    g.beginPath(); g.arc(w.src.x * W, w.src.y * H, 9, 0, 6.2832); g.fill();
  }

  // agente, con halo cuando está dentro del olor
  const ax = a.x * W, ay = a.y * H;
  if (odor > 0.15) {
    g.fillStyle = color; g.globalAlpha = 0.14 + odor * 0.3;
    g.beginPath(); g.arc(ax, ay, 10 + odor * 26, 0, 6.2832); g.fill();
    g.globalAlpha = 1;
  }
  g.save();
  g.translate(ax, ay); g.rotate(a.heading);
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, -7); g.lineTo(4.5, 6); g.lineTo(-4.5, 6); g.closePath(); g.fill();
  g.restore();

  g.fillStyle = color;
  g.font = '600 11px ui-monospace, monospace';
  g.fillText(odor > 0.25 ? 'OLOR' : '', 12, 20);
}
