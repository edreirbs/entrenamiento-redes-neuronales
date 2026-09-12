# Tú contra la mosca

Dos duelos en 3D contra el cerebro de una mosca de la fruta, simulado neurona
por neurona en el navegador. No hay video ni grabación: cada ronda construye su
circuito, lo corre paso a paso en tiempo real contra tus reflejos, y lo dibuja
**dentro de la cabeza de la mosca**. Cada punto que se enciende ahí es una
neurona del circuito disparando de verdad, colocada más o menos donde va en el
animal.

**Ronda 1 — el matamoscas.** Una sombra se expande sobre los dos y gana el
primero en saltar. Tú reaccionas en unos 250 ms. La vía de escape de la mosca
—cinco sinapsis entre el fotón y el músculo del salto, la última es la neurona
gigante DNp01— dispara a los ~220 ms desde que la sombra aparece. El duelo está
calibrado para que sea apretado y se pueda ganar, aunque casi siempre se pierde.

**Ronda 2 — la memoria.** Se enciende uno de cuatro terrones de azúcar, se apaga
la luz tres segundos y hay que recordar cuál era. Su cuerpo fungiforme sí aprende, pero la
huella decae con τ ≈ 1.1 s y a los tres segundos ya está en el azar. Esta la
ganas tú.

El remate no es "la mosca es mejor" ni al revés: cada arquitectura está resuelta
para un problema distinto.

## Lo que es real y lo que no

**Real: la arquitectura.** Las poblaciones (fotorreceptores, lámina, T5, LPLC2,
LC4, DNp01, células de Kenyon, MBON) y la forma en que se conectan están tomadas
de la literatura del conectoma de *Drosophila*.

**Nuestro: la dinámica.** Un conectoma es anatomía estática. No dice la fuerza de
cada sinapsis ni las constantes de tiempo, así que esos parámetros se ajustaron
hasta que el circuito se comportara como el animal. Cambiarlos cambia el
resultado, y decirlo es parte del punto de la pieza.

**Escala.** Corren 1,408 neuronas en la ronda 1 y 244 en la ronda 2, no las
166,700 del conectoma completo. Se eligieron los circuitos específicos de cada
tarea, no el cerebro entero.

Nada aquí está entrenado: no hay backpropagation, ni pesos aprendidos, ni datos
de entrenamiento. El comportamiento sale del cableado.

## La ronda que no llegó

Había una tercera ronda, de rastreo de olor, y está en `src/rounds/plume.js`
**sin conectar a la página**. El circuito olfativo hace lo que debe: avanza
contra el viento mientras huele y barre de lado al perder el rastro, con las dos
conductas emergiendo de la competencia entre poblaciones, no de un algoritmo.

Pero al medirlo contra un control trivial —un agente que simplemente va en línea
recta contra el viento sin oler nada— las tasas de éxito resultaron idénticas:

| configuración | mosca | ir recto sin oler |
|---|---|---|
| meandro 0.010, salida ±0.05 | 100 % | 100 % |
| meandro 0.010, salida ±0.10 | 12 % | 12 % |
| meandro 0.025, salida ±0.05 | 98 % | 98 % |
| emisión c/110 ms | 28 % | 28 % |

Estaba ganando por la razón equivocada. El barrido, de unas 0.05 unidades de
amplitud, nunca recupera un penacho del que ya salió; ensancharlo modulando la
adaptación del oscilador sólo lo llevó de 0.035 a 0.053. Haría falta otro
mecanismo de navegación —dirección referida al viento con estimación de la línea
central del penacho, o una arena mucho más grande y lenta— y eso es otro
proyecto. Publicarla como demostración de rastreo olfativo habría sido
exactamente lo que esta página le critica a las demos virales.

## Estructura

```
index.html            una pantalla, casi sin texto
assets/style.css
vendor/three.module.js  Three.js r160, incluido para no depender de un CDN
src/lif.js            motor de integración y disparo con fuga, sinapsis dispersas en CSR
src/circuits.js       los tres circuitos: escape, olfativo, cuerpo fungiforme
src/fly3d.js          la mosca por geometría, con el circuito dentro de la cabeza
src/scene3d.js        mesa, luces, matamoscas y terrones
src/main.js           las dos rondas
src/rounds/plume.js   ronda descartada, sin conectar (ver arriba)
```

El matamoscas baja a velocidad constante, así que su tamaño angular crece
exactamente como el estímulo que se le inyecta al circuito: lo que ves caer y lo
que la mosca simulada "ve" son la misma cosa.

Los circuitos son ejecutables fuera del navegador, que es como se calibraron:

```bash
node --input-type=module -e "
import { buildEscapeCircuit } from './src/circuits.js';
const { net, nSyn } = buildEscapeCircuit();
console.log(net.n, 'neuronas,', nSyn, 'sinapsis');
"
```

## Publicarlo en GitHub Pages

Pages hay que encenderlo una vez a mano: el token de GitHub Actions no tiene
permiso para crear el sitio (`Resource not accessible by integration`), sólo
para desplegar en uno que ya exista. En **Settings → Pages**, cualquiera de las
dos opciones sirve:

- **Deploy from a branch** → rama `claude/como-hace-eso-la-gente-sywnpp`,
  carpeta `/ (root)`. Es lo más directo: el sitio es estático y no necesita
  compilarse. Queda publicado en un par de minutos y el flujo de Actions ni se
  usa.
- **GitHub Actions** → y luego volver a lanzar el flujo *Publicar en GitHub
  Pages* desde la pestaña Actions.

Queda en `https://edreirbs.github.io/entrenamiento-redes-neuronales/`.

## Correrlo localmente

Son módulos ES, así que hace falta servirlo por HTTP (abrir el archivo
directamente falla por CORS):

```bash
python3 -m http.server 8000
```

## Fuentes

- [FlyWire](https://flywire.ai) y [neuPrint · Janelia](https://neuprint.janelia.org) — conectomas públicos de *Drosophila*
- Shiu et al., *A Drosophila computational brain model reveals sensorimotor processing*, [Nature 2024](https://www.nature.com/articles/s41586-024-07763-9)
