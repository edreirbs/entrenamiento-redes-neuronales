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

const BODY = 0x35353e;
const HEAD_Z = 0.30;   // posición de la cabeza sobre el eje del cuerpo

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
    this.state = 'idle';
    this.jumpT = 0;
    this.squashT = 0;
    this.wingSpeed = 34;

    this.build();
    // Sólo la mosca simulada lleva cerebro visible. La del jugador es una
    // mosca y ya: enseñarle neuronas encendidas sería mentir sobre quién
    // está decidiendo.
    if (layout) this.setBrain(layout, 'escape');
  }

  build() {
    // Todo el cuerpo es translúcido y no escribe profundidad: así el circuito
    // de adentro se ve a través de él, que es de lo que trata la pieza.
    const shell = (opacity) => new THREE.MeshStandardMaterial({
      color: BODY, roughness: 0.34, metalness: 0.55,
      transparent: true, opacity, depthWrite: false,
    });
    const body = shell(0.62);
    const bodyGlow = shell(0.42);

    // ── Abdomen, con sus anillos.
    const abd = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 18), body);
    abd.scale.set(0.92, 0.86, 1.75);
    abd.position.z = -0.40;
    abd.castShadow = true;
    this.group.add(abd);
    for (let i = 0; i < 3; i++) {
      const r = 0.150 - i * 0.026;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.009, 8, 24), body);
      ring.position.z = -0.30 - i * 0.155;
      ring.scale.set(0.94, 0.87, 1);   // sigue el perfil del abdomen, no lo desborda
      this.group.add(ring);
    }

    // ── Tórax.
    const thx = new THREE.Mesh(new THREE.SphereGeometry(0.20, 24, 18), bodyGlow);
    thx.scale.set(1, 0.95, 1.25);
    thx.castShadow = true;
    this.group.add(thx);

    // ── Cabeza, translúcida para que se vea el cerebro.
    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(0.172, 28, 20),
      new THREE.MeshStandardMaterial({
        color: 0x20202a, roughness: 0.25, metalness: 0.3,
        transparent: true, opacity: 0.22, depthWrite: false,
      }),
    );
    this.head.scale.set(1.12, 1, 0.86);
    this.head.position.z = 0.30;
    this.group.add(this.head);

    // ── Ojos compuestos: en una mosca real se comen casi toda la cabeza.
    const eyeMat = new THREE.MeshStandardMaterial({
      color: EYE, roughness: 0.22, metalness: 0.55,
      emissive: 0x3a070c, emissiveIntensity: 0.35,
    });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), eyeMat);
      eye.scale.set(0.82, 1.2, 1.05);
      eye.position.set(s * 0.098, 0.012, 0.302);
      eye.castShadow = true;
      this.group.add(eye);
    }

    // ── Alas. Baten a ~200 Hz en el animal; aquí se ven como un borrón.
    const wingGeo = new THREE.CircleGeometry(0.32, 24);
    wingGeo.rotateX(-Math.PI / 2);         // acostada sobre el cuerpo
    wingGeo.scale(0.34, 1, 1.05);          // angosta y larga
    wingGeo.translate(0, 0, -0.33);        // nace en el pivote y va hacia atrás
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xbcd8ff, roughness: 0.05, metalness: 0,
      transparent: true, opacity: 0.085, side: THREE.DoubleSide, depthWrite: false,
    });
    this.wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.07, 0.155, -0.04);
      pivot.add(new THREE.Mesh(wingGeo, wingMat));
      pivot.rotation.y = s * 0.30;
      this.group.add(pivot);
      this.wings.push({ pivot, s });
    }

    // ── Balancines: los giroscopios de la mosca.
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), body);
      h.position.set(s * 0.1, 0.03, -0.2);
      this.group.add(h);
    }

    // ── Patas.
    this.legs = [];
    const legMat = new THREE.MeshStandardMaterial({ color: 0x17171c, roughness: 0.7 });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Group();
        const z = 0.14 - i * 0.17;
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.17, 6), legMat);
        upper.position.set(s * 0.125, -0.075, z);
        upper.rotation.z = s * 1.05;
        upper.rotation.x = (i - 1) * 0.34;
        leg.add(upper);
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.20, 6), legMat);
        lower.position.set(s * 0.195, -0.165, z + (i - 1) * 0.05);
        lower.rotation.z = s * 0.18;
        leg.add(lower);
        this.group.add(leg);
        this.legs.push(leg);
      }
    }

    this.group.position.y = 0.24;
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
      size: 0.028, vertexColors: true, transparent: true, opacity: 0.92,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
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
    this.axonMat = new THREE.LineBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.2, depthTest: false });
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
      const k = v < 0.02 ? 0.10 : 0.16 + v * 0.62;
      c[i * 3] = a.r * k + 0.02;
      c[i * 3 + 1] = a.g * k + 0.03;
      c[i * 3 + 2] = a.b * k + 0.05;
    }
    // La neurona gigante se pinta sola, en rojo. Sólo existe en el escape.
    const gf = this.layout.pops.DNp01;
    if (!gf) { this.brain.geometry.attributes.color.needsUpdate = true; return; }
    for (let i = gf.start; i < gf.end; i++) {
      const v = trace[i];
      c[i * 3] = 0.55 + v * 1.6; c[i * 3 + 1] = 0.04 + v * 0.25; c[i * 3 + 2] = 0.14 + v * 0.4;
    }
    this.brain.geometry.attributes.color.needsUpdate = true;
  }

  fire() { if (this.flashLight) this.flash = 1; }

  jump() { if (this.state === 'idle') { this.state = 'jump'; this.jumpT = 0; } }

  squash() { if (this.state !== 'jump') { this.state = 'squashed'; this.squashT = 0; } }

  /** Salta hasta un punto de la mesa. Se usa para elegir terrón de azúcar. */
  hopTo_(x, z) {
    this.hopFrom = { x: this.group.position.x, z: this.group.position.z };
    this.hopTo = { x, z };
    this.hopYaw = Math.atan2(x - this.hopFrom.x, z - this.hopFrom.z);
    this.hopT = 0;
    this.state = 'hop';
  }

  reset() {
    this.state = 'idle'; this.jumpT = 0; this.squashT = 0; this.flash = 0;
    this.group.position.set(this.baseX ?? this.group.position.x, 0.24, 0);
    this.group.rotation.set(0, this.baseYaw ?? 0, 0);
    const k = this.baseScale ?? 1;
    this.group.scale.set(k, k, k);
  }

  update(dt) {
    this.t += dt;

    // Alas: en reposo casi quietas, en pleno salto un borrón.
    const flying = this.state === 'jump' || this.state === 'hop';
    const amp = flying ? 1.15 : 0.06;
    const sp = flying ? this.wingSpeed * 2.4 : 3;
    for (const { pivot, s } of this.wings) {
      const beat = Math.sin(this.t * sp);
      pivot.rotation.y = s * (0.30 + amp * 0.62 * (0.5 + 0.5 * beat));
      pivot.rotation.x = flying ? beat * 0.55 : 0;
    }

    if (this.state === 'idle') {
      // respiración mínima, para que no parezca un juguete
      this.group.position.y = 0.24 + Math.sin(this.t * 2.1) * 0.004;
      this.group.rotation.z = Math.sin(this.t * 1.3) * 0.02;
    } else if (this.state === 'jump') {
      this.jumpT += dt;
      const u = Math.min(1, this.jumpT / 0.85);
      this.group.position.y = 0.24 + Math.sin(u * Math.PI) * 1.9 + u * 0.5;
      this.group.position.x = this.baseX + u * u * 0.55 * (this.dir ?? 1);
      this.group.rotation.x = -u * 0.7;
      this.group.rotation.z = u * 0.5 * (this.dir ?? 1);
    } else if (this.state === 'squashed') {
      this.squashT += dt;
      const u = Math.min(1, this.squashT / 0.18);
      const k = this.baseScale ?? 1;
      this.group.scale.set(k * (1 + u * 0.55), k * (1 - u * 0.82), k * (1 + u * 0.55));
      this.group.position.y = 0.24 - u * 0.17;
    }

    if (this.state === 'hop') {
      this.hopT += dt;
      const u = Math.min(1, this.hopT / 0.62);
      this.group.position.x = this.hopFrom.x + (this.hopTo.x - this.hopFrom.x) * u;
      this.group.position.z = this.hopFrom.z + (this.hopTo.z - this.hopFrom.z) * u;
      this.group.position.y = 0.24 + Math.sin(u * Math.PI) * 0.75;
      this.group.rotation.y = this.hopYaw;
      if (u >= 1) this.state = 'landed';
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      this.flashLight.intensity = this.flash * 3.5;
      this.axonMat.opacity = 0.15 + this.flash * 0.85;
    }
  }
}
