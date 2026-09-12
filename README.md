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

**Lo que ves es lo que ella ve.** El matamoscas baja a velocidad constante y se
proyecta sobre su campo visual como una cámara estenopeica: el radio depende de
la altura y el centro se desplaza si el golpe no viene justo de arriba. Por eso
apuntarle de lado no lo percibe igual.

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

- [FlyWire](https://flywire.ai) y [neuPrint · Janelia](https://neuprint.janelia.org) — conectomas públicos de *Drosophila*
- Shiu et al., *A Drosophila computational brain model reveals sensorimotor processing*, [Nature 2024](https://www.nature.com/articles/s41586-024-07763-9)
