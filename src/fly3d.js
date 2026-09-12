/**
 * Mosca de la fruta en 3D, construida por geometría.
 *
 * Lo importante no es el bicho: es que dentro de la cabeza va el circuito
 * real, neurona por neurona, colocado más o menos donde va en el animal —
 * los fotorreceptores pegados a los ojos, las T5 detrás, la convergencia
 * al fondo y la neurona gigante bajando al tórax por su axón. Cuando el
 * circuito dispara, se ve disparar.
 */
import * as THREE from '../vendor/three.module.js';

const BODY = 0x3f3f4a;
const HEAD_Z = 0.29;   // el cerebro va detrás de los ojos, no delante
const BASE_Y = 0.185;  // altura del cuerpo cuando camina

function geo0(pos, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const EYE = 0x7d1620;

export class Fly3D {
  /**
   * @param {object} layout   Layout del circuito de escape
   * @param {number} accent   color de acento de este competidor
   */
  constructor(layout, accent) {
    this.layout = layout;
    this.accent = new THREE.Color(accent);
    this.group = new THREE.Group();
    this.t = 0;
    this.state = 'walk';
    this.timer = 1;
    this.yaw = 0;
    this.speed = 0.2;
    this.alive = true;
    this.wingSpeed = 34;
    this.bounds = { x: 1.9, z: 1.2 };
    this.veto = null;              // huella del panel: zona de mesa donde no entra

    this.build();
    // Sólo la mosca simulada lleva cerebro visible. La del jugador es una
    // mosca y ya: enseñarle neuronas encendidas sería mentir sobre quién
    // está decidiendo.
    if (layout) this.setBrain(layout, 'escape');
  }

  /**
   * Pinta las rayas sobre una textura en vez de pegarles geometría encima.
   * Con SphereGeometry rotada +90° en X los polos quedan sobre el eje del
   * cuerpo, u recorre la circunferencia y la línea dorsal cae justo en
   * u = 0.75. Por eso las bandas van centradas ahí.
   */
  static quitinaTex(base, rayas, bandas) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 256, 128);
    for (const [u, ancho, color, v0, v1] of rayas) {
      g.fillStyle = color;
      g.fillRect(u * 256 - ancho * 128, v0 * 128, ancho * 256, (v1 - v0) * 128);
    }
    for (const [v, alto, color] of bandas) {
      g.fillStyle = color;
      g.fillRect(0, v * 128 - alto * 64, 256, alto * 128);
    }
    // Grano: la quitina no es plástico liso.
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.10})`;
      g.fillRect(Math.random() * 256, Math.random() * 128, 1.4, 1.4);
    }
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    return t;
  }

  /** Retícula de omatidios: sin ella los ojos parecen dos canicas de plástico. */
  static omatidiosTex() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#7c1a1e'; g.fillRect(0, 0, 256, 256);
    const paso = 7.2;
    for (let fila = 0; fila * paso * 0.87 < 262; fila++) {
      for (let col = 0; col * paso < 262; col++) {
        const x = col * paso + (fila % 2 ? paso / 2 : 0);
        const y = fila * paso * 0.87;
        const t = 0.72 + Math.random() * 0.3;
        g.fillStyle = `rgba(${Math.round(168 * t)},${Math.round(40 * t)},${Math.round(44 * t)},1)`;
        g.beginPath(); g.arc(x, y, paso * 0.40, 0, 6.2832); g.fill();
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    return t;
  }

  build() {
    // Proporciones de mosca doméstica: cuerpo rechoncho, tórax ancho y
    // jorobado, abdomen corto y romo, y una cabeza que es casi toda ojo.
    const quitina = (color, opacity) => new THREE.MeshStandardMaterial({
      color, roughness: 0.38, metalness: 0.35,
      transparent: true, opacity, depthWrite: false,
    });
    const torax = quitina(0x6a6a76, 0.9);
    torax.map = Fly3D.quitinaTex('#6a6a76', [
      [0.705, 0.020, '#20202a', 0.12, 0.9], [0.737, 0.018, '#20202a', 0.12, 0.9],
      [0.767, 0.018, '#20202a', 0.12, 0.9], [0.799, 0.020, '#20202a', 0.12, 0.9],
    ], []);
    const abdomen = quitina(0xb08a52, 0.9);
    abdomen.map = Fly3D.quitinaTex('#b08a52', [
      [0.75, 0.115, '#4a3a20', 0.0, 1.0],
    ], [[0.34, 0.035, '#4a3a20'], [0.56, 0.035, '#4a3a20'], [0.76, 0.035, '#4a3a20']]);
    const oscuro = new THREE.MeshStandardMaterial({
      color: 0x1e1e24, roughness: 0.5, metalness: 0.3,
      transparent: true, opacity: 0.92, depthWrite: false,
    });

    // ── Abdomen: corto, ancho y terminado en punta roma.
    const abdGeo = new THREE.SphereGeometry(0.20, 30, 22);
    abdGeo.rotateX(Math.PI / 2);
    const abd = new THREE.Mesh(abdGeo, abdomen);
    abd.scale.set(0.95, 0.80, 1.16);
    abd.position.z = -0.37;
    abd.castShadow = true;
    this.group.add(abd);

    // ── Tórax: lo más voluminoso del bicho.
    const thxGeo = new THREE.SphereGeometry(0.215, 30, 22);
    thxGeo.rotateX(Math.PI / 2);
    const thx = new THREE.Mesh(thxGeo, torax);
    thx.scale.set(0.96, 0.88, 1.02);
    thx.castShadow = true;
    this.group.add(thx);

    // Escudete: la placa triangular del final del tórax.
    const esc = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), torax);
    esc.scale.set(1, 0.55, 0.7);
    esc.position.set(0, 0.10, -0.175);
    this.group.add(esc);

    // ── Cabeza. Traslúcida a propósito: adentro va el circuito.
    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(0.185, 28, 20),
      new THREE.MeshStandardMaterial({
        color: 0x2a2a32, roughness: 0.3, metalness: 0.25,
        transparent: true, opacity: 0.26, depthWrite: false,
      }),
    );
    this.head.scale.set(1.04, 0.92, 0.78);
    this.head.position.z = 0.335;
    this.group.add(this.head);

    // ── Ojos compuestos: enormes, rojos y casi tocándose en la frente.
    const eyeMat = new THREE.MeshStandardMaterial({
      map: Fly3D.omatidiosTex(), color: 0xffffff,
      roughness: 0.46, metalness: 0.18,
      emissive: 0x33060a, emissiveIntensity: 0.35,
    });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.134, 28, 22), eyeMat);
      eye.scale.set(0.78, 0.98, 0.94);
      eye.position.set(s * 0.096, 0.028, 0.330);
      eye.castShadow = true;
      this.group.add(eye);
    }
    // Trompa: lo que usa para sorber la fruta pasada.
    const tromp = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.052, 0.10, 10), oscuro);
    tromp.position.set(0, -0.085, 0.40);
    tromp.rotation.x = 0.5;
    this.group.add(tromp);
    for (const s of [-1, 1]) {
      const ant = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.035, 4, 8), oscuro);
      ant.position.set(s * 0.035, -0.015, 0.455);
      ant.rotation.x = 1.3;
      this.group.add(ant);
    }

    // ── Cerdas. Son el detalle que más dice "mosca": el bicho está erizado.
    const pts = [];
    const erizar = (cx, cy, cz, rx, ry, rz, n, largo) => {
      for (let i = 0; i < n; i++) {
        const u = Math.acos(1 - 2 * (i + 0.5) / n);
        const v = i * 2.399963;
        const nx = Math.sin(u) * Math.cos(v), ny = Math.cos(u), nz = Math.sin(u) * Math.sin(v);
        if (ny < -0.35) continue;                       // no salen de la panza
        pts.push(new THREE.Vector3(cx + nx * rx, cy + ny * ry, cz + nz * rz));
        pts.push(new THREE.Vector3(
          cx + nx * rx * (1 + largo), cy + ny * ry * (1 + largo) + largo * 0.05, cz + nz * rz * (1 + largo)));
      }
    };
    erizar(0, 0, 0, 0.207, 0.19, 0.22, 46, 0.34);
    erizar(0, 0, -0.40, 0.186, 0.156, 0.264, 40, 0.28);
    const cerdas = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x15151a, transparent: true, opacity: 0.85 }),
    );
    this.group.add(cerdas);

    // ── Alas: largas, sobrepasan el abdomen, con nervaduras.
    const wcv = document.createElement('canvas');
    wcv.width = 256; wcv.height = 96;
    const wg = wcv.getContext('2d');
    wg.fillStyle = 'rgba(214,232,255,0.30)'; wg.fillRect(0, 0, 256, 96);
    wg.strokeStyle = 'rgba(120,150,190,0.55)'; wg.lineWidth = 1.6;
    for (const [y0, y1, c] of [[30, 20, 30], [44, 40, 46], [58, 62, 58], [70, 80, 74]]) {
      wg.beginPath(); wg.moveTo(6, 48);
      wg.bezierCurveTo(80, c, 170, y1, 250, y0); wg.stroke();
    }
    wg.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      wg.beginPath(); wg.moveTo(110 + i * 32, 26); wg.lineTo(118 + i * 32, 72); wg.stroke();
    }
    const wingTex = new THREE.CanvasTexture(wcv);

    const wingGeo = new THREE.CircleGeometry(0.42, 26);
    wingGeo.rotateX(-Math.PI / 2);
    wingGeo.scale(0.30, 1, 1.0);
    wingGeo.translate(0, 0, -0.42);
    const wingMat = new THREE.MeshStandardMaterial({
      map: wingTex, roughness: 0.05, metalness: 0,
      transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false,
    });
    this.wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.075, 0.17, -0.06);
      pivot.add(new THREE.Mesh(wingGeo, wingMat));
      pivot.rotation.y = s * 0.30;
      this.group.add(pivot);
      this.wings.push({ pivot, s });
    }

    // Balancines: los giroscopios que le quedaron en lugar del segundo par de alas.
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), oscuro);
      h.position.set(s * 0.105, 0.02, -0.19);
      this.group.add(h);
    }

    // ── Patas: cortas, gruesas y en tres tramos.
    const legMat = new THREE.MeshStandardMaterial({ color: 0x191920, roughness: 0.75 });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Group();
        const z = 0.13 - i * 0.16;
        const fem = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.015, 0.16, 7), legMat);
        fem.position.set(s * 0.135, -0.055, z);
        fem.rotation.z = s * 1.1;
        fem.rotation.x = (i - 1) * 0.38;
        leg.add(fem);
        const tib = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.009, 0.17, 7), legMat);
        tib.position.set(s * 0.205, -0.135, z + (i - 1) * 0.055);
        tib.rotation.z = s * 0.3;
        tib.rotation.x = (i - 1) * 0.22;
        leg.add(tib);
        const tar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.10, 6), legMat);
        tar.position.set(s * 0.232, -0.208, z + (i - 1) * 0.085);
        tar.rotation.z = s * 0.9;
        leg.add(tar);
        this.group.add(leg);
      }
    }

    this.group.position.y = BASE_Y;
  }

  /**
   * Construye (o reconstruye) el cerebro visible para el circuito que esté
   * corriendo. Hay que rehacerlo al cambiar de ronda: cada circuito tiene sus
   * propias poblaciones, y dejar encendido el anterior sería pintar actividad
   * que no está ocurriendo.
   */
  setBrain(layout, kind) {
    this.layout = layout;
    if (this.brain) {
      this.group.remove(this.brain);
      this.brain.geometry.dispose();
      this.brain.material.dispose();
    }
    if (this.axonLine) { this.axonLine.visible = kind === 'escape'; }
    this.kind = kind;
    this.buildBrain(kind);
  }

  buildBrain(kind = 'escape') {
    const L = this.layout;
    const n = L.n;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);

    const put = (i, x, y, z) => { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; };
    const pops = L.pops;
    const cluster0 = (pop, cx, cy, cz, spread, flat = 1) => {
      for (let i = pop.start; i < pop.end; i++) {
        const k = i - pop.start;
        const a = k * 2.399963;
        const r = spread * Math.sqrt(k / pop.size);
        put(i, cx + r * Math.cos(a), cy + r * Math.sin(a) * flat, cz + (k % 7 - 3) * spread * 0.06);
      }
    };

    if (kind === 'memory') {
      // Cuerpo fungiforme: las PN entran por delante, las células de Kenyon
      // forman el cáliz dorsal y los MBON salen por debajo.
      cluster0(pops.PN, 0, -0.03, HEAD_Z + 0.045, 0.075);
      cluster0(pops.KC, 0, 0.055, HEAD_Z - 0.055, 0.095, 0.75);
      cluster0(pops.MBON, 0, -0.055, HEAD_Z - 0.10, 0.035);
      return this.finishBrain(geo0(pos, col), col);
    }

    // Fotorreceptores y lámina: cascarón detrás de cada ojo.
    const shell = (pop, r0, r1) => {
      for (let i = pop.start; i < pop.end; i++) {
        const k = i - pop.start;
        const side = k % 2 ? 1 : -1;
        const a = (k / pop.size) * Math.PI * 12;
        const t = (k / pop.size);
        const r = r0 + (r1 - r0) * t;
        put(i,
          side * (0.05 + 0.055 * Math.cos(a)) + side * 0.03,
          0.02 + 0.07 * Math.sin(a * 0.7),
          HEAD_Z + r);
      }
    };
    shell(pops.R, 0.075, 0.055);
    shell(pops.LMC, 0.045, 0.02);
    shell(pops.LMCs, 0.02, -0.005);

    // T5: banda ancha en medio de la cabeza.
    for (let i = pops.T5.start; i < pops.T5.end; i++) {
      const k = i - pops.T5.start;
      const a = k * 2.399963;                      // ángulo áureo: reparto parejo
      const r = 0.105 * Math.sqrt((k % 192) / 192);
      const side = (k % 2) ? 1 : -1;
      put(i, side * 0.045 + r * Math.cos(a) * 0.8, r * Math.sin(a), HEAD_Z - 0.02 - (k / pops.T5.size) * 0.05);
    }

    // LPLC2 y LC4: convergencia hacia el centro, al fondo.
    const cluster = (pop, z, spread) => {
      for (let i = pop.start; i < pop.end; i++) {
        const k = i - pop.start;
        const a = k * 2.399963;
        const r = spread * Math.sqrt(k / pop.size);
        put(i, r * Math.cos(a), r * Math.sin(a) * 0.7, z);
      }
    };
    cluster(pops.LC4, HEAD_Z - 0.075, 0.07);
    cluster(pops.LPLC2, HEAD_Z - 0.095, 0.055);

    // La neurona gigante: dos somas grandes al fondo de la cabeza.
    for (let i = pops.DNp01.start; i < pops.DNp01.end; i++) {
      put(i, (i - pops.DNp01.start ? 1 : -1) * 0.028, -0.01, HEAD_Z - 0.125);
    }
    cluster(pops.DNp02, HEAD_Z - 0.19, 0.04);
    // Motoneuronas: ya en el tórax.
    cluster(pops.MN, 0.02, 0.09);

    return this.finishBrain(geo0(pos, col), col);
  }

  finishBrain(geo, col) {
    this.brainColors = col;
    this.brain = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.022, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
      sizeAttenuation: true,
    }));
    this.brain.renderOrder = 20;
    this.group.add(this.brain);
    if (this.axonLine) return;

    // El axón de la neurona gigante bajando al tórax, que es lo que la hace
    // la vía de escape más corta que se conoce.
    const axon = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.01, HEAD_Z - 0.13),
      new THREE.Vector3(0, -0.01, 0.05),
      new THREE.Vector3(0, -0.02, 0.0),
    ]);
    this.axonMat = new THREE.LineBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.2 });
    this.axonLine = new THREE.Line(axon, this.axonMat);
    this.axonLine.renderOrder = 21;
    this.group.add(this.axonLine);

    // Destello para el momento del disparo.
    this.flashLight = new THREE.PointLight(0xff2d55, 0, 2.4);
    this.flashLight.position.set(0, 0.05, HEAD_Z - 0.1);
    this.group.add(this.flashLight);
    this.flash = 0;
  }

  /** Pinta el cerebro con la traza de actividad de la simulación. */
  paintBrain(trace) {
    if (!this.brainColors) return;
    const c = this.brainColors;
    const a = this.accent;
    for (let i = 0; i < trace.length; i++) {
      const v = trace[i];
      // El acento manda: con mezcla aditiva, sumarle blanco a la actividad
      // convierte cualquier zona densa en una mancha blanca sin color.
      const k = v < 0.02 ? 0.08 : 0.13 + v * 0.55;
      c[i * 3] = a.r * k + 0.02;
      c[i * 3 + 1] = a.g * k + 0.03;
      c[i * 3 + 2] = a.b * k + 0.05;
    }
    // La neurona gigante se pinta sola, en rojo. Sólo existe en el escape.
    const gf = this.layout.pops.DNp01;
    if (!gf) { this.brain.geometry.attributes.color.needsUpdate = true; return; }
    for (let i = gf.start; i < gf.end; i++) {
      const v = trace[i];
      c[i * 3] = 0.40 + v * 1.1; c[i * 3 + 1] = 0.03 + v * 0.18; c[i * 3 + 2] = 0.10 + v * 0.3;
    }
    this.brain.geometry.attributes.color.needsUpdate = true;
  }

  fire() { if (this.flashLight) this.flash = 1; }

  // ─── Conducta ──────────────────────────────────────────────────────
  // Caminar, acicalarse y escapar. La mosca que se queda quieta no da miedo;
  // la que se pasea por la mesa mientras la acechas, sí.

  place(x, z, yaw = Math.random() * 6.28) {
    this.group.position.set(x, BASE_Y, z);
    this.yaw = yaw;
    this.group.rotation.set(0, yaw, 0);
    this.group.scale.setScalar(this.baseScale ?? 1);
    this.state = 'walk';
    this.timer = 0.6 + Math.random() * 1.4;
    this.speed = 0.16 + Math.random() * 0.1;
    this.alive = true;
  }

  /**
   * ¿Está ese punto bajo el panel de la interfaz? Ahí no se le ve ni se le puede
   * pegar, así que para el juego es como si no existiera la mesa.
   */
  vetado(x, z) {
    const v = this.veto;
    return !!v && x > v.x0 && x < v.x1 && z > v.z0 && z < v.z1;
  }

  /** Saca un punto de la zona vetada por el lado más cercano. */
  sacaDelVeto(p) {
    const v = this.veto;
    if (!v || !this.vetado(p.x, p.z)) return p;
    const salidas = [
      { x: v.x0, z: p.z, d: p.x - v.x0 }, { x: v.x1, z: p.z, d: v.x1 - p.x },
      { x: p.x, z: v.z0, d: p.z - v.z0 }, { x: p.x, z: v.z1, d: v.z1 - p.z },
    ];
    const mejor = salidas.reduce((a, b) => (b.d < a.d ? b : a));
    return { x: mejor.x, z: mejor.z };
  }

  /** Escapa en la dirección dada, que le llega del propio circuito. */
  escape(dx, dz, bounds) {
    if (!this.alive || this.state === 'escape') return;
    const m = Math.hypot(dx, dz) || 1;
    this.state = 'escape';
    this.escT = 0;
    this.escDur = 0.62;
    this.from = this.group.position.clone();
    const dist = 0.85 + Math.random() * 0.55;
    this.to = this.sacaDelVeto({
      x: Math.max(-bounds.x, Math.min(bounds.x, this.from.x + (dx / m) * dist)),
      z: Math.max(-bounds.z, Math.min(bounds.z, this.from.z + (dz / m) * dist)),
    });
    this.yaw = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
  }

  splat() {
    if (!this.alive) return;
    this.alive = false;
    this.state = 'dead';
    this.deadT = 0;
  }

  update(dt) {
    this.t += dt;
    const walking = this.state === 'walk';
    const flying = this.state === 'escape';

    // Alas: quietas al caminar, borrón al escapar.
    const amp = flying ? 1.2 : walking ? 0.05 : 0.02;
    const sp = flying ? this.wingSpeed * 2.6 : 3;
    for (const { pivot, s } of this.wings) {
      const beat = Math.sin(this.t * sp);
      pivot.rotation.y = s * (0.30 + amp * 0.62 * (0.5 + 0.5 * beat));
      pivot.rotation.x = flying ? beat * 0.55 : 0;
    }

    if (this.state === 'walk') {
      this.timer -= dt;
      if (this.timer <= 0) {
        // De vez en cuando se para a acicalarse: es lo que hacen todo el día.
        if (Math.random() < 0.42) { this.state = 'groom'; this.timer = 0.9 + Math.random() * 1.3; }
        else { this.yaw += (Math.random() - 0.5) * 2.2; this.timer = 0.7 + Math.random() * 1.6; }
      }
      const b = this.bounds ?? { x: 1.9, z: 1.2 };
      const nx = this.group.position.x + Math.sin(this.yaw) * this.speed * dt;
      const nz = this.group.position.z + Math.cos(this.yaw) * this.speed * dt;
      const fuera = Math.abs(nx) > b.x || Math.abs(nz) > b.z;
      if (fuera || this.vetado(nx, nz)) this.yaw += 2.2 + Math.random();
      else { this.group.position.x = nx; this.group.position.z = nz; }
      this.group.position.y = BASE_Y + Math.sin(this.t * 13) * 0.003;
      this.group.rotation.y += (this.yaw - this.group.rotation.y) * Math.min(1, dt * 7);
      this.group.rotation.z = Math.sin(this.t * 11) * 0.03;

    } else if (this.state === 'groom') {
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'walk'; this.timer = 0.8 + Math.random() * 1.6; }
      this.group.position.y = BASE_Y + Math.sin(this.t * 3) * 0.004;
      this.group.rotation.z = Math.sin(this.t * 16) * 0.09;
      this.group.rotation.x = Math.sin(this.t * 13) * 0.05;

    } else if (this.state === 'escape') {
      this.escT += dt;
      const u = Math.min(1, this.escT / this.escDur);
      this.group.position.x = this.from.x + (this.to.x - this.from.x) * u;
      this.group.position.z = this.from.z + (this.to.z - this.from.z) * u;
      this.group.position.y = BASE_Y + Math.sin(u * Math.PI) * 0.92;
      this.group.rotation.y = this.yaw;
      this.group.rotation.x = -Math.sin(u * Math.PI) * 0.5;
      this.group.rotation.z = Math.sin(u * 6) * 0.12;
      if (u >= 1) { this.state = 'walk'; this.timer = 0.5 + Math.random(); }

    } else if (this.state === 'dead') {
      this.deadT += dt;
      const u = Math.min(1, this.deadT / 0.16);
      const k = this.baseScale ?? 1;
      this.group.scale.set(k * (1 + u * 0.6), k * (1 - u * 0.85), k * (1 + u * 0.6));
      this.group.position.y = BASE_Y - u * 0.14;
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      this.flashLight.intensity = this.flash * 3.5;
      this.axonMat.opacity = 0.2 + this.flash * 0.8;
    }
  }
}
