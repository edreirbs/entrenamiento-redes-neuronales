/**
 * La mesa: una mosca, un matamoscas y nada más.
 *
 * El matamoscas sigue al cursor y baja a velocidad constante DENTRO de cada
 * golpe, así que su tamaño angular crece exactamente como el estímulo que se
 * le inyecta al circuito. Lo que ves caer y lo que la mosca "ve" son la misma
 * cosa, y por eso apuntar de lado también cambia lo que ella percibe. Lo que
 * cambia de un golpe a otro es cuánto tarda en bajar: eso lo decide la
 * velocidad de la mano del jugador (ver `calculaSwat` en main.js).
 */
import * as THREE from '../vendor/three.module.js';
import { Fly3D } from './fly3d.js?v=6';

export const ACCENT = 0x2fe0c0;
export const HOVER_Y = 1.55;
export const PAD_HALF = 0.43;
export const BOUNDS = { x: 1.95, z: 1.25 };
/** Altura del plano de puntería: la del cuerpo de la mosca. */
export const AIM_Y = 0.185;

export class Arena {
  constructor(canvas, layout) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x08080c);
    this.scene.fog = new THREE.Fog(0x08080c, 7, 16);

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    this.camBase = new THREE.Vector3(0, 2.9, 3.9);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 0.5, 0);

    this.shake = 0;
    this.buildLights();
    this.buildTable();

    this.fly = new Fly3D(layout, ACCENT);
    this.fly.baseScale = 0.62;
    this.fly.group.scale.setScalar(0.62);
    this.scene.add(this.fly.group);

    this.swatter = this.buildSwatter();
    this.ring = this.buildRing();
    this.reticle = this.buildReticle();

    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -AIM_Y);
    this.ray = new THREE.Raycaster();
    this.hit = new THREE.Vector3();

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x5a6a88, 0x101018, 0.8));

    this.key = new THREE.DirectionalLight(0xffeedd, 3.2);
    this.key.position.set(1.4, 5.0, 2.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    const c = this.key.shadow.camera;
    c.left = -4; c.right = 4; c.top = 4; c.bottom = -4; c.near = 0.5; c.far = 12;
    this.key.shadow.bias = -0.0012;
    this.scene.add(this.key);

    const warm = new THREE.PointLight(0xffc08a, 2.2, 8);
    warm.position.set(-2.4, 1.6, 1.6);
    const cool = new THREE.PointLight(ACCENT, 1.8, 7);
    cool.position.set(2.4, 1.2, 0.4);
    this.scene.add(warm, cool);
  }

  buildTable() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const g = cv.getContext('2d');
    g.fillStyle = '#191920'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      g.strokeStyle = `rgba(${150 + Math.random() * 40},${138 + Math.random() * 40},${128 + Math.random() * 40},${0.01 + Math.random() * 0.02})`;
      g.lineWidth = 0.5 + Math.random() * 1.7;
      const y = Math.random() * 512;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(170, y + (Math.random() - 0.5) * 8, 340, y + (Math.random() - 0.5) * 8, 512, y);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);

    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.05 }),
    );
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    this.scene.add(top);

    // Migajas: dan escala y le dan a la mosca algo que hacer.
    const crumb = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.95 });
    this.crumbs = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.018 + Math.random() * 0.022, 0), crumb);
      m.position.set((Math.random() - 0.5) * 3.4, 0.016, (Math.random() - 0.5) * 2.2);
      m.rotation.set(Math.random(), Math.random(), Math.random());
      m.castShadow = true;
      this.scene.add(m);
      this.crumbs.push(m);
    }
  }

  buildSwatter() {
    const group = new THREE.Group();
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#000';
    for (let i = 0; i < 13; i++) {
      for (let j = 0; j < 13; j++) { g.beginPath(); g.arc(14 + i * 19, 14 + j * 19, 5.4, 0, 6.2832); g.fill(); }
    }
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(128, 128, 126, 0, 6.2832); g.rect(0, 0, 256, 256); g.fill('evenodd');

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(PAD_HALF * 2, 0.028, PAD_HALF * 2),
      new THREE.MeshStandardMaterial({
        color: 0xdc4250, roughness: 0.5, metalness: 0.1,
        alphaMap: new THREE.CanvasTexture(cv),
        transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
      }),
    );
    pad.castShadow = true;
    group.add(pad);

    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 1.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.5, metalness: 0.45 }),
    );
    handle.position.set(0, 0.6, -0.62);
    handle.rotation.x = 0.55;
    handle.castShadow = true;
    group.add(handle);

    group.position.set(0, HOVER_Y, 0);
    this.scene.add(group);
    return group;
  }

  buildReticle() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.34, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(PAD_HALF - 0.012, PAD_HALF, 48), mat);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.008), mat);
      t.rotation.x = -Math.PI / 2;
      t.rotation.z = i * Math.PI / 2;
      t.position.set(Math.cos(i * Math.PI / 2) * PAD_HALF * 0.55, 0, Math.sin(i * Math.PI / 2) * PAD_HALF * 0.55);
      g.add(t);
    }
    g.position.y = 0.008;
    this.scene.add(g);
    return g;
  }

  buildRing() {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.14, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.012;
    this.scene.add(m);
    this.ringT = 1;
    return m;
  }

  /** Punto de la mesa bajo unas coordenadas de pantalla, sin recortar. */
  pointToRaw(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = -((clientY - r.top) / r.height) * 2 + 1;
    this.ray.setFromCamera({ x: nx, y: ny }, this.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return null;
    return { x: this.hit.x, z: this.hit.z };
  }

  /** Convierte la posición del puntero en un punto de la mesa, dentro de los límites. */
  pointTo(clientX, clientY) {
    const p = this.pointToRaw(clientX, clientY);
    if (!p) return null;
    return {
      x: Math.max(-BOUNDS.x, Math.min(BOUNDS.x, p.x)),
      z: Math.max(-BOUNDS.z, Math.min(BOUNDS.z, p.z)),
    };
  }

  /**
   * Huella sobre la mesa de un elemento de la interfaz.
   *
   * Sirve para que la mosca no se meta debajo del panel de la gráfica, donde no
   * se ve y no se le puede pegar. Se proyectan las cuatro esquinas al plano de
   * puntería y se toma su caja envolvente; hay que usar la versión SIN recorte,
   * porque recortar a los límites del juego deformaría la huella.
   */
  huellaDe(el, margen = 0.12) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const esquinas = [
      this.pointToRaw(r.left, r.top), this.pointToRaw(r.right, r.top),
      this.pointToRaw(r.left, r.bottom), this.pointToRaw(r.right, r.bottom),
    ].filter(Boolean);
    if (esquinas.length < 4) return null;
    const xs = esquinas.map((p) => p.x), zs = esquinas.map((p) => p.z);
    return {
      x0: Math.min(...xs) - margen, x1: Math.max(...xs) + margen,
      z0: Math.min(...zs) - margen, z1: Math.max(...zs) + margen,
    };
  }

  impact(x, z) {
    this.ring.position.set(x, 0.012, z);
    this.ring.scale.setScalar(1);
    this.ringT = 0;
    this.shake = 1;
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(dt) {
    this.fly.update(dt);

    if (this.ringT < 1) {
      this.ringT = Math.min(1, this.ringT + dt * 2.2);
      const k = 1 + this.ringT * 7;
      this.ring.scale.setScalar(k);
      this.ring.material.opacity = (1 - this.ringT) * 0.5;
    }

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3.4);
      const a = this.shake * this.shake * 0.06;
      this.camera.position.set(
        this.camBase.x + (Math.random() - 0.5) * a,
        this.camBase.y + (Math.random() - 0.5) * a,
        this.camBase.z + (Math.random() - 0.5) * a,
      );
      this.camera.lookAt(0, 0.5, 0);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
