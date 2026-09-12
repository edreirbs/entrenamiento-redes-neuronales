/**
 * La arena en 3D: una mesa, dos moscas y dos matamoscas.
 *
 * El matamoscas baja con velocidad constante, así que su tamaño angular
 * crece exactamente como el estímulo de aproximación que se le inyecta al
 * circuito. Lo que ves caer y lo que la mosca simulada "ve" son la misma
 * cosa.
 */
import * as THREE from '../vendor/three.module.js';
import { Fly3D } from './fly3d.js';

export const HUMAN = 0xff8a3c;
export const FLY = 0x2fe0c0;

export class Arena {
  constructor(canvas, layoutHuman, layoutFly) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    // Un móvil de pantalla densa no gana nada renderizando a 3x.
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07070b);
    this.scene.fog = new THREE.Fog(0x07070b, 6, 15);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 1.62, 3.62);
    this.camera.lookAt(0, 0.33, 0);

    this.buildLights();
    this.buildTable();

    this.flies = {
      human: new Fly3D(layoutHuman, HUMAN),
      fly: new Fly3D(layoutFly, FLY),
    };
    this.flies.human.group.position.x = -0.95;
    this.flies.fly.group.position.x = 0.95;
    this.flies.human.baseX = -0.95; this.flies.human.dir = -1;
    this.flies.human.baseScale = 0.82;
    this.flies.human.group.scale.setScalar(0.82);
    this.flies.human.group.rotation.y = 0.62;
    this.flies.human.baseYaw = 0.62;
    this.flies.fly.baseX = 0.95; this.flies.fly.dir = 1;
    this.flies.fly.baseScale = 0.82;
    this.flies.fly.group.scale.setScalar(0.82);
    this.flies.fly.group.rotation.y = -0.62;
    this.flies.fly.baseYaw = -0.62;
    this.scene.add(this.flies.human.group, this.flies.fly.group);

    this.swatters = {
      human: this.buildSwatter(-0.95),
      fly: this.buildSwatter(0.95),
    };
    this.cubes = this.buildCubes();
    this.setCubes(false);

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x44506a, 0x0a0a12, 0.45));

    this.key = new THREE.DirectionalLight(0xffeedd, 2.6);
    this.key.position.set(1.6, 5.2, 2.4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    const c = this.key.shadow.camera;
    c.left = -4; c.right = 4; c.top = 4; c.bottom = -4; c.near = 0.5; c.far = 14;
    this.key.shadow.bias = -0.0012;
    this.scene.add(this.key);

    this.rimH = new THREE.PointLight(HUMAN, 2.0, 3.2);
    this.rimH.position.set(-1.9, 0.7, 0.9);
    this.rimF = new THREE.PointLight(FLY, 2.0, 3.2);
    this.rimF.position.set(1.9, 0.7, 0.9);
    this.scene.add(this.rimH, this.rimF);
  }

  buildTable() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const g = cv.getContext('2d');
    g.fillStyle = '#111116'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      g.strokeStyle = `rgba(${140 + Math.random() * 40},${130 + Math.random() * 40},${125 + Math.random() * 40},${0.008 + Math.random() * 0.016})`;
      g.lineWidth = 0.5 + Math.random() * 1.6;
      const y = Math.random() * 512;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(170, y + (Math.random() - 0.5) * 9, 340, y + (Math.random() - 0.5) * 9, 512, y);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);

    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.06 }),
    );
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    this.scene.add(top);
  }

  buildSwatter(x) {
    const group = new THREE.Group();

    // Rejilla: el alfa perforado es lo que la vuelve un matamoscas y no una tabla.
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#000';
    for (let i = 0; i < 13; i++) {
      for (let j = 0; j < 13; j++) {
        g.beginPath();
        g.arc(14 + i * 19, 14 + j * 19, 5.6, 0, 6.2832);
        g.fill();
      }
    }
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(128, 128, 126, 0, 6.2832);
    g.rect(0, 0, 256, 256); g.fill('evenodd');
    const alpha = new THREE.CanvasTexture(cv);

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.03, 0.86),
      new THREE.MeshStandardMaterial({
        color: 0xb8323f, roughness: 0.6, metalness: 0.12,
        alphaMap: alpha, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
      }),
    );
    pad.castShadow = true;
    group.add(pad);

    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 1.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.5, metalness: 0.4 }),
    );
    handle.position.set(0, 0.72, -0.62);
    handle.rotation.x = 0.5;
    handle.castShadow = true;
    group.add(handle);

    group.position.set(x, 5.2, 0);
    group.visible = false;
    this.scene.add(group);
    return group;
  }

  buildCubes() {
    const cubes = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.24, 0.24),
        new THREE.MeshStandardMaterial({
          color: 0xf2f0e8, roughness: 0.95, metalness: 0,
          emissive: 0xffc94d, emissiveIntensity: 0,
        }),
      );
      m.position.set(-1.44 + i * 0.96, 0.12, -1.55);
      m.rotation.y = (Math.random() - 0.5) * 0.5;
      m.castShadow = true;
      const light = new THREE.PointLight(0xffc94d, 0, 2.2);
      light.position.copy(m.position).setY(0.5);
      this.scene.add(m, light);
      cubes.push({ mesh: m, light });
    }
    return cubes;
  }

  setCubes(visible) {
    for (const c of this.cubes) { c.mesh.visible = visible; if (!visible) c.light.intensity = 0; }
  }

  litCube(index, strength = 1) {
    this.cubes.forEach((c, i) => {
      const on = i === index ? strength : 0;
      c.mesh.material.emissiveIntensity = on * 1.6;
      c.light.intensity = on * 3.4;
    });
  }

  /** Atenúa la escena: es la "oscuridad" de la ronda de memoria. */
  setDark(k) {
    this.key.intensity = 2.6 * (1 - k * 0.93);
    this.rimH.intensity = 2.0 * (1 - k * 0.8);
    this.rimF.intensity = 2.0 * (1 - k * 0.8);
  }

  showSwatters(v) {
    this.swatters.human.visible = v;
    this.swatters.fly.visible = v;
  }

  /** Altura del matamoscas. Lineal, que es lo que produce el perfil de aproximación. */
  setSwatterHeight(y) {
    this.swatters.human.position.y = y;
    this.swatters.fly.position.y = y;
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(dt) {
    this.flies.human.update(dt);
    this.flies.fly.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
