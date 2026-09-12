# Mátala si puedes

Intentas aplastar una mosca. Su cerebro está simulado neurona por neurona en tu
navegador, y **aprende de cada intento tuyo**. Las primeras las matas fácil. Para
la octava o novena ya no la tocas.

Estás entrenando a tu propia enemiga.

**https://edreirbs.github.io/entrenamiento-redes-neuronales/**

## Lo que es real

**El cableado.** Los puntos que se encienden dentro de su cabeza son las neuronas
del circuito de escape de *Drosophila* —fotorreceptores, lámina, T5, LPLC2, LC4
y **DNp01**, la neurona gigante— conectadas como en el animal y colocadas más o
menos donde van. Cada punto es una neurona y su brillo es su disparo real. Son
1,408 neuronas y 4,972 sinapsis corriendo a 2,000 pasos por segundo.

**Lo que ves es lo que ella ve.** El matamoscas se proyecta sobre su campo
visual como una cámara estenopeica: el radio depende de la altura y el centro se
desplaza si el golpe no viene justo de arriba. Por eso apuntarle de lado no lo
percibe igual.

**Y baja a la velocidad a la que juegas.** La señal principal es el **ritmo**:
cuánto tardaste desde el golpe anterior. Clics seguidos dan un matamoscas de
190 ms; golpes espaciados, de 330. Como señal secundaria está el manotazo — la
velocidad máxima del puntero en los 260 ms previos, que cuenta aunque sea el
primer golpe. Manda la más fuerte de las dos.

Las dos escalas están ancladas a lo que de verdad se puede hacer, que fue donde
falló el primer intento:

- **El ritmo no puede bajar del ciclo del golpe.** No se puede volver a pegar
  hasta que el matamoscas cae y sube, o sea `SWAT_MIN + LIFT_MS ≈ 390 ms`. El
  umbral de "rápido" está en 480 ms; pedir menos hacía que la mecánica no se
  activara nunca.
- **El manotazo tiene un techo humano.** Medido: un ajuste fino da 0.2 u/s, un
  movimiento normal 1.3, y un manotazo fuerte de 700 px en 60 ms llega a 9.5. El
  primer umbral estaba en 12 u/s — inalcanzable, así que el golpe salía siempre
  lento.

**El intercambio:** un golpe rápido va peor apuntado (se dispersa el punto de
impacto) y habitúa menos a la mosca, porque es un estímulo flojo. Sin eso,
machacar daría golpe rápido *y* fatiga a la vez, doble premio por el mismo acto.
Medido contra una mosca totalmente entrenada: machacando la matas 5 de cada 14
veces, y la fatiga se queda en 0.64 en vez de llegar a 1.

Un indicador al pie muestra en vivo qué tan fuerte saldría el golpe si pegaras
ahora. Sin él la mecánica es invisible.

**Nuestro: la dinámica.** Un conectoma es anatomía estática y no dice la fuerza de
cada sinapsis ni las constantes de tiempo. Esos parámetros se ajustaron midiendo
hasta que el circuito se comportara como el animal.

## Cómo aprende

Nada de esto es backpropagation. No hay entrenamiento ni datos: hay plasticidad
en unas sinapsis concretas, y se guarda en el `localStorage` de quien juega.

**Sensibilización** — documentada en el animal. El susto sube la ganancia de las
sinapsis de LPLC2 y LC4 que convergen sobre DNp01, y el umbral efectivo baja. De
0.60 a 2.20 conforme juegas.

**Despegue corto** — documentado. La mosca tiene dos formas de despegar: con la
neurona gigante metida el salto es explosivo pero peor dirigido; sin ella lo
prepara con calma y sale tarde. Aquí el tiempo para despejar la zona de impacto
baja de 105 ms a 30 ms.

**Sesgo direccional** — *modelo nuestro, no medición*. Se acuerda de por dónde le
suelen llegar los golpes y salta al lado contrario.

**Aprende de todo golpe, pero no todos enseñan igual.** Un manotazo al otro lado
de la mesa apenas lo registra; uno que le pasó rozando y del que tuvo que salir
huyendo es exactamente el estímulo que sensibiliza la vía de escape. Cuántos
golpes de cada tipo hacen falta para volverla intocable:

| encuentro | golpes |
|---|---|
| la aplastaste | 7 |
| le pasó rozando y escapó | 12 |
| lejano, pero llegó a reaccionar | 24 |
| lejano, ni lo vio | 84 |

### Tu contragolpe: agotarla

Golpes repetidos y seguidos deprimen esas mismas sinapsis y la obligan a volver
al despegue largo. Es **habituación**, el otro aprendizaje no asociativo clásico,
y en el animal convive con la sensibilización: una sube la respuesta a la larga,
la otra la agota en segundos. Por más entrenada que esté, si la cansas lo
suficiente vuelve a ser matable — pero se recupera sola con τ = 1.8 s, así que
hay que comprometerse a machacar.

Medido con una mosca totalmente entrenada:

| fatiga | tiempo total | la matas |
|---|---|---|
| 0.5 | 213 ms | nunca |
| 0.75 | 238 ms | nunca |
| 0.9 | 252 ms | 1 de 3 |

Golpear cada 0.65 s lleva la fatiga a ~0.99; a ritmo normal (1.8 s) se queda en
0.47, y con calma apenas en 0.35.

El arco resultante, medido contra un matamoscas de 270 ms:

| generación | reacción | despegue | total | ¿escapa? |
|---|---|---|---|---|
| 1 | 186 ms | 105 ms | 291 ms | 0 de 10 |
| 3 | 183 ms | 101 ms | 284 ms | 0 de 10 |
| 6 | 170 ms | 94 ms | 264 ms | 3 de 10 |
| 9 | 161 ms | 87 ms | 248 ms | 10 de 10 |

La zona interesante es la generación 6, donde se decide por márgenes de uno a
cinco milisegundos.

## Qué se ve mientras juegas

Un panel abajo a la izquierda grafica cada intento: una barra apilada con lo que
tardó en reaccionar (turquesa) y lo que tardó en despegar (ámbar), contra una
línea roja en los 270 ms en que llega el matamoscas. Las primeras barras la
rebasan —y por eso muere—; conforme aprende se van quedando debajo. Abajo van
los dos números con su mejora desde el primer intento, y el margen actual.

El botón **reiniciar** del panel borra todo lo aprendido en dos toques, y
devuelve una mosca de generación 1 sin experiencia.

## El video

En `video/` hay un proyecto de [Remotion](https://remotion.dev) que produce un
video cuadrado de 104 segundos contando todo esto, con voz sintética en español
y subtítulos. El guion vive en `video/guion.json` y los tiempos se derivan de
medir los audios, no de cronometrar a mano.

## Estructura

```
index.html              una pantalla
assets/style.css
vendor/three.module.js  Three.js r160, incluido para no depender de un CDN
src/lif.js              motor de integración y disparo con fuga, sinapsis dispersas en CSR
src/circuits.js         el circuito de escape
src/fly3d.js            la mosca por geometría, con el circuito dentro de la cabeza
src/scene3d.js          mesa, luces, matamoscas y mira
src/learning.js         lo que se lleva de un intento al siguiente
src/main.js             el juego
video/                  el proyecto de Remotion que produce el video
```

El circuito corre fuera del navegador, que es como se calibró:

```bash
node --input-type=module -e "
import { buildEscapeCircuit } from './src/circuits.js';
const c = buildEscapeCircuit();
console.log(c.net.n, 'neuronas,', c.nSyn, 'sinapsis');
"
```

Este repositorio tuvo antes un circuito olfativo y uno de cuerpo fungiforme, con
sus mediciones —incluido un resultado negativo documentado sobre rastreo de
olor—. Siguen en el historial de git, en el commit `0ef5781`.

## Correrlo localmente

Son módulos ES, así que hay que servirlo por HTTP:

```bash
python3 -m http.server 8000
```

## Fuentes

- Dorkenwald et al., *Neuronal wiring diagram of an adult brain*, [Nature 634, 124–138 (2024)](https://www.nature.com/articles/s41586-024-07558-y) — el conectoma completo: 139,255 neuronas y ~5×10⁷ sinapsis del cerebro de una *Drosophila* adulta
- Schlegel et al., *Whole-brain annotation and multi-connectome cell typing of Drosophila*, [Nature 634, 139–152 (2024)](https://www.nature.com/articles/s41586-024-07686-5) — los tipos celulares que dan nombre a LPLC2, LC4, DNp01…
- [FlyWire](https://flywire.ai) y [neuPrint · Janelia](https://neuprint.janelia.org) — conectomas públicos de *Drosophila*, descargables
- Shiu et al., *A Drosophila computational brain model reveals sensorimotor processing*, [Nature 2024](https://www.nature.com/articles/s41586-024-07763-9)
