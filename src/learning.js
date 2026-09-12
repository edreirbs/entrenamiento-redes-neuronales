/**
 * Lo que la mosca se lleva de una partida a la siguiente.
 *
 * Son dos aprendizajes opuestos, y sólo uno de ellos es "mejorar":
 *
 *  · HABITUACIÓN (ronda 1). Documentada en el animal: ante estímulos de
 *    aproximación repetidos, las sinapsis que convergen sobre la neurona
 *    gigante se deprimen y la mosca tarda más en saltar, o deja de saltar.
 *    Es aprendizaje no asociativo, y la vuelve PEOR. Se recupera con el
 *    descanso, así que si dejas la página un rato la encuentras fresca.
 *
 *  · CONSOLIDACIÓN (ronda 2). El entrenamiento repetido y espaciado produce
 *    memoria de largo plazo en el cuerpo fungiforme. Aquí se modela como una
 *    huella que tarda más en decaer conforme se entrena. Que la consolidación
 *    exista está documentado; la curva concreta de esta página es NUESTRA, no
 *    una medición.
 *
 * Todo vive en el navegador de quien juega (localStorage) y no sale de ahí.
 */

const KEY = 'mosca.aprendizaje.v1';

const FRESH = { hab: 0, lastSeen: 0, entrenamientos: 0, partidas: 0 };

/** Constante de recuperación de la habituación: diez minutos de descanso. */
const RECOVERY_MS = 10 * 60 * 1000;
const HAB_CAP = 0.85;          // nunca del todo habituada: seguiría sin saltar jamás
const HAB_PER_LOOM = 0.055;

export function load() {
  let s = { ...FRESH };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...FRESH, ...JSON.parse(raw) };
  } catch { /* modo privado, almacenamiento bloqueado: se juega con una mosca nueva */ }

  // La habituación se disipa con el descanso.
  if (s.lastSeen) {
    const rest = Date.now() - s.lastSeen;
    if (rest > 0) s.hab *= Math.exp(-rest / RECOVERY_MS);
  }
  s.hab = Math.max(0, Math.min(HAB_CAP, s.hab));
  return s;
}

export function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, lastSeen: Date.now() }));
  } catch { /* si no se puede guardar, la mosca simplemente no recuerda */ }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* nada que borrar */ }
  return { ...FRESH };
}

/** Un estímulo de aproximación más: la vía de escape se deprime un poco. */
export function habituar(s) {
  s.hab = Math.min(HAB_CAP, s.hab + HAB_PER_LOOM);
  return s;
}

/**
 * Constante de olvido del cuerpo fungiforme según cuánto se ha entrenado.
 * Sube rápido al principio y se aplana: es la forma de una curva de
 * aprendizaje, no una recta.
 */
export function tauMemoria(s) {
  return 1100 + 230 * (1 - Math.exp(-s.entrenamientos / 18));
}

/** 0..1, para dibujar la barra de consolidación. */
export function consolidacion(s) {
  return 1 - Math.exp(-s.entrenamientos / 18);
}
