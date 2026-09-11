/** Utilidades compartidas por las rondas. */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const fmtMs = (ms) => `${Math.round(ms)} <small>ms</small>`;

/** Espera una tecla de las indicadas, o un toque. Devuelve la tecla o 'tap'. */
export function waitForKeys(keys, onTap) {
  return new Promise((resolve) => {
    const onKey = (e) => {
      if (keys.includes(e.key) || keys.includes(e.code)) {
        e.preventDefault();
        cleanup();
        resolve(keys.includes(e.code) ? e.code : e.key);
      }
    };
    const onPointer = (e) => {
      const r = onTap ? onTap(e) : 'tap';
      if (r != null) { cleanup(); resolve(r); }
    };
    const cleanup = () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
  });
}

/** Estado de las flechas izquierda/derecha, y del arrastre en pantalla táctil. */
export function steering(target) {
  const state = { left: false, right: false, touch: 0 };
  const down = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') state.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') state.right = true;
  };
  const up = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') state.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') state.right = false;
  };
  const touch = (e) => {
    const r = target.getBoundingClientRect();
    state.touch = ((e.clientX - r.left) / r.width - 0.5) * 2;   // -1 izquierda, +1 derecha
  };
  const clear = () => { state.touch = 0; };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  target.addEventListener('pointerdown', touch);
  target.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') touch(e); });
  target.addEventListener('pointerup', clear);
  target.addEventListener('pointerleave', clear);
  state.value = () => (state.left ? -1 : 0) + (state.right ? 1 : 0) + state.touch;
  state.detach = () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
  return state;
}

/** Generador congruente lineal: el mismo rastro de olor para los dos competidores. */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
