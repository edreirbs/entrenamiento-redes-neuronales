# El video

Dos minutos sobre el juego, hechos con [Remotion](https://remotion.dev).
Cuadrado 1080×1080, 30 fps, 104 segundos, con voz sintética y subtítulos.

## Cómo se arma

**El guion vive en `guion.json`**, una frase por entrada. De ahí sale todo lo
demás: no hay tiempos escritos a mano en ninguna parte.

1. **Voz.** Cada frase se sintetiza por separado con [Piper](https://github.com/rhasspy/piper)
   y la voz `es_MX-ald-medium`, y se mide la duración real del `.wav`. Esos
   tiempos se guardan en `tiempos.json`, que es lo que la composición lee para
   colocar escenas, audio y subtítulos. Si se reescribe una frase, el video se
   recompone solo.

2. **Escenas.** `src/escenas.jsx` tiene una por bloque narrativo; se agrupan
   por el campo `escena` del guion y cada una se estira hasta que empieza la
   siguiente.

3. **Render.** Necesita un navegador. Remotion usa por defecto el modo headless
   antiguo de Chrome, que ya no existe en Chromium moderno, así que hay que
   apuntarle al binario `chrome-headless-shell`.

## Regenerar

La voz y la salida no se versionan (pesan y se rehacen). Para reconstruirlas:

```bash
# 1. voz (una vez): pip install piper-tts y bajar el modelo es_MX
#    de huggingface.co/rhasspy/piper-voices
#    luego, por cada línea de guion.json:
#      echo "<texto>" | python3 -m piper --model es_MX-ald-medium.onnx \
#        --output_file public/vo/<id>.wav
#    y recalcular tiempos.json con la duración de cada wav

# 2. render
npm install
npx remotion render src/index.jsx Matala out/matala.mp4 \
  --browser-executable=/ruta/a/chrome-headless-shell --concurrency=4
```

## Qué hay dentro

```
guion.json        el texto, una frase por entrada
tiempos.json      generado: inicio y duración reales de cada frase
src/Matala.jsx    la composición: escenas, audio y subtítulos
src/escenas.jsx   las nueve escenas
src/piezas.jsx    primitivas compartidas (fundidos, contadores, subtítulo)
public/img/       capturas del juego usadas en el video
```
