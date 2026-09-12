/**
 * Lo que la mosca se lleva de un intento al siguiente.
 *
 * Dos cosas, y las dos tienen respaldo en el animal:
 *
 *  · SENSIBILIZACIÓN. Un susto fuerte sube la respuesta de la vía de escape:
 *    las sinapsis que convergen sobre la neurona gigante empujan más y el
 *    umbral efectivo baja, así que reacciona a sombras más tenues y más
 *    pronto. Es aprendizaje no asociativo, el hermano opuesto de la
 *    habituación.
 *
 *  · DESPEGUE CORTO. La mosca tiene dos formas de despegar. Con la neurona
 *    gigante metida, el despegue es explosivo y sale en pocos milisegundos,
 *    aunque peor dirigido. Sin ella, prepara el salto con calma y sale mejor
 *    orientada, pero tarde. Cuanto más sensibilizada, más usa el corto.
 *
 *  · Y una tercera que es MODELO NUESTRO, no medición: se acuerda de por dónde
 *    le llegan los matamoscas y sesga su salto hacia el lado contrario.
 *
 * Todo vive en el navegador de quien juega y no sale de ahí.
 */

const KEY = 'mosca.v2';

const FRESH = {
  gen: 1,          // generación actual
  kills: 0,        // cuántas has aplastado
  swats: 0,        // cuántos intentos llevas
  racha: 0,        // aciertos seguidos ahora mismo
  best: 0,         // tu mejor racha
  exp: 0,          // experiencia acumulada: lo que de verdad la hace difícil
  dir: [0, 0],     // de dónde suelen venir los golpes, en coordenadas de mesa
  lastSeen: 0,
};

/**
 * Cuánto sensibiliza cada tipo de encuentro. No todos enseñan lo mismo: un
 * manotazo al otro lado de la mesa apenas lo registra, mientras que uno que
 * pasó rozándole y del que tuvo que salir huyendo es exactamente el estímulo
 * que sube la respuesta de la vía de escape.
 */
const PESO = {
  intento: 0.004,   // cualquier golpe, aunque ni lo haya visto
  reaccion: 0.010,  // la neurona gigante llegó a dispararse
  cerca: 0.016,     // le pasó encima: amenaza real
  muerte: 0.026,    // la generación anterior no la contó
};
const EXP_MAX = 1.6;

/** Registra un encuentro. Todo golpe enseña algo; unos mucho más que otros. */
export function aprender(s, ev) {
  let d = PESO.intento;
  if (ev.reacciono) d += PESO.reaccion;
  if (ev.cerca) d += PESO.cerca;
  if (ev.muere) d += PESO.muerte;
  s.exp = Math.min(EXP_MAX, (s.exp || 0) + d);
  return d;
}

// Ganancia de la convergencia sobre DNp01: empieza floja y se sensibiliza.
const GAIN_MIN = 0.60, GAIN_MAX = 2.20;


// Tiempo entre el disparo de la neurona gigante y despejar la zona de impacto.
const DESPEGUE_LARGO = 105, DESPEGUE_CORTO = 30;

/** Cuánto ha aprendido, 0..1. Es lo que dibuja la barra. */
export function progreso(s) {
  return Math.min(1, (s.exp || 0) / EXP_MAX);
}

export function ganancia(s) {
  return GAIN_MIN + progreso(s) * (GAIN_MAX - GAIN_MIN);
}

/** Milisegundos entre el disparo de DNp01 y salir de la zona de impacto. */
export function despegue(s) {
  return DESPEGUE_LARGO + progreso(s) * (DESPEGUE_CORTO - DESPEGUE_LARGO);
}

/** Sesgo aprendido: hacia dónde conviene saltar, dado de dónde suelen llegar. */
export function sesgo(s) {
  const [x, z] = s.dir;
  const m = Math.hypot(x, z);
  if (m < 0.01) return [0, 0];
  const fuerza = Math.min(0.75, progreso(s) * 1.1);
  return [-x / m * fuerza, -z / m * fuerza];
}

/** Registra de dónde vino este golpe, en coordenadas relativas a la mosca. */
export function apuntar(s, dx, dz) {
  const m = Math.hypot(dx, dz) || 1;
  s.dir[0] = s.dir[0] * 0.82 + (dx / m) * 0.18;
  s.dir[1] = s.dir[1] * 0.82 + (dz / m) * 0.18;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...FRESH, ...JSON.parse(raw) };
      // Partidas guardadas antes de que la experiencia se ponderara por evento.
      if (!s.exp) s.exp = s.kills * 0.028 + s.swats * 0.006;
      return s;
    }
  } catch { /* almacenamiento bloqueado: se juega con una mosca nueva */ }
  return { ...FRESH };
}

export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, lastSeen: Date.now() })); }
  catch { /* si no se puede guardar, no recuerda entre visitas */ }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* nada que borrar */ }
  return { ...FRESH };
}
