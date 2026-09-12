import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { COL, Contador, Fundido, Lienzo, MONO, Rotulo, SANS, Titular } from './piezas.jsx';

/* ── 1. El gancho: todos hemos fallado un manotazo ───────────────────── */
export function Gancho() {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, 300], [1.04, 1.18]);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Img src={staticFile('img/m-cenital.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`, opacity: 0.6 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,7,11,.78) 0%, rgba(7,7,11,.3) 40%, rgba(7,7,11,.96) 100%)' }} />
      </div>
      <Lienzo>
        <Fundido inicio={8} largo={20}>
          <Titular size={74}>¿Nunca le has<br />fallado un<br />manotazo a una<br />mosca?</Titular>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 2. De dónde sale el juego ───────────────────────────────────────── */
export function Juego() {
  return (
    <>
      <Rotulo>mapearon su cerebro neurona por neurona</Rotulo>
      <Lienzo>
        <Fundido inicio={4} largo={18} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 108, marginBottom: 24 }}>🪰</div>
          <Titular size={96}>MÁTALA<br />SI PUEDES</Titular>
          <div style={{ fontFamily: SANS, fontSize: 33, color: COL.tenue, marginTop: 30 }}>
            un juego: tú contra ella
          </div>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 3. No está animada: está corriendo ──────────────────────────────── */
export function Vivo() {
  return (
    <>
      <Rotulo color={COL.ambar}>no es una animación</Rotulo>
      <Lienzo>
        <Fundido inicio={0} largo={16} style={{ textAlign: 'center' }}>
          <Contador hasta={1408} inicio={8} dur={40}
            style={{ fontSize: 176, fontWeight: 700, color: COL.mosca, letterSpacing: '-0.06em' }} />
          <div style={{ fontFamily: SANS, fontSize: 40, color: COL.tinta, fontWeight: 600, marginTop: 8 }}>
            neuronas
          </div>
        </Fundido>
        <Fundido inicio={60} largo={16} style={{ marginTop: 44, textAlign: 'center' }}>
          <div style={{ fontFamily: SANS, fontSize: 34, color: COL.tenue, lineHeight: 1.45 }}>
            conectadas como en el animal,<br />corriendo ahora mismo<br />dentro de tu navegador
          </div>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 4. Lo que ella ve ───────────────────────────────────────────────── */
export function Ve() {
  const f = useCurrentFrame();
  const W = 16, H = 12, celda = 52;
  const r = interpolate(f, [14, 130], [0.6, 9.5], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  return (
    <>
      <Rotulo>la sombra, vista por sus ojos</Rotulo>
      <Lienzo>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${W}, ${celda}px)`, gap: 3 }}>
          {Array.from({ length: W * H }).map((_, i) => {
            const x = i % W, y = Math.floor(i / W);
            const d = Math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2);
            const lum = Math.min(1, Math.max(0, (d - r + 0.6) / 1.2));
            const c = Math.round(10 + lum * 78);
            return <div key={i} style={{
              width: celda, height: celda, borderRadius: 5,
              background: `rgb(${Math.round(c * 0.3)},${Math.round(c * 0.92)},${Math.round(c * 0.85)})`,
            }} />;
          })}
        </div>
        <Fundido inicio={110} largo={14} style={{ marginTop: 42 }}>
          <div style={{ fontFamily: SANS, fontSize: 33, color: COL.tenue, textAlign: 'center' }}>
            crece, y algo se dispara
          </div>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 5. La neurona gigante, en cinco pasos ───────────────────────────── */
const CAMINO = [
  'sus ojos',
  'primera escala',
  'detectores de movimiento',
  'alarma de peligro',
  'LA NEURONA GIGANTE',
  'músculos del salto',
];

export function Gigante() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Rotulo color={COL.golpe}>cinco pasos del ojo al músculo</Rotulo>
      <Lienzo>
        {CAMINO.map((nombre, i) => {
          const gigante = i === 4;
          const t0 = 10 + i * 24;
          const on = spring({ frame: f - t0, fps, config: { damping: 200 }, durationInFrames: 16 });
          const destello = gigante ? Math.max(0, Math.sin((f - t0) / 5)) * Math.max(0, 1 - (f - t0) / 80) : 0;
          const color = gigante ? COL.golpe : COL.mosca;
          return (
            <React.Fragment key={nombre}>
              {i > 0 && (
                <div style={{
                  width: 3, height: 22, background: COL.linea, opacity: on,
                  boxShadow: on > 0.5 ? `0 0 16px ${color}` : 'none',
                }} />
              )}
              <div style={{
                width: gigante ? 610 : 500, padding: gigante ? '20px 26px' : '15px 26px',
                borderRadius: 14, border: `2px solid ${on > 0.4 ? color : COL.linea}`,
                background: gigante ? `rgba(255,90,77,${0.10 + destello * 0.36})` : `rgba(47,224,192,${on * 0.08})`,
                opacity: 0.26 + on * 0.74,
                transform: `scale(${1 + destello * 0.05})`,
                textAlign: 'center',
              }}>
                <span style={{
                  fontFamily: SANS, fontSize: gigante ? 41 : 33,
                  fontWeight: gigante ? 800 : 600,
                  letterSpacing: gigante ? '.02em' : 0,
                  color: on > 0.4 ? (gigante ? COL.golpe : COL.tinta) : COL.tenue,
                }}>{nombre}</span>
              </div>
            </React.Fragment>
          );
        })}
        <Fundido inicio={168} largo={16} style={{ marginTop: 30 }}>
          <Titular size={52} color={COL.golpe}>Por eso te gana</Titular>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 6. Aprende de cada intento ──────────────────────────────────────── */
export function Aprende() {
  const f = useCurrentFrame();
  const p = interpolate(f, [38, 140], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <>
      <Rotulo>aprende de cada manotazo tuyo</Rotulo>
      <Lienzo>
        <Fundido inicio={0} largo={14} style={{ textAlign: 'center', marginBottom: 66 }}>
          <div style={{ fontFamily: SANS, fontSize: 34, color: COL.tenue, marginBottom: 14 }}>
            reacciona antes
          </div>
          <div style={{ fontFamily: MONO, fontSize: 84, fontWeight: 700, color: COL.mosca }}>
            {Math.round(186 + (161 - 186) * p)}<span style={{ fontSize: 38, color: COL.tenue }}> ms</span>
          </div>
        </Fundido>
        <Fundido inicio={22} largo={14} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: SANS, fontSize: 34, color: COL.tenue, marginBottom: 14 }}>
            y salta en modo emergencia
          </div>
          <div style={{ fontFamily: MONO, fontSize: 84, fontWeight: 700, color: COL.ambar }}>
            {Math.round(105 + (30 - 105) * p)}<span style={{ fontSize: 38, color: COL.tenue }}> ms</span>
          </div>
          <div style={{ fontFamily: SANS, fontSize: 29, color: COL.tenue, marginTop: 16 }}>
            tres veces más rápido
          </div>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 7. Generación tras generación ───────────────────────────────────── */
export function Generaciones() {
  const filas = [
    { g: '1', t: 'la aplastas fácil', c: COL.golpe },
    { g: '6', t: 'se te escapa a veces', c: COL.ambar },
    { g: '9', t: 'ya no la alcanzas', c: COL.mosca },
  ];
  return (
    <>
      <Rotulo color={COL.ambar}>generación tras generación</Rotulo>
      <Lienzo>
        {filas.map((r, i) => (
          <Fundido key={r.g} inicio={8 + i * 30} largo={16} style={{ marginBottom: 42, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 34, borderLeft: `7px solid ${r.c}`, paddingLeft: 30 }}>
              <span style={{ minWidth: 150, textAlign: 'center' }}>
                <span style={{ fontFamily: SANS, fontSize: 22, color: COL.tenue, letterSpacing: '.2em', display: 'block' }}>
                  MOSCA
                </span>
                <span style={{ fontFamily: MONO, fontSize: 76, fontWeight: 700, color: r.c }}>{r.g}</span>
              </span>
              <span style={{ fontFamily: SANS, fontSize: 42, fontWeight: 600, color: COL.tinta }}>{r.t}</span>
            </div>
          </Fundido>
        ))}
        <Fundido inicio={150} largo={18} style={{ marginTop: 30 }}>
          <Titular size={52} color={COL.ambar}>Y el que le enseñó<br />fuiste tú</Titular>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 8. Cansarla ─────────────────────────────────────────────────────── */
export function Cansarla() {
  const f = useCurrentFrame();
  let fat = 0;
  for (let i = 0; i < 7; i++) if (f > 26 + i * 18) fat = Math.min(1, fat * Math.exp(-18 / 50) + 0.32);
  // La recuperación arranca ya bien entrada la escena: la barra tiene que
  // verse llena mientras la voz dice que los golpes seguidos la agotan.
  const nivel = fat * (f > 212 ? Math.exp(-(f - 212) / 50) : 1);
  return (
    <>
      <Rotulo color={COL.golpe}>tu única salida</Rotulo>
      <Lienzo>
        <Titular size={62} style={{ marginBottom: 46 }}>Cansarla</Titular>
        <div style={{ width: 740, height: 44, borderRadius: 22, background: '#1d2028', overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ width: `${nivel * 100}%`, height: '100%', background: COL.ambar, borderRadius: 22 }} />
        </div>
        <div style={{ fontFamily: SANS, fontSize: 32, color: COL.tenue, textAlign: 'center', lineHeight: 1.45 }}>
          golpes seguidos la agotan…
        </div>
        <Fundido inicio={150} largo={16} style={{ marginTop: 34 }}>
          <div style={{ fontFamily: SANS, fontSize: 34, color: COL.golpe, textAlign: 'center', fontWeight: 600 }}>
            …pero se recupera<br />en dos segundos
          </div>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 9. Lo que NO es ─────────────────────────────────────────────────── */
export function Honesto() {
  return (
    <>
      <Rotulo>una aclaración que importa</Rotulo>
      <Lienzo>
        <Fundido inicio={0} largo={16} style={{ textAlign: 'center', marginBottom: 50 }}>
          <div style={{
            fontFamily: SANS, fontSize: 46, fontWeight: 700, color: COL.tenue,
            textDecoration: 'line-through', lineHeight: 1.35,
          }}>
            inteligencia artificial<br />aprendiendo de ejemplos
          </div>
        </Fundido>
        <Fundido inicio={64} largo={18} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: SANS, fontSize: 30, color: COL.tenue, letterSpacing: '.16em', marginBottom: 20 }}>
            LO QUE HAY ES
          </div>
          <Titular size={54} color={COL.mosca}>
            neuronas conectadas,<br />y sinapsis que se<br />fortalecen con el susto
          </Titular>
          <div style={{ fontFamily: SANS, fontSize: 31, color: COL.tenue, marginTop: 28 }}>
            igual que en el bicho de verdad
          </div>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 10. Cierre ──────────────────────────────────────────────────────── */
export function Cierre() {
  return (
    <Lienzo>
      <Fundido inicio={0} largo={16} style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 104, marginBottom: 26 }}>🪰</div>
        <Titular size={58}>Tírale un manotazo</Titular>
        <div style={{ fontFamily: MONO, fontSize: 30, color: COL.mosca, marginTop: 32, lineHeight: 1.7 }}>
          edreirbs.github.io/<br />entrenamiento-redes-neuronales
        </div>
      </Fundido>
    </Lienzo>
  );
}
