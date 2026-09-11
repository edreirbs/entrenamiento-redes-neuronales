/**
 * Tú contra la mosca — orquestación de las tres rondas.
 *
 * Todo lo que ocurre en esta página se simula en el navegador: no hay video,
 * no hay grabación y no hay servidor. Cada ronda construye su circuito, lo
 * corre paso a paso en tiempo real contra tus reflejos, y lo dibuja.
 */
import { runLooming } from './rounds/looming.js';
import { runMemory } from './rounds/memory.js';

const $ = (id) => document.getElementById(id);

const dom = {
  cvH: $('cv-human'), cvF: $('cv-fly'), cvBrain: $('cv-brain'),
  hudH: $('hud-human'), hudF: $('hud-fly'),
  tagH: $('tag-human'), tagF: $('tag-fly'),
  prompt: $('prompt'), brainStats: $('brainstats'),
  setScore(results) {
    $('trials').innerHTML = results
      .map((r) => {
        const w = r.winner ?? (r.humanOk && !r.flyOk ? 'human' : r.flyOk && !r.humanOk ? 'fly' : 'draw');
        return `<i class="${w === 'human' ? 'h' : w === 'fly' ? 'f' : ''}"></i>`;
      })
      .join('');
  },
};

const ROUNDS = [
  {
    kicker: 'Ronda 1 de 2',
    title: 'El matamoscas',
    text: `Una sombra se expande sobre los dos. El primero en saltar gana; el que no
           salta a tiempo, se lo lleva. Tú respondes con la barra espaciadora. Ella,
           con la neurona gigante: la vía de escape más corta que se conoce en un
           animal, cinco sinapsis entre el fotón y el músculo del salto.`,
    circuit: 'fotorreceptores → <b>lámina</b> → <b>T5</b> (movimiento) → <b>LPLC2</b> (expansión) + <b>LC4</b> → <b>DNp01</b> · neurona gigante → motoneuronas',
    run: runLooming,
    win: {
      fly: `Reaccionaste como reacciona un primate: bien. Sólo que tu retina tarda unos
            40 ms nada más en convertir la luz en señal, y después esa señal recorre
            corteza visual, corteza motora, médula y brazo. La mosca se salta todo eso.`,
      human: `Le ganaste a la neurona gigante. Eso casi no pasa, y probablemente no se
              repita: tu tiempo de reacción varía mucho más que el de ella.`,
      draw: 'Empate.',
    },
  },
  {
    kicker: 'Ronda 2 de 2',
    title: 'La memoria',
    text: `Se enciende una de cuatro puertas. Luego se apaga la luz tres segundos. Después
           hay que decir cuál era. Elige con las teclas 1 a 4.`,
    circuit: '<b>PN</b> → <b>células de Kenyon</b> (código disperso) → <b>MBON</b>, con sinapsis plásticas marcadas por dopamina · huella que decae con τ ≈ 1.1 s',
    run: runMemory,
    win: {
      human: `Su cuerpo fungiforme sí aprende: la dopamina marcó la puerta correcta y
              potenció las sinapsis de las células que estaban activas. Lo que no tiene es
              dónde guardarlo. La huella decae en poco más de un segundo, y a los tres ya
              no queda nada que leer. Tú acabas de hacer sin esfuerzo lo único que un
              cerebro cableado de fábrica no puede darte.`,
      fly: `Le atinó. Con la huella ya apagada, una de cada cuatro le sale por azar —
            fíjate en las respuestas del MBON: estaban casi empatadas.`,
      draw: 'Empate.',
    },
  },
];

let idx = 0;
const score = { human: 0, fly: 0 };

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
}

function markNav() {
  for (const li of document.querySelectorAll('.rounds li')) {
    li.classList.toggle('on', Number(li.dataset.round) === idx);
  }
}

function showCard() {
  const r = ROUNDS[idx];
  $('card-kicker').textContent = r.kicker;
  $('card-title').textContent = r.title;
  $('card-text').textContent = r.text.replace(/\s+/g, ' ').trim();
  $('card-circuit').innerHTML = r.circuit;
  markNav();
  show('screen-card');
}

async function play() {
  const r = ROUNDS[idx];
  dom.setScore([]);
  dom.prompt.textContent = '';
  dom.hudH.textContent = '—';
  dom.hudF.textContent = '—';
  show('screen-play');
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

  const out = await r.run(dom);
  if (out.winner === 'human') score.human++;
  else if (out.winner === 'fly') score.fly++;

  const li = document.querySelector(`.rounds li[data-round="${idx}"]`);
  li.classList.add(out.winner === 'human' ? 'won-h' : out.winner === 'fly' ? 'won-f' : 'on');

  $('res-kicker').textContent = r.kicker;
  $('res-title').textContent =
    out.winner === 'human' ? 'Ganaste esta' : out.winner === 'fly' ? 'Ganó la mosca' : 'Empate';
  $('res-score').innerHTML = roundScore(out);
  $('res-text').textContent = r.win[out.winner].replace(/\s+/g, ' ').trim();
  $('btn-next').textContent = idx < ROUNDS.length - 1 ? 'Siguiente ronda' : 'Ver el marcador final';
  show('screen-result');
}

function roundScore(out) {
  if (out.scoreH !== undefined) {
    return `<div><span class="v h">${out.scoreH}</span><span class="who">tú</span></div>
            <span class="vs">—</span>
            <div><span class="v f">${out.scoreF}</span><span class="who">mosca</span></div>`;
  }
  const f = (x) => (x === null ? '—' : `${(x / 1000).toFixed(1)}s`);
  return `<div><span class="v h">${f(out.human)}</span><span class="who">tú</span></div>
          <span class="vs">—</span>
          <div><span class="v f">${f(out.fly)}</span><span class="who">mosca</span></div>`;
}

function showFinal() {
  $('fin-score').innerHTML =
    `<span class="h">${score.human}</span><span class="vs">—</span><span class="f">${score.fly}</span>`;
  $('fin-title').textContent =
    score.fly > score.human ? 'Te ganó una mosca'
      : score.human > score.fly ? 'Le ganaste a la mosca'
        : 'Uno cada quien';
  $('fin-text').textContent =
    score.human === score.fly
      ? 'Que es el resultado esperado, y el interesante: te gana en los reflejos, le ganas en memoria. No es que uno sea mejor cerebro que el otro — están resueltos para problemas distintos.'
      : score.fly > score.human
        ? 'Lo esperable es uno cada quien. Si te ganó las dos, la de memoria se decide por azar más seguido de lo que parece: con la huella apagada, una de cada cuatro le sale bien.'
        : 'Poco común: ganarle a la neurona gigante en reflejos pasa pocas veces.';
  show('screen-final');
}

$('btn-start').addEventListener('click', () => { idx = 0; score.human = 0; score.fly = 0; showCard(); });
$('btn-go').addEventListener('click', play);
$('btn-next').addEventListener('click', () => {
  idx++;
  if (idx < ROUNDS.length) showCard();
  else { markNav(); showFinal(); }
});
$('btn-again').addEventListener('click', () => {
  idx = 0; score.human = 0; score.fly = 0;
  for (const li of document.querySelectorAll('.rounds li')) li.classList.remove('won-h', 'won-f', 'on');
  showCard();
});
