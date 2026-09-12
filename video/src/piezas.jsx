import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const COL = {
  fondo: '#07070b',
  tinta: '#eef0f6',
  tenue: '#8a92a6',
  mosca: '#2fe0c0',
  golpe: '#ff5a4d',
  ambar: '#d9a441',
  linea: '#232733',
};

export const SANS = '"Liberation Sans", "DejaVu Sans", sans-serif';
export const MONO = '"DejaVu Sans Mono", "Liberation Mono", monospace';

/** Aparición suave: casi todo en el video entra y sale con esto. */
export function Fundido({ inicio = 0, largo = 12, salida, children, style }) {
  const f = useCurrentFrame();
  let o = interpolate(f - inicio, [0, largo], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (salida != null) {
    o *= interpolate(f, [salida - largo, salida], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }
  const y = interpolate(f - inicio, [0, largo], [14, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ opacity: o, transform: `translateY(${y}px)`, ...style }}>{children}</div>;
}

/** Un número que cuenta hasta su valor, con rebote al llegar. */
export function Contador({ hasta, decimales = 0, inicio = 0, dur = 30, sufijo = '', style }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - inicio, fps, config: { damping: 200 }, durationInFrames: dur });
  const v = s * hasta;
  return (
    <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', ...style }}>
      {v.toLocaleString('es-MX', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}{sufijo}
    </span>
  );
}

/** El área donde vive el visual de cada escena, por encima de los subtítulos. */
export function Lienzo({ children, style }) {
  return (
    <div style={{
      position: 'absolute', left: 72, right: 72, top: 96, height: 700,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>{children}</div>
  );
}

/** Rótulo pequeño en versalitas que nombra la escena. */
export function Rotulo({ children, color = COL.mosca }) {
  return (
    <div style={{
      position: 'absolute', top: 52, left: 0, right: 0, textAlign: 'center',
      fontFamily: SANS, fontSize: 21, letterSpacing: '.24em', textTransform: 'uppercase',
      color, fontWeight: 700,
    }}>{children}</div>
  );
}

export function Titular({ children, size = 66, color = COL.tinta, style }) {
  return (
    <div style={{
      fontFamily: SANS, fontSize: size, lineHeight: 1.08, letterSpacing: '-0.035em',
      fontWeight: 800, color, textAlign: 'center', ...style,
    }}>{children}</div>
  );
}

/** Banda de subtítulos. Es lo que hace que el video se entienda sin audio. */
export function Subtitulo({ texto }) {
  return (
    <div style={{
      position: 'absolute', left: 64, right: 64, bottom: 60,
      fontFamily: SANS, fontSize: 37, lineHeight: 1.34, fontWeight: 600,
      color: COL.tinta, textAlign: 'center', textShadow: '0 3px 22px rgba(0,0,0,.95)',
    }}>{texto}</div>
  );
}

/** Fondo con dos luces suaves, para que el negro no sea plano. */
export function Fondo() {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: COL.fondo,
      backgroundImage:
        'radial-gradient(760px 520px at 18% 8%, #16202e 0%, transparent 62%),'
        + 'radial-gradient(700px 480px at 88% 92%, #0d2a28 0%, transparent 58%)',
    }} />
  );
}
