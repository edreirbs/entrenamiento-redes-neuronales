#!/usr/bin/env python3
"""
Sintetiza la narración del guion y calcula la línea de tiempo del video.

Una frase, un `.wav`. La duración de cada archivo se mide leyendo la cabecera
del wav, no se estima: si se reescribe una frase, `tiempos.json` se recalcula
y el video se recompone solo alrededor de la voz.

Uso:  python3 narra.py [carpeta-de-modelos]
      (por omisión busca los .onnx de Piper junto al script)
"""
import json
import os
import subprocess
import sys
import wave

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELOS = sys.argv[1] if len(sys.argv) > 1 else AQUI
SALIDA = os.path.join(AQUI, 'public', 'vo')

# Pico al que se lleva la voz entera (mismo factor para todas las frases, para
# no aplanar las diferencias de énfasis que ya trae la síntesis).
PICO = 0.89


def duracion(ruta):
    with wave.open(ruta) as w:
        return w.getnframes() / w.getframerate()


def main():
    guion = json.load(open(os.path.join(AQUI, 'guion.json')))
    modelo = os.path.join(MODELOS, guion['voz'] + '.onnx')
    if not os.path.exists(modelo):
        sys.exit('no encuentro el modelo de voz: ' + modelo)

    os.makedirs(SALIDA, exist_ok=True)
    for viejo in os.listdir(SALIDA):
        os.remove(os.path.join(SALIDA, viejo))

    for l in guion['lineas']:
        destino = os.path.join(SALIDA, l['id'] + '.wav')
        subprocess.run(
            ['piper', '-m', modelo, '-f', destino,
             '--length-scale', str(guion['escalaLongitud']),
             '--sentence-silence', '0.28'],
            input=l['texto'], text=True, check=True, capture_output=True,
        )
        print(f"{l['id']}  {duracion(destino):6.3f}s  {l['texto'][:58]}")

    nivela(guion)
    cronometra(guion)


def nivela(guion):
    """Lleva todas las frases al mismo pico, con un solo factor común."""
    import array
    pistas = []
    tope = 1
    for l in guion['lineas']:
        ruta = os.path.join(SALIDA, l['id'] + '.wav')
        with wave.open(ruta) as w:
            params = w.getparams()
            datos = array.array('h', w.readframes(w.getnframes()))
        tope = max(tope, max(abs(v) for v in datos))
        pistas.append((ruta, params, datos))

    k = (PICO * 32767) / tope
    for ruta, params, datos in pistas:
        for i, v in enumerate(datos):
            datos[i] = int(max(-32768, min(32767, v * k)))
        with wave.open(ruta, 'wb') as w:
            w.setparams(params)
            w.writeframes(datos.tobytes())
    print(f'nivelado: x{k:.2f}')


def cronometra(guion):
    """Encadena las frases con una pausa fija y escribe tiempos.json."""
    pausa = guion['pausaEntreLineas']
    t, lineas = 0.0, []
    for l in guion['lineas']:
        d = duracion(os.path.join(SALIDA, l['id'] + '.wav'))
        lineas.append({'id': l['id'], 'escena': l['escena'], 'texto': l['texto'],
                       'inicio': round(t, 3), 'dur': round(d, 3)})
        t += d + pausa
    total = round(t - pausa, 3)
    json.dump({'total': total, 'lineas': lineas},
              open(os.path.join(AQUI, 'tiempos.json'), 'w'),
              ensure_ascii=False, indent=2)
    print(f'\ntotal narración: {total:.1f}s')


if __name__ == '__main__':
    main()
