import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { COL, Contador, Fundido, Lienzo, MONO, Rotulo, SANS, Titular } from './piezas.jsx';

/* ── 1. Apertura ─────────────────────────────────────────────────────── */
export function Apertura() {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, 400], [1.06, 1.22]);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Img
          src={staticFile('img/m-cenital.png')}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: `scale(${zoom})`, opacity: 0.55,
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,7,11,.72) 0%, rgba(7,7,11,.35) 42%, rgba(7,7,11,.95) 100%)' }} />
      </div>
      <Lienzo>
        <Fundido inicio={6} largo={20}>
          <Titular size={56} color={COL.tenue} style={{ fontWeight: 600 }}>
            Mapearon el cerebro<br />completo de una mosca
          </Titular>
        </Fundido>
        <Fundido inicio={210} largo={18} style={{ marginTop: 42 }}>
          <Titular size={92}>MÁTALA<br />SI PUEDES</Titular>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 2. La escala del bicho ──────────────────────────────────────────── */
export function Escala() {
  const filas = [
    { n: 1408, t: 'neuronas', c: COL.mosca, d: 0 },
    { n: 4972, t: 'sinapsis', c: COL.mosca, d: 26 },
    { n: 2000, t: 'pasos por segundo', c: COL.ambar, d: 52 },
  ];
  return (
    <>
      <Rotulo>corriendo en tu navegador</Rotulo>
      <Lienzo>
        {filas.map((r) => (
          <Fundido key={r.t} inicio={r.d} largo={14} style={{ marginBottom: 46, textAlign: 'center' }}>
            <Contador hasta={r.n} inicio={r.d} dur={34}
              style={{ fontSize: 128, fontWeight: 700, color: r.c, letterSpacing: '-0.05em' }} />
            <div style={{ fontFamily: SANS, fontSize: 30, color: COL.tenue, letterSpacing: '.16em', textTransform: 'uppercase', marginTop: 4 }}>
              {r.t}
            </div>
          </Fundido>
        ))}
      </Lienzo>
    </>
  );
}

/* ── 3. La vía de escape ─────────────────────────────────────────────── */
const VIA = [
  { n: 'fotorreceptores', c: 192 },
  { n: 'lámina', c: 384 },
  { n: 'T5 · movimiento', c: 768 },
  { n: 'LPLC2 · LC4', c: 48 },
  { n: 'DNp01', c: 2, gigante: true },
  { n: 'motoneuronas', c: 10 },
];

export function Circuito() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Rotulo>cinco sinapsis entre el fotón y el músculo</Rotulo>
      <Lienzo style={{ justifyContent: 'center' }}>
        {VIA.map((p, i) => {
          const t0 = 14 + i * 26;
          const on = spring({ frame: f - t0, fps, config: { damping: 200 }, durationInFrames: 18 });
          const destello = p.gigante
            ? Math.max(0, Math.sin((f - t0) / 5)) * Math.max(0, 1 - (f - t0) / 90)
            : 0;
          const color = p.gigante ? COL.golpe : COL.mosca;
          return (
            <React.Fragment key={p.n}>
              {i > 0 && (
                <div style={{
                  width: 3, height: 26, background: COL.linea, opacity: on,
                  boxShadow: on > 0.5 ? `0 0 18px ${color}` : 'none',
                }} />
              )}
              <div style={{
                width: p.gigante ? 560 : 470, padding: '15px 26px', borderRadius: 14,
                border: `2px solid ${on > 0.4 ? color : COL.linea}`,
                background: p.gigante
                  ? `rgba(255,90,77,${0.10 + destello * 0.34})`
                  : `rgba(47,224,192,${on * 0.09})`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                opacity: 0.28 + on * 0.72,
                transform: `scale(${1 + destello * 0.05})`,
              }}>
                <span style={{
                  fontFamily: SANS, fontSize: p.gigante ? 40 : 33,
                  fontWeight: p.gigante ? 800 : 600,
                  color: on > 0.4 ? COL.tinta : COL.tenue,
                }}>{p.n}</span>
                <span style={{ fontFamily: MONO, fontSize: 27, color: on > 0.4 ? color : COL.linea }}>
                  {p.c}
                </span>
              </div>
              {p.gigante && (
                <Fundido inicio={t0 + 10} largo={12}>
                  <div style={{ fontFamily: SANS, fontSize: 26, color: COL.golpe, letterSpacing: '.18em', margin: '6px 0 2px' }}>
                    LA NEURONA GIGANTE
                  </div>
                </Fundido>
              )}
            </React.Fragment>
          );
        })}
      </Lienzo>
    </>
  );
}

/* ── 4. Lo que ella ve ───────────────────────────────────────────────── */
export function Retina() {
  const f = useCurrentFrame();
  const W = 16, H = 12, celda = 52;
  const r = interpolate(f, [16, 150], [0.6, 9.5], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  return (
    <>
      <Rotulo>el matamoscas sobre su retina simulada</Rotulo>
      <Lienzo>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${W}, ${celda}px)`, gap: 3 }}>
          {Array.from({ length: W * H }).map((_, i) => {
            const x = i % W, y = Math.floor(i / W);
            const d = Math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2);
            const lum = Math.min(1, Math.max(0, (d - r + 0.6) / 1.2));
            const c = Math.round(10 + lum * 78);
            return (
              <div key={i} style={{
                width: celda, height: celda, borderRadius: 5,
                background: `rgb(${Math.round(c * 0.3)},${Math.round(c * 0.92)},${Math.round(c * 0.85)})`,
              }} />
            );
          })}
        </div>
        <Fundido inicio={120} largo={14} style={{ marginTop: 40 }}>
          <div style={{ fontFamily: SANS, fontSize: 31, color: COL.tenue, textAlign: 'center' }}>
            Si le apuntas de lado, lo percibe distinto.
          </div>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 5. Aprende ──────────────────────────────────────────────────────── */
export function Aprende() {
  const f = useCurrentFrame();
  const p = interpolate(f, [40, 150], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const filas = [
    { t: 'reacción', de: 186, a: 161 },
    { t: 'despegue', de: 105, a: 30 },
  ];
  return (
    <>
      <Rotulo>aprende de cada intento tuyo</Rotulo>
      <Lienzo>
        {filas.map((r, i) => (
          <Fundido key={r.t} inicio={i * 16} largo={14} style={{ marginBottom: 64, textAlign: 'center' }}>
            <div style={{ fontFamily: SANS, fontSize: 30, color: COL.tenue, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10 }}>
              {r.t}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 26, justifyContent: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 74, color: COL.tenue, textDecoration: p > 0.5 ? 'line-through' : 'none', opacity: 1 - p * 0.55 }}>
                {r.de}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 46, color: COL.linea }}>→</span>
              <span style={{ fontFamily: MONO, fontSize: 104, fontWeight: 700, color: COL.mosca, letterSpacing: '-0.04em' }}>
                {Math.round(r.de + (r.a - r.de) * p)}
                <span style={{ fontSize: 40, color: COL.tenue }}> ms</span>
              </span>
            </div>
          </Fundido>
        ))}
      </Lienzo>
    </>
  );
}

/* ── 6. Las generaciones ─────────────────────────────────────────────── */
export function Generaciones() {
  const filas = [
    { g: 1, t: 'muere siempre', c: COL.golpe },
    { g: 6, t: 'se salva 3 de cada 10', c: COL.ambar },
    { g: 9, t: 'ya no la tocas', c: COL.mosca },
  ];
  return (
    <>
      <Rotulo color={COL.ambar}>generación tras generación</Rotulo>
      <Lienzo>
        {filas.map((r, i) => (
          <Fundido key={r.g} inicio={10 + i * 34} largo={16} style={{ marginBottom: 40, width: '100%' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 34,
              borderLeft: `7px solid ${r.c}`, paddingLeft: 30,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 92, fontWeight: 700, color: r.c, minWidth: 120 }}>
                {r.g}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 42, fontWeight: 600, color: COL.tinta }}>
                {r.t}
              </span>
            </div>
          </Fundido>
        ))}
        <Fundido inicio={190} largo={18} style={{ marginTop: 26 }}>
          <Titular size={48} color={COL.ambar}>Estás entrenando<br />a tu propia enemiga</Titular>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 7. El contragolpe ───────────────────────────────────────────────── */
export function Contragolpe() {
  const f = useCurrentFrame();
  // Cada golpe sube la fatiga de golpe y luego se disipa, como en el juego.
  let fat = 0;
  for (let i = 0; i < 7; i++) {
    const t = 30 + i * 20;
    if (f > t) fat = Math.min(1, fat * Math.exp(-(20) / 54) + 0.30);
  }
  const disipa = f > 170 ? Math.exp(-(f - 170) / 54) : 1;
  const nivel = fat * disipa;
  return (
    <>
      <Rotulo color={COL.golpe}>tu contragolpe: agotarla</Rotulo>
      <Lienzo>
        <div style={{ fontFamily: SANS, fontSize: 34, color: COL.tenue, marginBottom: 36, textAlign: 'center' }}>
          Golpes seguidos habitúan sus sinapsis
        </div>
        <div style={{ width: 760, height: 40, borderRadius: 20, background: '#1d2028', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ width: `${nivel * 100}%`, height: '100%', background: COL.ambar, borderRadius: 20 }} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 34, color: COL.ambar, marginBottom: 54 }}>
          agotamiento {Math.round(nivel * 100)}%
        </div>
        <Fundido inicio={130} largo={16} style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: SANS, fontSize: 31, color: COL.tenue, marginBottom: 12 }}>
            y vuelve al despegue lento
          </div>
          <div style={{ fontFamily: MONO, fontSize: 86, fontWeight: 700, color: COL.golpe }}>
            30 <span style={{ color: COL.linea, fontSize: 44 }}>→</span> 104 <span style={{ fontSize: 36, color: COL.tenue }}>ms</span>
          </div>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 8. Qué es real y qué es nuestro ─────────────────────────────────── */
export function Honestidad() {
  const real = ['el cableado del circuito', 'la sensibilización', 'el despegue corto'];
  const nuestro = ['las constantes de tiempo', 'el sesgo direccional'];
  return (
    <>
      <Rotulo>sin backpropagation</Rotulo>
      <Lienzo>
        <div style={{ display: 'flex', gap: 40, width: '100%', marginBottom: 46 }}>
          {[{ t: 'DOCUMENTADO', l: real, c: COL.mosca }, { t: 'MODELO NUESTRO', l: nuestro, c: COL.ambar }].map((col, ci) => (
            <Fundido key={col.t} inicio={ci * 22} largo={14} style={{ flex: 1 }}>
              <div style={{
                fontFamily: SANS, fontSize: 23, letterSpacing: '.16em', color: col.c,
                fontWeight: 700, marginBottom: 18, borderBottom: `2px solid ${col.c}`, paddingBottom: 10,
              }}>{col.t}</div>
              {col.l.map((x) => (
                <div key={x} style={{ fontFamily: SANS, fontSize: 28, color: COL.tinta, marginBottom: 14, lineHeight: 1.3 }}>
                  {x}
                </div>
              ))}
            </Fundido>
          ))}
        </div>
        <Fundido inicio={120} largo={18} style={{ width: '100%' }}>
          <div style={{
            border: `2px solid ${COL.linea}`, borderRadius: 16, padding: '26px 30px',
            background: 'rgba(255,90,77,.06)',
          }}>
            <div style={{ fontFamily: SANS, fontSize: 23, letterSpacing: '.16em', color: COL.golpe, fontWeight: 700, marginBottom: 12 }}>
              LO QUE NO FUNCIONÓ
            </div>
            <div style={{ fontFamily: SANS, fontSize: 29, color: COL.tinta, lineHeight: 1.35 }}>
              Una ronda de rastreo de olor. La medimos contra no hacer nada:
              <span style={{ color: COL.golpe, fontWeight: 700 }}> mismo resultado</span>. La quitamos.
            </div>
          </div>
        </Fundido>
      </Lienzo>
    </>
  );
}

/* ── 9. Cierre ───────────────────────────────────────────────────────── */
export function Cierre() {
  return (
    <Lienzo>
      <Fundido inicio={0} largo={16} style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 96, marginBottom: 26 }}>🪰</div>
        <Titular size={62}>Mátala si puedes</Titular>
        <div style={{
          fontFamily: MONO, fontSize: 31, color: COL.mosca, marginTop: 30, lineHeight: 1.7,
        }}>
          edreirbs.github.io/<br />entrenamiento-redes-neuronales
        </div>
      </Fundido>
    </Lienzo>
  );
}
