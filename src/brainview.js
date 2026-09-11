/**
 * Dibuja la actividad del circuito en una tira horizontal: cada población es
 * una columna de puntos, cada punto es una neurona, y el brillo es su traza de
 * disparo. Nada aquí es adorno — los puntos que se encienden son exactamente
 * las neuronas que dispararon en ese milisegundo de simulación.
 */

const DIM = '#2b3040';

/** Distribuye `n` puntos en una rejilla que quepa en (w, h). */
function grid(n, w, h, cols) {
  const c = cols ?? Math.max(1, Math.round(Math.sqrt(n * w / h)));
  const r = Math.ceil(n / c);
  const dx = w / c, dy = h / r;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const cx = i % c, cy = Math.floor(i / c);
    pts.push([(cx + 0.5) * dx, (cy + 0.5) * dy]);
  }
  return { pts, dx, dy };
}

export class BrainView {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} layout   Layout del circuito
   * @param {Array} spec      [{ pop, label, cols?, dot?, accent? }]
   */
  constructor(canvas, layout, spec) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.layout = layout;
    this.spec = spec;
    this.flash = 0;
    this.build();
  }

  build() {
    const W = this.cv.width, H = this.cv.height;
    const padX = 14, padTop = 12, padBottom = 26, gap = 16;
    const inner = H - padTop - padBottom;

    // Cada columna necesita al menos el ancho de su etiqueta, o las de las
    // poblaciones chicas (DNp01 son dos neuronas) se encabalgan con las vecinas.
    this.ctx.font = '600 10px ui-monospace, monospace';
    const minW = this.spec.map((s) => this.ctx.measureText(s.label).width + 10);
    const weights = this.spec.map((s) => Math.sqrt(this.layout.pops[s.pop].size));

    const usable = W - padX * 2 - (this.spec.length - 1) * gap;
    const minTotal = minW.reduce((a, b) => a + b, 0);
    const spare = Math.max(0, usable - minTotal);
    const wTotal = weights.reduce((a, b) => a + b, 0);

    let x = padX;
    this.cols = this.spec.map((s, i) => {
      const w = minW[i] + spare * weights[i] / wTotal;
      const pop = this.layout.pops[s.pop];
      const g = grid(pop.size, w, inner, s.cols);
      const col = { ...s, pop, x, w, y: padTop, h: inner, g, dot: s.dot ?? Math.max(1.3, Math.min(4.2, g.dx * 0.36)) };
      x += w + gap;
      return col;
    });
  }

  /** @param {Float32Array} trace traza de actividad del LIFNet */
  draw(trace, opts = {}) {
    const { ctx, cv } = this;
    ctx.clearRect(0, 0, cv.width, cv.height);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.10 * this.flash})`;
      ctx.fillRect(0, 0, cv.width, cv.height);
      this.flash = Math.max(0, this.flash - 0.06);
    }

    for (const col of this.cols) {
      // conexión visual hacia la siguiente columna
      ctx.strokeStyle = '#1c202b';
      ctx.lineWidth = 1;

      for (let i = 0; i < col.pop.size; i++) {
        const a = trace[col.pop.start + i];
        const [px, py] = col.g.pts[i];
        const x = col.x + px, y = col.y + py;
        if (a < 0.03) {
          ctx.fillStyle = DIM;
          ctx.beginPath(); ctx.arc(x, y, col.dot * 0.62, 0, 6.2832); ctx.fill();
        } else {
          const accent = col.accent ?? '#3fe0c5';
          ctx.fillStyle = accent;
          ctx.globalAlpha = 0.35 + 0.65 * a;
          ctx.beginPath(); ctx.arc(x, y, col.dot * (1 + 0.9 * a), 0, 6.2832); ctx.fill();
          if (a > 0.5) {
            ctx.globalAlpha = (a - 0.5) * 0.5;
            ctx.beginPath(); ctx.arc(x, y, col.dot * 3.4, 0, 6.2832); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }

      ctx.fillStyle = col.hot && opts.hot ? '#ffffff' : '#6b7286';
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(col.label, col.x + col.w / 2, this.cv.height - 10);
    }
  }

  pop() { this.flash = 1; }
}

/** Columnas que se muestran del circuito de escape. */
export const ESCAPE_SPEC = [
  { pop: 'R',     label: 'fotorreceptores', cols: 16 },
  { pop: 'LMCs',  label: 'lámina (retardo)', cols: 16 },
  { pop: 'T5',    label: 'T5 · movimiento', cols: 32 },
  { pop: 'LC4',   label: 'LC4', cols: 6 },
  { pop: 'LPLC2', label: 'LPLC2 · expansión', cols: 6 },
  { pop: 'DNp01', label: 'DNp01 · neurona gigante', cols: 2, dot: 9, accent: '#ff4d6d', hot: true },
  { pop: 'MN',    label: 'motoneuronas', cols: 5, dot: 5, accent: '#ff9a3c' },
];

export const PLUME_SPEC = [
  { pop: 'ORN',     label: 'ORN · receptores', cols: 8 },
  { pop: 'PN',      label: 'PN · lóbulo antenal', cols: 5 },
  { pop: 'H',       label: 'contacto', cols: 3, dot: 5 },
  { pop: 'DNsurge', label: 'avance', cols: 2, dot: 7, accent: '#ff4d6d', hot: true },
  { pop: 'CL',      label: 'zigzag izq.', cols: 3, dot: 5, accent: '#ff9a3c' },
  { pop: 'CR',      label: 'zigzag der.', cols: 3, dot: 5, accent: '#ff9a3c' },
];

export const MEMORY_SPEC = [
  { pop: 'PN',   label: 'PN · clave de la puerta', cols: 8 },
  { pop: 'KC',   label: 'células de Kenyon · código disperso', cols: 25 },
  { pop: 'MBON', label: 'MBON · valor aprendido', cols: 2, dot: 8, accent: '#ff4d6d', hot: true },
];
