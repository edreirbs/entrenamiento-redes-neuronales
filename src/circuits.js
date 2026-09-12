/**
 * El circuito de escape de Drosophila.
 *
 * Ninguna capa es decorativa: cada una corresponde a una población real descrita
 * en la literatura del conectoma, con su conectividad y su signo. Lo que NO es
 * real son los parámetros de la dinámica (umbral, fuga, ganancia): el conectoma
 * es anatomía estática y no dice la fuerza de cada sinapsis, así que eso lo
 * ajustamos nosotros. La página lo dice explícitamente.
 *
 * (Este repositorio tuvo antes circuitos olfativo y de cuerpo fungiforme, con
 * sus mediciones. Siguen en el historial de git, en el commit 0ef5781.)
 */
import { buildCSR, LIFNet } from './lif.js?v=6';

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

  // Índices de las sinapsis que convergen sobre la neurona gigante. La
  // habituación del escape en la mosca es una depresión de justo estas
  // sinapsis: ante estímulos de aproximación repetidos, dejan de empujar
  // igual y el animal tarda más en saltar (o deja de saltar).
  const { indptr, indices, weights } = net.csr;
  const gfPop = L.pops.DNp01;
  const conv = [];
  for (const name of ['LPLC2', 'LC4']) {
    const p = L.pops[name];
    for (let pre = p.start; pre < p.end; pre++) {
      for (let k = indptr[pre]; k < indptr[pre + 1]; k++) {
        if (indices[k] >= gfPop.start && indices[k] < gfPop.end) conv.push([k, weights[k]]);
      }
    }
  }

  return {
    net, layout: L, nSyn: e.length, gain: 1,
    /**
     * Escala la convergencia sobre la neurona gigante, que es donde vive la
     * plasticidad del escape en el animal.
     *   g < 1  habituada   — responde menos y más tarde
     *   g > 1  sensibilizada — responde antes, incluso a sombras tenues
     * @param {number} g
     */
    setGain(g) {
      this.gain = Math.max(0.2, Math.min(3, g));
      for (const [k, base] of conv) weights[k] = base * this.gain;
    },
  };
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
