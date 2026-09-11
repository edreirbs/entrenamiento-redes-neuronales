/**
 * Circuitos de Drosophila usados en la arena.
 *
 * Ninguno es decorativo: cada capa corresponde a una población real descrita en
 * la literatura del conectoma, con su conectividad y su signo. Lo que NO es real
 * son los parámetros de la dinámica (umbral, fuga, ganancia): el conectoma es
 * anatomía estática y no dice la fuerza de cada sinapsis, así que eso lo
 * ajustamos nosotros. La interfaz lo dice explícitamente.
 */
import { buildCSR, LIFNet } from './lif.js';

/** Ayuda para ir apilando poblaciones y quedarnos con sus rangos de índices. */
class Layout {
  constructor() { this.n = 0; this.pops = {}; }
  add(name, size, params = {}) {
    const pop = { name, size, start: this.n, end: this.n + size, ...params };
    this.pops[name] = pop;
    this.n += size;
    return pop;
  }
  /** Índice global de la unidad i de la población name. */
  idx(name, i) { return this.pops[name].start + i; }
  /** Aplica tau/vth/refrac por población sobre los arreglos globales. */
  materialize(rng = Math.random) {
    const tau = new Float32Array(this.n);
    const vth = new Float32Array(this.n);
    const refrac = new Float32Array(this.n);
    for (const p of Object.values(this.pops)) {
      const j = p.jitter ?? 0;
      for (let i = p.start; i < p.end; i++) {
        const k = 1 + j * (rng() * 2 - 1);
        tau[i] = (p.tau ?? 20);
        vth[i] = (p.vth ?? 1) * (1 + 0.25 * j * (rng() * 2 - 1));
        refrac[i] = (p.refrac ?? 2.2) * k;
      }
    }
    return { tau, vth, refrac };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 1. CIRCUITO DE ESCAPE  (ronda del matamoscas)
//
//   fotorreceptores R  →  lámina L (respuesta OFF)  →  T5 (detectores de
//   movimiento direccionales, tipo Reichardt)  →  LPLC2 (selectivas a
//   expansión) y LC4 (velocidad angular)  →  DNp01, la NEURONA GIGANTE
//   →  motoneuronas del salto.
//
//   La neurona gigante es la vía de escape más corta que se conoce en la
//   mosca: cinco sinapsis entre el fotón y el músculo.
// ───────────────────────────────────────────────────────────────────────────

export const GRID_W = 16;
export const GRID_H = 12;

/** Las cuatro direcciones preferidas de las T5. */
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function buildEscapeCircuit() {
  const P = GRID_W * GRID_H;
  const L = new Layout();

  L.add('R',     P,     { tau: 10, vth: 1.00, refrac: 1.6 });
  L.add('LMC',   P,     { tau: 12, vth: 0.90, refrac: 1.6 });
  L.add('LMCs',  P,     { tau: 55, vth: 0.75, refrac: 2.0 });  // copia lenta: la línea de retardo
  L.add('T5',    P * 4, { tau: 10, vth: 1.00, refrac: 2.2 });
  L.add('LPLC2', 24,    { tau: 15, vth: 1.00, refrac: 3.0 });
  L.add('LC4',   24,    { tau: 15, vth: 1.00, refrac: 3.0 });
  L.add('DNp01', 2,     { tau: 9,  vth: 1.00, refrac: 25 });   // neurona gigante
  L.add('DNp02', 4,     { tau: 12, vth: 1.00, refrac: 6 });
  L.add('MN',    10,    { tau: 8,  vth: 1.00, refrac: 6 });

  const e = [];
  const at = (x, y) => y * GRID_W + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;

  // Retina → lámina, y lámina → su copia lenta.
  for (let p = 0; p < P; p++) {
    e.push([L.idx('R', p), L.idx('LMC', p), 1.10]);
    e.push([L.idx('LMC', p), L.idx('LMCs', p), 0.42]);
  }

  // Detector de movimiento: una T5 dispara sólo si coincide la señal actual en p
  // con la señal RETRASADA en el vecino del que vendría el movimiento. Ninguna
  // de las dos entradas basta por sí sola (0.62 < umbral 1.0), las dos juntas sí.
  for (let d = 0; d < 4; d++) {
    const [dx, dy] = DIRS[d];
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const p = at(x, y);
        const t5 = L.idx('T5', d * P + p);
        e.push([L.idx('LMC', p), t5, 0.62]);
        const sx = x - dx, sy = y - dy;
        if (inside(sx, sy)) e.push([L.idx('LMCs', at(sx, sy)), t5, 0.62]);
      }
    }
  }

  // LPLC2: cuatro cuadrantes dendríticos, cada uno prefiere movimiento hacia
  // AFUERA de su campo receptivo. Un objeto que se expande empuja los bordes
  // hacia afuera en todas direcciones a la vez, y por eso las enciende.
  // LC4: agrupa todas las direcciones, o sea responde a velocidad angular
  // sin importar el sentido.
  const RF_R = 3;
  const centers = [];
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 6; i++) {
      centers.push([(i + 0.5) * GRID_W / 6, (j + 0.5) * GRID_H / 4]);
    }
  }
  centers.forEach(([cx, cy], j) => {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const ox = x + 0.5 - cx, oy = y + 0.5 - cy;
        if (Math.hypot(ox, oy) > RF_R) continue;
        const p = at(x, y);
        for (let d = 0; d < 4; d++) {
          const [dx, dy] = DIRS[d];
          const t5 = L.idx('T5', d * P + p);
          // ¿esta dirección apunta hacia afuera desde el centro del campo?
          const outward = dx * ox + dy * oy;
          if (outward > 0.3) e.push([t5, L.idx('LPLC2', j), 0.085]);
          e.push([t5, L.idx('LC4', j), 0.030]);
        }
      }
    }
  });

  // Convergencia sobre la neurona gigante. Hace falta mucha entrada sincrónica
  // para cruzar su umbral: es lo que evita que la mosca salte con cada sombra.
  for (let j = 0; j < 24; j++) {
    for (let g = 0; g < 2; g++) {
      e.push([L.idx('LPLC2', j), L.idx('DNp01', g), 0.30]);
      e.push([L.idx('LC4', j), L.idx('DNp01', g), 0.12]);
    }
  }

  // Salida motora.
  for (let g = 0; g < 2; g++) {
    for (let i = 0; i < 4; i++) e.push([L.idx('DNp01', g), L.idx('DNp02', i), 1.40]);
    for (let i = 0; i < 10; i++) e.push([L.idx('DNp01', g), L.idx('MN', i), 1.40]);
  }
  for (let i = 0; i < 4; i++) {
    for (let m = 0; m < 10; m++) e.push([L.idx('DNp02', i), L.idx('MN', m), 0.55]);
  }

  const params = L.materialize();
  const net = new LIFNet(L.n, buildCSR(L.n, e), { ...params, noise: 0.003 });
  return { net, layout: L, nSyn: e.length };
}

/**
 * Convierte un fotograma de luminancia en corriente para los fotorreceptores.
 * Los fotorreceptores de la mosca son sobre todo detectores de CAMBIO, y la vía
 * de escape usa el canal OFF, así que inyectamos sólo el oscurecimiento.
 */
export function retinaDrive(lum, prevLum, dt, out, gain = 26) {
  for (let p = 0; p < lum.length; p++) {
    const darkening = (prevLum[p] - lum[p]) / dt;
    out[p] = darkening > 0 ? gain * darkening : 0;
  }
  return out;
}

/** Luminancia por omatidio de un disco oscuro de radio `r` centrado en (cx, cy). */
export function loomingFrame(out, cx, cy, r) {
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      // Borde suave de un omatidio de ancho: la óptica de la mosca es borrosa.
      out[y * GRID_W + x] = Math.min(1, Math.max(0, (d - r + 0.6) / 1.2));
    }
  }
  return out;
}

/**
 * Radio angular de un objeto que se acerca a velocidad constante.
 * `lOverV` es la razón mitad-de-tamaño/velocidad en ms, el parámetro clásico de
 * los estímulos de aproximación. `ttc` es el tiempo restante hasta el impacto.
 */
export function loomingRadius(ttc, lOverV, focal) {
  return focal * lOverV / Math.max(ttc, 1);
}

// ───────────────────────────────────────────────────────────────────────────
// 2. CIRCUITO OLFATIVO  (ronda del rastro de olor)
//
//   ORN (neuronas receptoras olfativas)  →  PN del lóbulo antenal  →
//   dos salidas que compiten:
//     · DNsurge  — mientras hay olor, corre contra el viento.
//     · CL / CR  — oscilador de medio centro (inhibición mutua + adaptación)
//       que genera el zigzag transversal cuando el olor se pierde.
//   La neurona H mantiene el recuerdo del último contacto unos cientos de
//   milisegundos e inhibe el zigzag: por eso la mosca sigue de frente un rato
//   después de perder el rastro antes de ponerse a barrer.
//
//   Esto es la estrategia real de "surge and cast" de Drosophila, y aquí no
//   está programada: emerge de la conectividad.
// ───────────────────────────────────────────────────────────────────────────

export const PLUME_DEFAULTS = {
  tonDrive: 0.55,     // impulso tónico que alimenta el oscilador
  mutual: -0.38,      // inhibición mutua entre los dos medios centros
  adaptGain: 0.012,   // qué tan rápido se cansa el lado que va ganando
  adaptInhib: -0.80,
  adaptStrength: 0.6, // qué tan completa es la adaptación del receptor
  tauTrace: 450,      // cuánto dura el recuerdo del último contacto (ms)
  searchSuppress: 0.0012, // cuánto se ensancha el barrido al llevar rato sin oler
  tauSearch: 5000,
  traceSurge: 0.22,   // el recuerdo mantiene el avance contra el viento
  traceInhib: 0.40,   // ...y mantiene apagado el zigzag
};

export function buildPlumeCircuit(opts = {}) {
  const O = { ...PLUME_DEFAULTS, ...opts };
  const L = new Layout();
  L.add('ORN',    40, { tau: 12, vth: 1.00, refrac: 2.0 });
  L.add('PN',     20, { tau: 14, vth: 1.00, refrac: 2.5 });
  L.add('DNsurge', 4, { tau: 18, vth: 1.00, refrac: 4.0 });
  L.add('H',       6, { tau: 45, vth: 1.00, refrac: 6, jitter: 0.3 });  // detector de contacto
  L.add('TON',     4, { tau: 15, vth: 1.00, refrac: 6 });     // impulso tónico del oscilador
  L.add('CL',      6, { tau: 16, vth: 1.00, refrac: 5 });
  L.add('CR',      6, { tau: 16, vth: 1.00, refrac: 5 });
  L.add('AL',      3, { tau: 300, vth: 1.00, refrac: 16 });   // adaptación lenta
  L.add('AR',      3, { tau: 300, vth: 1.00, refrac: 16 });

  const e = [];
  for (let i = 0; i < 40; i++) e.push([L.idx('ORN', i), L.idx('PN', i % 20), 0.55]);
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 4; j++) e.push([L.idx('PN', i), L.idx('DNsurge', j), 0.22]);
    for (let j = 0; j < 6; j++) e.push([L.idx('PN', i), L.idx('H', j), 0.075]);
  }
  // Oscilador de medio centro.
  for (let t = 0; t < 4; t++) {
    for (let i = 0; i < 6; i++) {
      e.push([L.idx('TON', t), L.idx('CL', i), O.tonDrive]);
      e.push([L.idx('TON', t), L.idx('CR', i), O.tonDrive]);
    }
  }
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      e.push([L.idx('CL', i), L.idx('CR', j), O.mutual]);
      e.push([L.idx('CR', i), L.idx('CL', j), O.mutual]);
    }
    for (let a = 0; a < 3; a++) {
      e.push([L.idx('CL', i), L.idx('AL', a), O.adaptGain]);
      e.push([L.idx('CR', i), L.idx('AR', a), O.adaptGain]);
    }
  }
  for (let a = 0; a < 3; a++) {
    for (let i = 0; i < 6; i++) {
      e.push([L.idx('AL', a), L.idx('CL', i), O.adaptInhib]);
      e.push([L.idx('AR', a), L.idx('CR', i), O.adaptInhib]);
    }
  }

  const params = L.materialize();
  const net = new LIFNet(L.n, buildCSR(L.n, e), { ...params, noise: 0.02 });
  return { net, layout: L, nSyn: e.length, opts: O, trace: 0, adapt: 0, search: 0 };
}

/**
 * Un paso del circuito olfativo.
 *
 * La persistencia del contacto NO se guarda en la red recurrente: una neurona
 * LIF se resetea al disparar, y un atractor recurrente afinado para durar medio
 * segundo resulta biestable — o se apaga en 15 ms o se queda encendido tres
 * segundos. Lo medimos y por eso no lo usamos. En su lugar modelamos lo que de
 * verdad sostiene la memoria corta dentro de una neurona: una traza
 * intracelular lenta, del tipo del calcio, que sube con cada contacto y decae
 * con su propia constante de tiempo.
 *
 * @param {number} odor concentración de olor en la posición de la mosca, 0..1
 */
export function plumeStep(pl, dt, odor) {
  const { net, layout, opts } = pl;
  const P = layout.pops;
  const I = new Float32Array(net.n);

  for (let i = P.TON.start; i < P.TON.end; i++) I[i] = 0.09;
  // Dos propiedades reales de los receptores olfativos, y las dos importan:
  //
  //  · Son LOGARÍTMICOS, lo que les deja responder igual a una bocanada tenue
  //    que a una fuerte. Con respuesta lineal la mosca cruza el penacho sin
  //    olerlo.
  //  · Se ADAPTAN: señalan el cambio de concentración, no su valor. Una mosca
  //    metida en olor constante deja de recibir señal. Sin esto se clava
  //    avanzando contra el viento y nunca corrige de lado.
  pl.adapt += (odor - pl.adapt) * (1 - Math.exp(-dt / 300));
  const phasic = Math.max(0, odor - opts.adaptStrength * pl.adapt);
  const drive = 0.62 * Math.log10(1 + 12 * phasic);
  for (let i = P.ORN.start; i < P.ORN.end; i++) I[i] = drive;

  // La traza empuja el avance contra el viento y mantiene callado el zigzag.
  for (let i = P.DNsurge.start; i < P.DNsurge.end; i++) I[i] += opts.traceSurge * pl.trace;
  for (let i = P.CL.start; i < P.CR.end; i++) I[i] -= opts.traceInhib * pl.trace;

  // Cuanto más tiempo lleva sin oler nada, más se frena la señal que hace
  // alternar el oscilador. Cada barrido dura más y por lo tanto llega más
  // lejos: es el ensanchamiento progresivo del barrido que hacen los insectos
  // reales cuando pierden un rastro. Sin esto la mosca sólo puede seguir un
  // penacho en el que ya está, nunca encontrar uno que se le escapó.
  for (let i = P.AL.start; i < P.AL.end; i++) I[i] -= opts.searchSuppress * pl.search;
  for (let i = P.AR.start; i < P.AR.end; i++) I[i] -= opts.searchSuppress * pl.search;

  const fired = net.step(dt, I);

  let hits = 0;
  for (const i of fired) if (i >= P.H.start && i < P.H.end) hits++;
  pl.trace = pl.trace * Math.exp(-dt / opts.tauTrace) + hits * 0.05;
  pl.trace = Math.min(1.4, pl.trace);

  if (pl.trace > 0.08) pl.search = 0;
  else pl.search = Math.min(1, pl.search + dt / opts.tauSearch);

  return fired;
}

/** Tasas por población en el último paso, para leer la conducta y dibujar. */
export function popRates(net, layout, names) {
  const out = {};
  for (const n of names) {
    const p = layout.pops[n];
    let c = 0;
    for (const i of net.prevSpikes) if (i >= p.start && i < p.end) c++;
    out[n] = c / p.size;
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// 3. CUERPO FUNGIFORME  (ronda de memoria)
//
//   PN  →  células de Kenyon (código disperso: cada KC exige coincidencia de
//   varias PN)  →  MBON de aproximación, con pesos PLÁSTICOS.
//   Una neurona dopaminérgica marca la puerta correcta y potencia las sinapsis
//   de las KC activas en ese momento. Esa huella decae con una constante de
//   unos dos segundos: es literalmente la memoria de la mosca, y es la razón
//   por la que en esta ronda pierde.
// ───────────────────────────────────────────────────────────────────────────

export const N_DOORS = 4;
export const N_KC = 200;
const KC_FANIN = 6;

export function buildMemoryCircuit(rng = Math.random, opts = {}) {
  const L = new Layout();
  L.add('PN',   N_DOORS * 10, { tau: 14, vth: 1.00, refrac: 2.5 });
  L.add('KC',   N_KC,         { tau: 11, vth: 1.00, refrac: 4.0 });
  L.add('MBON', 4,            { tau: 16, vth: 1.00, refrac: 4.0 });

  const e = [];
  // Cada KC muestrea al azar unas pocas PN y exige coincidencia: código disperso.
  const kcInputs = [];
  for (let k = 0; k < N_KC; k++) {
    const src = new Set();
    while (src.size < KC_FANIN) src.add(Math.floor(rng() * N_DOORS * 10));
    kcInputs.push([...src]);
    for (const s of src) e.push([L.idx('PN', s), L.idx('KC', k), 0.38]);
  }

  const params = L.materialize();
  const net = new LIFNet(L.n, buildCSR(L.n, e), { ...params, noise: 0.006 });

  return {
    net, layout: L, nSyn: e.length, kcInputs,
    /** Pesos plásticos KC → MBON de aproximación. Empiezan en cero. */
    w: new Float32Array(N_KC),
    tauMem: opts.tauMem ?? 1100,
  };
}

/** Un paso del cuerpo fungiforme: propaga, aplica plasticidad y decaimiento. */
export function memoryStep(mb, dt, I, dopamine) {
  const { net, layout, w } = mb;
  const kc = layout.pops.KC, mbon = layout.pops.MBON;

  // Las KC que dispararon empujan al MBON a través de los pesos plásticos.
  let drive = 0;
  for (const i of net.prevSpikes) if (i >= kc.start && i < kc.end) drive += w[i - kc.start];
  for (let m = mbon.start; m < mbon.end; m++) I[m] += drive / dt;

  const fired = net.step(dt, I);

  // Dopamina presente → se potencian las sinapsis de las KC activas ahora.
  if (dopamine > 0) {
    for (const i of fired) {
      if (i >= kc.start && i < kc.end) {
        const k = i - kc.start;
        w[k] = Math.min(0.30, w[k] + 0.05 * dopamine);
      }
    }
  }
  // Olvido.
  const d = Math.exp(-dt / mb.tauMem);
  for (let k = 0; k < w.length; k++) w[k] *= d;

  return fired;
}

/**
 * Elección de puerta a partir de la respuesta del MBON a cada clave.
 * No es un argmax: es una elección probabilística (softmax), que es como se
 * comportan los animales y lo que hace que la memoria se degrade suave hacia el
 * azar en lugar de apagarse de golpe.
 */
export function chooseDoor(scores, temperature = 3.2, rng = Math.random) {
  const m = Math.max(...scores);
  const ex = scores.map((s) => Math.exp((s - m) / temperature));
  const total = ex.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let d = 0; d < ex.length; d++) {
    r -= ex[d];
    if (r <= 0) return d;
  }
  return ex.length - 1;
}
