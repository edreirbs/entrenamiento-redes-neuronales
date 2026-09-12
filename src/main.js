/**
 * Mátala si puedes.
 *
 * Un solo bucle: intentas aplastar una mosca cuyo cerebro está simulado
 * neurona por neurona, y cada intento tuyo la hace más difícil de matar.
 * Estás entrenando a tu propia enemiga.
 *
 * El motor (lif.js) y el circuito de escape (circuits.js) son los mismos que
 * se calibraron midiendo. Aquí se orquesta, se dibuja y se le deja aprender.
 */
import {
  buildEscapeCircuit, retinaDrive, loomingFrame, GRID_W, GRID_H,
} from './circuits.js?v=5';
import { Arena, HOVER_Y, PAD_HALF, BOUNDS } from './scene3d.js?v=5';
import * as Aprende from './learning.js?v=5';

const $ = (id) => document.getElementById(id);

const P = GRID_W * GRID_H;
const DT = 0.5;
// Omatidios por unidad de tangente: cuánto campo visual cubre cada uno.
// Calibrado midiendo, para que una mosca sin experiencia sea matable y una
// entrenada no lo sea.
const FOCAL = 1.83;
const SWAT_MS = 270;             // lo que tarda el matamoscas en llegar a la mesa
const LIFT_MS = 340;             // y lo que tarda en volver a subir
const MOTOR_DELAY = 5;           // DNp01 → músculo

const escape = buildEscapeCircuit();
const arena = new Arena($('stage'), escape.layout);
const fly = arena.fly;
fly.bounds = BOUNDS;
fly.place(0.4, 0.2);

let mem = Aprende.load();
let aim = { x: 0, z: 0 };
// Habituación de corto plazo. No se guarda: es el contragolpe del jugador y se
// disipa sola en unos segundos.
let fatiga = 0;
let swing = null;                 // estado del golpe en curso
let playing = false;
let fallos = 0;                   // fallos seguidos, para soltar la pista a tiempo

// ─── Bucle ────────────────────────────────────────────────────────────
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (fatiga > 0.001) {
    fatiga *= Math.exp(-(dt * 1000) / Aprende.FATIGA_TAU);
    pintaFatiga();
  }

  if (swing) stepSwing(now);
  else arena.swatter.position.set(aim.x, HOVER_Y + Math.sin(now / 700) * 0.03, aim.z);
  arena.reticle.position.set(aim.x, 0.008, aim.z);

  fly.paintBrain(escape.net.trace);
  arena.render(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ─── El golpe ─────────────────────────────────────────────────────────
function slam() {
  if (!playing || swing) return;
  fatiga = Math.min(1, fatiga + Aprende.FATIGA_POR_GOLPE);
  escape.setGain(Aprende.gananciaCon(mem, fatiga));
  pintaFatiga();
  const lum = new Float32Array(P), prev = new Float32Array(P);
  const I = new Float32Array(escape.net.n);
  escape.net.reset();

  swing = {
    t0: performance.now(), simT: 0, x: aim.x, z: aim.z,
    reaction: null, clears: false, resolved: false,
    lum, prev, I,
    despegue: Aprende.despegueCon(mem, fatiga),
    flyAt: { x: fly.group.position.x, z: fly.group.position.z },
  };
  // Primer fotograma de referencia, con el matamoscas todavía arriba.
  proyecta(prev, HOVER_Y, swing.x, swing.z);
  $('hint').textContent = '';
}

/**
 * Proyecta el matamoscas sobre el campo visual de la mosca.
 * Es una cámara estenopeica: el radio depende de la altura, y el centro se
 * desplaza si el golpe no viene justo de arriba. Por eso apuntar de lado no
 * se percibe igual.
 */
function proyecta(out, padY, padX, padZ) {
  const fx = fly.group.position.x, fz = fly.group.position.z;
  const h = Math.max(0.05, padY - fly.group.position.y);
  const r = FOCAL * PAD_HALF / h;
  const cx = GRID_W / 2 + FOCAL * (padX - fx) / h;
  const cy = GRID_H / 2 + FOCAL * (padZ - fz) / h;
  return loomingFrame(out, cx, cy, r);
}

function stepSwing(now) {
  const s = swing;
  const el = now - s.t0;

  if (el <= SWAT_MS) {
    const u = el / SWAT_MS;
    const padY = HOVER_Y * (1 - u) + 0.05 * u;
    arena.swatter.position.set(s.x, padY, s.z);

    // La simulación avanza al mismo reloj que el golpe.
    const gf = escape.layout.pops.DNp01, mn = escape.layout.pops.MN;
    let steps = 0;
    while (s.simT < el && s.simT < SWAT_MS && steps < 2400) {
      s.simT += DT;
      const uy = s.simT / SWAT_MS;
      proyecta(s.lum, HOVER_Y * (1 - uy) + 0.05 * uy, s.x, s.z);
      s.I.fill(0);
      retinaDrive(s.lum, s.prev, DT, s.I.subarray(0, P));
      const fired = escape.net.step(DT, s.I);
      s.prev.set(s.lum);
      for (const i of fired) {
        if (i >= gf.start && i < gf.end) fly.fire();
        if (s.reaction === null && i >= mn.start && i < mn.end) onReaction(s.simT + MOTOR_DELAY);
      }
      steps++;
    }
    return;
  }

  if (!s.resolved) { s.resolved = true; resolve(); }

  // El matamoscas vuelve a subir.
  const v = Math.min(1, (el - SWAT_MS) / LIFT_MS);
  arena.swatter.position.set(s.x, 0.05 + (HOVER_Y - 0.05) * v, s.z);
  if (v >= 1) swing = null;
}

function onReaction(ms) {
  const s = swing;
  s.reaction = ms;
  // ¿Le alcanza el tiempo para despejar la zona antes de que llegue el golpe?
  s.clears = ms + s.despegue <= SWAT_MS;
  if (!s.clears) return;               // reaccionó, pero tarde para despegar

  const dx = fly.group.position.x - s.x;
  const dz = fly.group.position.z - s.z;
  const [bx, bz] = Aprende.sesgo(mem);
  const m = Math.hypot(dx, dz) || 1;
  fly.escape(dx / m + bx, dz / m + bz, BOUNDS);
}

function resolve() {
  const s = swing;
  const escapo = s.clears;
  const dist = Math.hypot(fly.group.position.x - s.x, fly.group.position.z - s.z);
  const cerca = !escapo && dist < PAD_HALF * 0.92;
  const muere = cerca;

  arena.impact(s.x, s.z);
  Aprende.apuntar(mem, s.x - s.flyAt.x, s.z - s.flyAt.z);
  Aprende.aprender(mem, {
    reacciono: s.reaction !== null, cerca: cerca || escapo, muere,
    reaccion: s.reaction, despegue: s.despegue,
  });
  mem.swats += 1;

  if (muere) {
    fallos = 0;
    fly.splat();
    mem.kills += 1;
    mem.gen += 1;
    mem.racha = (mem.racha || 0) + 1;
    if (mem.racha > (mem.best || 0)) mem.best = mem.racha;
    flash('¡ZAS!', 'hit');
    $('hint').innerHTML = s.reaction === null
      ? 'No alcanzó a reaccionar.'
      : `Reaccionó en <b>${Math.round(s.reaction)} ms</b>, pero necesitaba <b>${Math.round(s.despegue)} ms</b> más para despegar.`;
    setTimeout(nuevaMosca, 1150);
  } else {
    mem.racha = 0;
    fallos += 1;
    if (fallos === 3 || fallos % 6 === 0) {
      $('hint').innerHTML = 'Truco: <b>golpes seguidos la agotan</b>. Su vía de escape se habitúa y vuelve al despegue lento.';
    }
    if (!escapo) {
      flash('ni cerca', 'miss');
      $('hint').innerHTML = 'Le pegaste lejos. La mira te dice dónde va a caer.';
    } else {
      flash('se escapó', 'miss');
      $('hint').innerHTML = `Reaccionó en <b>${Math.round(s.reaction)} ms</b> y despejó en <b>${Math.round(s.despegue)} ms</b>. Le sobraron <b>${Math.round(SWAT_MS - s.reaction - s.despegue)} ms</b>.`;
    }
  }

  aplicaAprendizaje();
  Aprende.save(mem);
  pintaHud(s.reaction);
  pintaPanel();
}

function nuevaMosca() {
  let x, z;
  do {
    x = (Math.random() - 0.5) * BOUNDS.x * 1.7;
    z = (Math.random() - 0.5) * BOUNDS.z * 1.5;
  } while (Math.hypot(x - aim.x, z - aim.z) < 0.8);
  fly.place(x, z);
  $('hint').innerHTML = `Generación <b>${mem.gen}</b>. Lo que le hiciste a la anterior, esta ya lo trae.`;
}

function aplicaAprendizaje() { escape.setGain(Aprende.gananciaCon(mem, fatiga)); }

function pintaFatiga() {
  $('fat').style.width = `${Math.round(fatiga * 100)}%`;
  $('fatlab').textContent =
    fatiga < 0.08 ? 'descansada'
      : fatiga < 0.35 ? 'algo agotada'
        : fatiga < 0.7 ? 'se le está agotando el escape'
          : 'agotada: ahora sí';
}

function pintaHud(reaction) {
  $('kills').textContent = mem.kills;
  $('rate').textContent = `${mem.kills} de ${mem.swats} ${mem.swats === 1 ? 'intento' : 'intentos'}`;
  $('gen').textContent = mem.gen;
  if (reaction != null) $('react').textContent = `${Math.round(reaction)} ms`;
  const p = Aprende.progreso(mem);
  $('learn').style.width = `${Math.round(p * 100)}%`;
  $('learnlab').textContent =
    p < 0.04 ? 'sin experiencia'
      : p < 0.12 ? 'empieza a espabilarse'
        : p < 0.21 ? 'ya casi no la alcanzas'
          : p < 0.36 ? 'reacciona antes y despega en corto'
            : 'prácticamente intocable';
}

// ─── Gráfica de aprendizaje ───────────────────────────────────────────
// Cada barra es un intento: abajo lo que tardó en reaccionar, encima lo que
// tardó en despegar. La línea roja es el momento en que llega el matamoscas.
// Cuando la barra completa baja de esa línea, deja de ser matable.
function drawChart() {
  const cv = $('chart');
  const g = cv.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);

  const MAX = 380;
  const TOP = 14;               // espacio para la etiqueta de la línea
  const y = (ms) => H - 14 - (ms / MAX) * (H - 14 - TOP);
  const hist = mem.hist || [];
  const n = Math.max(14, hist.length);
  const bw = W / n;

  // Línea del golpe: lo que hay que bajar para sobrevivir.
  g.fillStyle = 'rgba(255,90,77,.72)';
  g.font = '9px ui-monospace, monospace';
  g.textAlign = 'right';
  g.fillText(`${SWAT_MS} ms · llega el golpe`, W, 9);
  g.textAlign = 'left';
  g.strokeStyle = 'rgba(255,90,77,.75)';
  g.setLineDash([4, 3]); g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, y(SWAT_MS)); g.lineTo(W, y(SWAT_MS)); g.stroke();
  g.setLineDash([]);

  if (!hist.length) {
    g.fillStyle = '#4a5164';
    g.font = '11px system-ui, sans-serif';
    g.fillText('Pégale una vez para empezar a medirla.', 4, H / 2);
    return;
  }

  // Barras apiladas.
  hist.forEach((h, i) => {
    const x = i * bw, w = Math.max(1.5, bw - 1.6);
    if (h.r === null) {
      g.fillStyle = 'rgba(255,90,77,.30)';
      g.fillRect(x, y(SWAT_MS), w, H - 14 - y(SWAT_MS));
      return;
    }
    const total = h.r + h.d;
    g.fillStyle = '#2fe0c0';
    g.fillRect(x, y(h.r), w, H - 14 - y(h.r));
    g.fillStyle = total > SWAT_MS ? '#ff5a4d' : '#d9a441';
    g.fillRect(x, y(total), w, y(h.r) - y(total));
  });

  // Tendencia del total.
  g.strokeStyle = 'rgba(238,240,246,.5)'; g.lineWidth = 1.4;
  g.beginPath();
  let started = false;
  hist.forEach((h, i) => {
    if (h.r === null) return;
    const px = i * bw + Math.max(1.5, bw - 1.6) / 2;
    const py = y(h.r + h.d);
    started ? g.lineTo(px, py) : (g.moveTo(px, py), started = true);
  });
  if (started) g.stroke();

  // Tira de resultados.
  hist.forEach((h, i) => {
    g.fillStyle = h.o === 'k' ? '#ff5a4d' : h.o === 'e' ? '#2fe0c0' : '#39405a';
    g.fillRect(i * bw, H - 8, Math.max(1.5, bw - 1.6), 4);
  });
}

function pintaPanel() {
  drawChart();
  const hist = (mem.hist || []).filter((h) => h.r !== null);
  const set = (id, txt, delta, mejor) => {
    $(id).textContent = txt;
    const e = $(delta);
    if (!e) return;
    e.textContent = mejor === null ? '' : mejor === 0 ? 'igual que al inicio'
      : `${mejor > 0 ? '−' : '+'}${Math.abs(Math.round(mejor))} ms desde el inicio`;
    e.className = mejor > 0 ? 'good' : '';
  };
  if (!hist.length) {
    set('sReact', '—', 'dReact', null);
    set('sTake', '—', 'dTake', null);
    $('sMargin').textContent = '—';
    return;
  }
  const a = hist[0], z = hist[hist.length - 1];
  set('sReact', `${Math.round(z.r)} ms`, 'dReact', a.r - z.r);
  set('sTake', `${Math.round(z.d)} ms`, 'dTake', a.d - z.d);
  const m = Math.round(SWAT_MS - z.r - z.d);
  $('sMargin').textContent = `${m > 0 ? '+' : ''}${m} ms`;
  $('sMargin').style.color = m > 0 ? 'var(--fly)' : 'var(--hot)';
}

function flash(text, kind) {
  const el = $('flash');
  el.textContent = text;
  el.className = 'flash';
  void el.offsetWidth;                    // reinicia la animación
  el.classList.add('on', kind);
}

// ─── Entrada ──────────────────────────────────────────────────────────
const cv = $('stage');
const move = (e) => { const p = arena.pointTo(e.clientX, e.clientY); if (p) aim = p; };
cv.addEventListener('pointermove', move);
cv.addEventListener('pointerdown', (e) => { move(e); slam(); });
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); slam(); } });

// ─── Portada ──────────────────────────────────────────────────────────
function intro() {
  const veterana = mem.swats > 0;
  $('panel').innerHTML = `<span class="bug">🪰</span>
    <h1>Mátala<br>si puedes</h1>
    <p>Su cerebro está simulado neurona por neurona. Cada vez que le tiras, aprende.</p>
    <p class="small">${veterana
      ? `Llevas ${mem.swats} intentos y ${mem.kills} ${mem.kills === 1 ? 'aplastada' : 'aplastadas'}${mem.best > 1 ? `, con una racha de ${mem.best}` : ''}. Esta generación ya te conoce.`
      : 'Apunta con el ratón y pégale. Va a ser fácil las primeras veces.'}</p>
    <button class="btn" id="go">${veterana ? 'Seguir' : 'Empezar'}</button>`;
  $('go').onclick = () => {
    $('veil').classList.add('hide');
    playing = true;
    $('hint').innerHTML = 'Apunta y pégale.';
  };
}

const reiniciar = () => {
  mem = Aprende.reset();
  aplicaAprendizaje();
  $('react').textContent = '—';
  fatiga = 0; fallos = 0;
  pintaHud(null);
  pintaFatiga();
  pintaPanel();
  nuevaMosca();
  $('hint').innerHTML = 'Mosca nueva, sin nada aprendido. Generación 1.';
};

let armado = 0;
$('reset').onclick = () => {
  const b = $('reset');
  if (armado) { clearTimeout(armado); armado = 0; b.classList.remove('armed'); b.textContent = 'reiniciar'; reiniciar(); return; }
  b.classList.add('armed'); b.textContent = '¿seguro?';
  armado = setTimeout(() => { armado = 0; b.classList.remove('armed'); b.textContent = 'reiniciar'; }, 3200);
};

addEventListener('resize', pintaPanel);

$('info').onclick = () => $('about').showModal();
$('closeAbout').onclick = () => $('about').close();
$('forget').onclick = () => { reiniciar(); $('about').close(); };

aplicaAprendizaje();
pintaHud(null);
pintaFatiga();
pintaPanel();
intro();

window.__dbg = { arena, escape, fly, mem: () => mem, slam, fatiga: () => fatiga };
