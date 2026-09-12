import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import tiempos from '../tiempos.json';
import { Fondo, Subtitulo } from './piezas.jsx';
import {
  Aprende, Cansarla, Cierre, Gancho, Generaciones, Gigante, Honesto, Juego, Ve, Vivo,
} from './escenas.jsx';

const ESCENAS = {
  gancho: Gancho,
  juego: Juego,
  vivo: Vivo,
  ve: Ve,
  gigante: Gigante,
  aprende: Aprende,
  generaciones: Generaciones,
  cansarla: Cansarla,
  honesto: Honesto,
  cierre: Cierre,
};

/**
 * Agrupa las líneas de narración por escena. Los tiempos salen de medir los
 * wav de verdad (tiempos.json), no de cronometrar a ojo: si se reescribe una
 * frase, el video se recompone solo.
 */
function bloques() {
  const out = [];
  for (const l of tiempos.lineas) {
    const ult = out[out.length - 1];
    if (ult && ult.escena === l.escena) ult.fin = l.inicio + l.dur;
    else out.push({ escena: l.escena, inicio: l.inicio, fin: l.inicio + l.dur });
  }
  // Cada escena se estira hasta que empieza la siguiente, para que no haya huecos.
  out.forEach((b, i) => { b.fin = i < out.length - 1 ? out[i + 1].inicio : b.fin + 1.4; });
  return out;
}

export const DURACION = tiempos.total + 1.4;

export function Matala() {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame();
  const t = f / fps;
  const linea = tiempos.lineas.find((l) => t >= l.inicio && t < l.inicio + l.dur + 0.22);

  return (
    <AbsoluteFill style={{ background: '#07070b' }}>
      <Fondo />

      {bloques().map((b) => {
        const Escena = ESCENAS[b.escena];
        const desde = Math.round(b.inicio * fps);
        return (
          <Sequence key={b.escena} from={desde} durationInFrames={Math.round((b.fin - b.inicio) * fps)}>
            <AbsoluteFill><Escena /></AbsoluteFill>
          </Sequence>
        );
      })}

      {tiempos.lineas.map((l) => (
        <Sequence key={l.id} from={Math.round(l.inicio * fps)} durationInFrames={Math.round(l.dur * fps) + 2}>
          <Audio src={staticFile(`vo/${l.id}.wav`)} />
        </Sequence>
      ))}

      {linea && <Subtitulo texto={linea.texto} />}
    </AbsoluteFill>
  );
}
