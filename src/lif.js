/**
 * Motor de neuronas de integración y disparo con fuga (leaky integrate-and-fire).
 *
 * Es el mismo modelo que usan los trabajos que simulan el conectoma completo de
 * Drosophila (Shiu et al., Nature 2024): cada neurona es un voltaje que se carga
 * con lo que le llega, se fuga con una constante de tiempo, dispara al cruzar un
 * umbral y se resetea.
 *
 *     v ← v · e^(-dt/τ) + Σ(pesos de las que dispararon) + entrada externa
 *     si v ≥ umbral → disparo, v ← 0, periodo refractario
 *
 * Las conexiones van en formato disperso CSR indexado por neurona PREsináptica,
 * así que cada paso sólo recorre las sinapsis de las neuronas que dispararon.
 * Con ~1,400 neuronas y ~12,000 sinapsis un paso cuesta microsegundos.
 */

/** Construye la representación CSR a partir de una lista de aristas [pre, post, peso]. */
export function buildCSR(n, edges) {
  const counts = new Int32Array(n);
  for (const [pre] of edges) counts[pre]++;

  const indptr = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) indptr[i + 1] = indptr[i] + counts[i];

  const indices = new Int32Array(edges.length);
  const weights = new Float32Array(edges.length);
  const cursor = indptr.slice(0, n);
  for (const [pre, post, w] of edges) {
    const k = cursor[pre]++;
    indices[k] = post;
    weights[k] = w;
  }
  return { indptr, indices, weights, nnz: edges.length };
}

export class LIFNet {
  /**
   * @param {number} n            número de neuronas
   * @param {object} csr          salida de buildCSR
   * @param {object} opts
   * @param {Float32Array} opts.tau       constante de fuga por neurona (ms)
   * @param {Float32Array} opts.vth       umbral por neurona
   * @param {Float32Array} opts.refrac    periodo refractario por neurona (ms)
   * @param {number}       opts.noise     ruido gaussiano por paso
   */
  constructor(n, csr, opts = {}) {
    this.n = n;
    this.csr = csr;
    this.tau = opts.tau ?? filled(n, 20);
    this.vth = opts.vth ?? filled(n, 1);
    this.refracTime = opts.refrac ?? filled(n, 2.2);
    this.noise = opts.noise ?? 0.004;

    this.v = new Float32Array(n);
    this.refrac = new Float32Array(n);
    this.spiked = new Uint8Array(n);
    /** Traza de actividad con decaimiento lento, sólo para dibujar. */
    this.trace = new Float32Array(n);
    this.prevSpikes = [];
    this.t = 0;
  }

  reset() {
    this.v.fill(0);
    this.refrac.fill(0);
    this.spiked.fill(0);
    this.trace.fill(0);
    this.prevSpikes = [];
    this.t = 0;
  }

  /**
   * Avanza la red un paso.
   * @param {number} dt            paso de integración en ms
   * @param {Float32Array|null} I  corriente externa por neurona (en unidades de voltaje por ms)
   * @returns {number[]} índices de las neuronas que dispararon en este paso
   */
  step(dt, I) {
    const { n, v, refrac, spiked, trace, tau, vth, refracTime } = this;
    const { indptr, indices, weights } = this.csr;

    // 1. Fuga (y descuento del refractario).
    for (let i = 0; i < n; i++) {
      if (refrac[i] > 0) {
        refrac[i] -= dt;
        v[i] = 0;
      } else {
        v[i] *= Math.exp(-dt / tau[i]);
      }
    }

    // 2. Entrada sináptica de las que dispararon en el paso anterior.
    for (const i of this.prevSpikes) {
      for (let k = indptr[i]; k < indptr[i + 1]; k++) v[indices[k]] += weights[k];
    }

    // 3. Entrada externa y ruido.
    if (I) for (let i = 0; i < n; i++) v[i] += I[i] * dt;
    if (this.noise > 0) for (let i = 0; i < n; i++) v[i] += gauss() * this.noise;

    // 4. Umbral.
    const fired = [];
    spiked.fill(0);
    for (let i = 0; i < n; i++) {
      if (refrac[i] > 0) continue;
      if (v[i] >= vth[i]) {
        v[i] = 0;
        refrac[i] = refracTime[i];
        spiked[i] = 1;
        trace[i] = 1;
        fired.push(i);
      }
    }

    // 5. Traza para la visualización.
    const d = Math.exp(-dt / 45);
    for (let i = 0; i < n; i++) trace[i] *= d;

    this.prevSpikes = fired;
    this.t += dt;
    return fired;
  }
}

function filled(n, value) {
  const a = new Float32Array(n);
  a.fill(value);
  return a;
}

/** Box-Muller, con la segunda muestra en caché. */
let spare = null;
function gauss() {
  if (spare !== null) {
    const s = spare;
    spare = null;
    return s;
  }
  let u = 0, v = 0, s = 0;
  do {
    u = Math.random() * 2 - 1;
    v = Math.random() * 2 - 1;
    s = u * u + v * v;
  } while (s === 0 || s >= 1);
  const m = Math.sqrt(-2 * Math.log(s) / s);
  spare = v * m;
  return u * m;
}
