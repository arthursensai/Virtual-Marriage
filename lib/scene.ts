import * as THREE from 'three';
import type { Look } from './types';
import { M, add, attachLabel, buildPerson, disposeObj, type Person } from './characters';
import { clamp, hash, lerp, rng, ss } from './util';
import { BOUNDS, buildWorld, groundY, type Obstacle } from './world';

// نحافظ على ألوان المشهد كما صُمّمت (بدون إدارة ألوان جديدة)
THREE.ColorManagement.enabled = false;

export type ReactKind = 'clap' | 'heart' | 'cheer';
export interface Pos {
  x: number;
  z: number;
  r: number;
}
export interface SceneActor {
  name: string;
  look: Look;
  pos?: Pos;
}
export interface SceneGuest {
  id: string;
  name: string;
  look: Look;
  pos?: Pos;
}
interface Ent {
  x: number;
  z: number;
  tx: number;
  tz: number;
  rot: number;
  trot: number;
  moving: boolean;
  seen: number;
}
export interface SceneCeremony {
  round: number;
  step: number;
  stepStartedAt: number;
}
export interface SceneOptions {
  onStep?: (step: number, late: boolean) => void;
  /** يُستدعى لحركة اللاعب المحلي (≈8 مرات/ث أثناء الحركة، ومرة عند التوقف) */
  onMove?: (x: number, z: number, r: number, moving: boolean) => void;
}

const SPEED = 3.4;
const PLAYER_R = 0.28;
const SEND_MS = 120;
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export const WALK_MS = 7000;
export const MAX_GUESTS = 20;

interface Goal {
  theta: number;
  phi: number;
  r: number;
  tx: number;
  ty: number;
  tz: number;
}

function animPerson(p: Person, t: number, walking: boolean) {
  const s = Math.sin(t * 9 + p.phase);
  p.body.position.y = walking ? Math.abs(s) * 0.05 : Math.sin(t * 1.6 + p.phase) * 0.008;
  p.body.rotation.z = walking ? s * 0.03 : 0;
  p.legs.forEach((l, i) => {
    l.rotation.x = walking ? (i ? 1 : -1) * s * 0.55 : 0;
  });
  p.arms.forEach((a, i) => {
    a.rotation.x = a.userData.rx + (walking && !p.hold ? (i ? -1 : 1) * s * 0.35 : 0);
  });
}
const platformY = (z: number) => 0.12 * clamp((2.5 - z) / 0.5, 0, 1);
export function slotPos(i: number) {
  const side = i % 2 ? 1 : -1;
  const row = Math.floor(i / 2);
  return { x: side * (2.5 + ((i * 7) % 3) * 0.12), z: 1.6 + row * 1.05, side };
}

export class WeddingScene {
  private canvas: HTMLCanvasElement;
  private opts: SceneOptions;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  private hemi = new THREE.HemisphereLight(0xaab8ff, 0x1d2440, 0.6);
  private sun = new THREE.DirectionalLight(0xb8c6ff, 0.8);
  private warm = new THREE.PointLight(0xffb066, 1, 10, 1);
  private ground!: THREE.Mesh;
  private stars!: THREE.Points;
  private moon!: THREE.Mesh;
  private moonGlow!: THREE.Sprite;
  private sunMesh!: THREE.Mesh;

  private actors: { groom: Person | null; bride: Person | null } = { groom: null, bride: null };
  private actorKey = { groom: '', bride: '' };
  private guests = new Map<string, { key: string; p: Person }>();
  private guestsG = new THREE.Group();
  private clapUntil = new Map<string, number>();

  /* حركة اللاعبين: id = 'groom' | 'bride' | معرّف الضيف */
  private ents = new Map<string, Ent>();
  private localId: string | null = null;
  private input = { x: 0, y: 0 };
  private keys = { u: 0, d: 0, l: 0, r: 0 };
  private obstacles: Obstacle[] = [];
  private signs: THREE.Sprite[] = [];
  private worldAnim: (t: number) => void = () => {};
  private ring!: THREE.Mesh;
  private lastSend = 0;
  private wasMoving = false;

  private ceremony: SceneCeremony | null = null;
  private lastKey = '';

  private hearts: { sp: THREE.Sprite; vy: number; life: number; delay: number }[] = [];
  private NC = 260;
  private cpos = new Float32Array(260 * 3);
  private ccol = new Float32Array(260 * 3);
  private cvel = new Float32Array(260 * 3);
  private cgeo = new THREE.BufferGeometry();
  private confetti!: THREE.Points;
  private confT = 0;

  private cam = { theta: 0.6, phi: 1.1, r: 9, tx: 0, ty: 1.15, tz: -0.5, base: 0, last: 0 };
  private g: Goal = { theta: 0, phi: 1.36, r: 5.2, tx: 0, ty: 1.15, tz: -0.5 };
  private mobile = false;
  private viewShift = 0;

  private clock = new THREE.Clock();
  private raf = 0;
  private cleanup: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, opts: SceneOptions = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    (this.renderer as unknown as { useLegacyLights: boolean }).useLegacyLights = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.buildSet();
    const world = buildWorld(this.scene);
    this.obstacles = world.obstacles;
    this.signs = world.signs;
    this.worldAnim = world.animate;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 32), new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);
    this.scene.add(this.guestsG);
    this.buildFx();
    this.setNight(true);
    this.bindControls();
    this.resize();
    this.applyGoal(this.goalFor(-1));
    this.tick();
  }

  /* ---------- بناء المشهد ---------- */
  private buildSet() {
    const scene = this.scene;
    scene.add(this.hemi);
    this.sun.position.set(-10, 16, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -14;
    sc.right = 14;
    sc.top = 14;
    sc.bottom = -14;
    sc.near = 1;
    sc.far = 60;
    scene.add(this.sun);
    this.warm.position.set(0, 2.4, 0.8);
    scene.add(this.warm);

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(70, 64), M('#1f3526', { roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    scene.add(this.ground);

    const platform = add(scene, new THREE.CylinderGeometry(2.75, 2.9, 0.12, 48), M('#8a6a45'), 0, 0.06, -0.5);
    platform.receiveShadow = true;
    const stageRug = new THREE.Mesh(new THREE.CircleGeometry(1.95, 40), M('#8e1b2e', { roughness: 0.9 }));
    stageRug.rotation.x = -Math.PI / 2;
    stageRug.position.set(0, 0.125, -0.5);
    stageRug.receiveShadow = true;
    scene.add(stageRug);
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 12.5), M('#8e1b2e', { roughness: 0.9 }));
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.set(0, 0.03, 5.3);
    aisle.receiveShadow = true;
    scene.add(aisle);
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 12.5), M('#d8b55a', { metalness: 0.6, roughness: 0.4 }));
      e.rotation.x = -Math.PI / 2;
      e.position.set(s * 0.78, 0.035, 5.3);
      scene.add(e);
    });

    /* قوس الورد */
    const arch = new THREE.Group();
    arch.position.set(0, 0.12, -1.7);
    scene.add(arch);
    const ivory = M('#f3ece0');
    [-1, 1].forEach((s) => add(arch, new THREE.CylinderGeometry(0.09, 0.11, 2.6, 12), ivory, s * 1.5, 1.3, 0));
    add(arch, new THREE.TorusGeometry(1.5, 0.08, 10, 48, Math.PI), ivory, 0, 2.6, 0);
    const r = rng(7);
    const pal = ['#ffb3c6', '#ffffff', '#ff6b8b', '#ffd166', '#f7a8d8'];
    const leaf = M('#2e7d4f');
    const flower = (x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.09 + r() * 0.07, 10, 8), M(pal[Math.floor(r() * pal.length)], { roughness: 0.8 }));
      m.position.set(x, y, z);
      arch.add(m);
    };
    for (let i = 0; i < 80; i++) {
      const t = (i / 79) * Math.PI;
      flower(Math.cos(t) * 1.5 + (r() - 0.5) * 0.18, 2.6 + Math.sin(t) * 1.5 + (r() - 0.5) * 0.18, (r() - 0.5) * 0.25);
      if (i % 3 === 0) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), leaf);
        l.position.set(Math.cos(t) * 1.5, 2.6 + Math.sin(t) * 1.5, 0.12);
        arch.add(l);
      }
    }
    [-1, 1].forEach((s) => {
      for (let j = 0; j < 9; j++) flower(s * 1.5 + (r() - 0.5) * 0.2, 0.3 + j * 0.28, (r() - 0.5) * 0.2);
    });
    const drape = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, roughness: 1 }),
    );
    drape.position.set(0, 1.35, -0.15);
    arch.add(drape);

    /* فوانيس */
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffcf6b });
    for (let li = 0; li < 5; li++) {
      [-1, 1].forEach((s) => {
        const pole = new THREE.Group();
        pole.position.set(s * 1.08, 0, 1.2 + li * 2);
        add(pole, new THREE.CylinderGeometry(0.025, 0.03, 1.5, 8), M('#5a4630'), 0, 0.75, 0);
        const lb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), lanternMat);
        lb.position.y = 1.6;
        pole.add(lb);
        scene.add(pole);
      });
    }

    /* أشجار */
    const rt = rng(21);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rt() * 0.3;
      const d = 22 + rt() * 10;
      const tr = new THREE.Group();
      add(tr, new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8), M('#5a3d26'), 0, 0.8, 0);
      add(tr, new THREE.ConeGeometry(1.7, 3.2, 9), M('#1f5a3a'), 0, 3, 0);
      add(tr, new THREE.ConeGeometry(1.25, 2.6, 9), M('#26704a'), 0, 4.6, 0);
      tr.position.set(Math.cos(a) * d, 0, 2.5 + Math.sin(a) * d);
      tr.scale.setScalar(0.9 + rt() * 0.6);
      scene.add(tr);
    }

    /* السماء */
    const sg = new THREE.BufferGeometry();
    const n = 520;
    const p = new Float32Array(n * 3);
    const rs = rng(3);
    for (let i = 0; i < n; i++) {
      const u = rs() * Math.PI * 2;
      const v = Math.acos(0.15 + rs() * 0.85);
      const R = 110;
      p[i * 3] = R * Math.sin(v) * Math.cos(u);
      p[i * 3 + 1] = R * Math.cos(v);
      p[i * 3 + 2] = R * Math.sin(v) * Math.sin(u);
    }
    sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false }));
    scene.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(4.2, 40, 30), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
    this.moon.position.set(-16, 20, -42);
    scene.add(this.moon);
    const gc = document.createElement('canvas');
    gc.width = gc.height = 128;
    const gx = gc.getContext('2d')!;
    const gr = gx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,244,214,.9)');
    gr.addColorStop(0.35, 'rgba(255,244,214,.28)');
    gr.addColorStop(1, 'rgba(255,244,214,0)');
    gx.fillStyle = gr;
    gx.fillRect(0, 0, 128, 128);
    this.moonGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    this.moonGlow.scale.set(30, 30, 1);
    this.moonGlow.position.copy(this.moon.position);
    scene.add(this.moonGlow);
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(3, 30, 24), new THREE.MeshBasicMaterial({ color: 0xffe08a, fog: false }));
    this.sunMesh.position.set(18, 22, -42);
    scene.add(this.sunMesh);
  }

  private buildFx() {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const x = c.getContext('2d')!;
    x.font = '72px serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#ff4d6d';
    x.fillText('\u2764', 48, 52);
    const tex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 24; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      sp.scale.set(0.42, 0.42, 1);
      sp.visible = false;
      this.scene.add(sp);
      this.hearts.push({ sp, vy: 0, life: 0, delay: 0 });
    }
    this.cgeo.setAttribute('position', new THREE.BufferAttribute(this.cpos, 3));
    this.cgeo.setAttribute('color', new THREE.BufferAttribute(this.ccol, 3));
    this.confetti = new THREE.Points(this.cgeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true }));
    this.confetti.visible = false;
    this.confetti.frustumCulled = false;
    this.scene.add(this.confetti);
  }

  /* ---------- واجهة خارجية ---------- */
  setNight(n: boolean) {
    const sky = n ? 0x0a1030 : 0x9fd3ff;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, 24, 90);
    this.hemi.color.set(n ? 0xaab8ff : 0xffffff);
    this.hemi.groundColor.set(n ? 0x1d2440 : 0x8a9a6a);
    this.hemi.intensity = n ? 0.6 : 0.85;
    this.sun.color.set(n ? 0xb8c6ff : 0xfff2d8);
    this.sun.intensity = n ? 0.8 : 1.05;
    this.sun.position.set(n ? -10 : 9, n ? 16 : 18, 10);
    this.warm.intensity = n ? 1 : 0.25;
    (this.ground.material as THREE.MeshStandardMaterial).color.set(n ? 0x1f3526 : 0x5fae52);
    this.stars.visible = n;
    this.moon.visible = n;
    this.moonGlow.visible = n;
    this.sunMesh.visible = !n;
  }

  setActor(role: 'groom' | 'bride', a: SceneActor) {
    const key = JSON.stringify([a.look, a.name]);
    if (this.actorKey[role] === key) return;
    this.actorKey[role] = key;
    const old = this.actors[role];
    let pos: THREE.Vector3 | null = null;
    let rot = 0;
    if (old) {
      pos = old.root.position.clone();
      rot = old.root.rotation.y;
      this.scene.remove(old.root);
      disposeObj(old.root);
    }
    const p = buildPerson(a.look);
    attachLabel(p, a.name, 2.2, 1, true);
    if (!this.ents.has(role)) {
      const sp = a.pos ?? { x: role === 'groom' ? -0.85 : 0.85, z: -0.5, r: role === 'groom' ? 0.25 : -0.25 };
      this.ents.set(role, { x: sp.x, z: sp.z, tx: sp.x, tz: sp.z, rot: sp.r, trot: sp.r, moving: false, seen: 0 });
    }
    if (pos) {
      p.root.position.copy(pos);
      p.root.rotation.y = rot;
    }
    this.actors[role] = p;
    this.scene.add(p.root);
  }

  setGuests(list: SceneGuest[]) {
    const shown = list.slice(0, MAX_GUESTS);
    const ids = new Set(shown.map((g) => g.id));
    for (const [id, g] of Array.from(this.guests.entries())) {
      if (!ids.has(id)) {
        this.guestsG.remove(g.p.root);
        disposeObj(g.p.root);
        this.guests.delete(id);
      }
    }
    shown.forEach((g) => {
      const key = JSON.stringify([g.look, g.name]);
      const cur = this.guests.get(g.id);
      if (cur && cur.key === key) return;
      if (cur) {
        this.guestsG.remove(cur.p.root);
        disposeObj(cur.p.root);
      }
      const p = buildPerson(g.look);
      p.root.scale.setScalar(0.93);
      attachLabel(p, g.name, 2.15, 0.85);
      p.arms.forEach((a) => {
        a.userData.base = a.rotation.z;
      });
      this.guestsG.add(p.root);
      this.guests.set(g.id, { key, p });
      if (cur) p.root.position.copy(cur.p.root.position);
    });
    shown.forEach((g) => {
      if (this.ents.has(g.id)) return;
      const h = hash(g.id);
      const sp = g.pos ?? { x: ((h % 9) - 4) * 0.45, z: 11.6 + ((h >> 4) % 3) * 0.7, r: Math.PI };
      this.ents.set(g.id, { x: sp.x, z: sp.z, tx: sp.x, tz: sp.z, rot: sp.r, trot: sp.r, moving: false, seen: 0 });
    });
    const keep = new Set<string>(['groom', 'bride', ...shown.map((g) => g.id)]);
    for (const id of Array.from(this.ents.keys())) if (!keep.has(id)) this.ents.delete(id);
    if (this.localId && !this.ents.has(this.localId)) this.localId = null;
  }

  /* ---------- التحكم بالحركة ---------- */
  setLocal(id: string | null) {
    this.localId = id;
    this.ring.visible = !!id;
  }
  setInput(x: number, y: number) {
    this.input.x = x;
    this.input.y = y;
  }
  remotePos(id: string, x: number, z: number, r: number, moving: boolean) {
    const e = this.ents.get(id);
    if (!e || id === this.localId) return;
    e.tx = clamp(x, BOUNDS.minX, BOUNDS.maxX);
    e.tz = clamp(z, BOUNDS.minZ, BOUNDS.maxZ);
    e.trot = r;
    e.moving = moving;
    e.seen = performance.now();
  }

  private scripted(id: string) {
    return (id === 'groom' || id === 'bride') && !!this.ceremony && this.ceremony.step >= 0;
  }

  private collide(x: number, z: number) {
    let nx = clamp(x, BOUNDS.minX, BOUNDS.maxX);
    let nz = clamp(z, BOUNDS.minZ, BOUNDS.maxZ);
    for (const o of this.obstacles) {
      const dx = nx - o.x;
      const dz = nz - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + PLAYER_R;
      if (d < min && d > 1e-4) {
        nx = o.x + (dx / d) * min;
        nz = o.z + (dz / d) * min;
      }
    }
    return { x: nx, z: nz };
  }

  private stepLocal(dt: number, nowP: number) {
    const id = this.localId;
    const e = id ? this.ents.get(id) : null;
    if (!id || !e || this.scripted(id)) {
      this.ring.visible = false;
      if (this.wasMoving) {
        this.wasMoving = false;
      }
      return;
    }
    let ix = this.input.x + this.keys.r - this.keys.l;
    let iy = this.input.y + this.keys.u - this.keys.d;
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }
    const moving = len > 0.12;
    if (moving) {
      const th = this.cam.theta;
      const vx = Math.cos(th) * ix + -Math.sin(th) * iy;
      const vz = -Math.sin(th) * ix + -Math.cos(th) * iy;
      const sp = SPEED * Math.min(1, len);
      const c = this.collide(e.x + vx * sp * dt, e.z + vz * sp * dt);
      e.x = c.x;
      e.z = c.z;
      e.trot = Math.atan2(vx, vz);
    }
    e.moving = moving;
    e.rot += angDiff(e.rot, e.trot) * (1 - Math.pow(0.0005, dt));
    this.ring.visible = true;
    if ((moving && nowP - this.lastSend > SEND_MS) || (!moving && this.wasMoving)) {
      this.lastSend = nowP;
      this.opts.onMove?.(Math.round(e.x * 100) / 100, Math.round(e.z * 100) / 100, Math.round(e.rot * 100) / 100, moving);
    }
    this.wasMoving = moving;
  }

  private updateEnts(dt: number, nowP: number) {
    const k = 1 - Math.pow(0.0008, dt);
    this.ents.forEach((e, id) => {
      if (id === this.localId) return;
      e.x += (e.tx - e.x) * k;
      e.z += (e.tz - e.z) * k;
      e.rot += angDiff(e.rot, e.trot) * k;
      if (e.moving && nowP - e.seen > 450) e.moving = false;
    });
  }

  private applyEnt(id: string, root: THREE.Object3D) {
    const e = this.ents.get(id);
    if (!e) return;
    root.position.set(e.x, groundY(e.x, e.z), e.z);
    root.rotation.y = e.rot;
  }

  private updateLabels() {
    const f = clamp(this.cam.r / 11, 0.85, 3);
    const scaleLabel = (sp: THREE.Sprite | null) => {
      const s0 = sp?.userData.s0 as THREE.Vector3 | undefined;
      if (sp && s0) sp.scale.set(s0.x * f, s0.y * f, 1);
    };
    scaleLabel(this.actors.groom?.label ?? null);
    scaleLabel(this.actors.bride?.label ?? null);
    this.guests.forEach(({ p }) => scaleLabel(p.label));
    this.signs.forEach((sp) => scaleLabel(sp));
  }

  setCeremony(c: SceneCeremony | null) {
    this.ceremony = c;
  }

  setViewShift(f: number) {
    this.viewShift = f;
    this.resize();
  }

  react(id: string, kind: ReactKind) {
    const now = performance.now();
    if (kind === 'clap' || kind === 'cheer') this.clapUntil.set(id, now + 2600);
    if (kind === 'heart' || kind === 'cheer') {
      const p = id === 'groom' || id === 'bride' ? this.actors[id] : this.guests.get(id)?.p;
      if (p) this.burstHeartsAt(p.root.position.x, 2.5, p.root.position.z, 3);
    }
    if (kind === 'cheer') this.startConfetti(90);
  }

  resize() {
    const par = this.canvas.parentElement;
    if (!par) return;
    const w = Math.max(1, par.clientWidth);
    const h = Math.max(1, par.clientHeight);
    this.mobile = w < 720;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.clearViewOffset();
    if (this.mobile && this.viewShift > 0) this.camera.setViewOffset(w, h, 0, Math.round(h * this.viewShift), w, h);
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    this.scene.traverse((o) => disposeObj(o));
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  /* ---------- الكاميرا ---------- */
  private R(x: number) {
    return this.mobile ? x * 1.22 : x;
  }
  private goalFor(step: number): Goal {
    const R = (x: number) => this.R(x);
    switch (step) {
      case 0:
        return { theta: Math.PI * 0.85, phi: 1.32, r: R(9.5), tx: 0, ty: 1.3, tz: 2.5 };
      case 1:
        return { theta: 0.45, phi: 1.32, r: R(5.6), tx: 0, ty: 1.3, tz: -0.5 };
      case 2:
        return { theta: -0.35, phi: 1.3, r: R(5.2), tx: 0, ty: 1.3, tz: -0.5 };
      case 3:
        return { theta: 0, phi: 1.3, r: R(4.8), tx: 0, ty: 1.3, tz: -0.5 };
      case 4:
        return { theta: 0.3, phi: 1.28, r: R(4.6), tx: 0, ty: 1.25, tz: -0.5 };
      case 5:
      case 6:
        return { theta: 0, phi: 1.3, r: R(4.4), tx: 0, ty: 1.35, tz: -0.5 };
      default:
        return { theta: 0, phi: 0.82, r: R(21), tx: 0, ty: 0.4, tz: 4.2 };
    }
  }
  private applyGoal(g: Goal) {
    this.g = g;
    this.cam.last = 0;
  }
  private updateCam(dt: number, nowP: number) {
    const c = this.cam;
    void nowP;
    const k = 1 - Math.pow(0.03, dt);
    (['theta', 'phi', 'r', 'tx', 'ty', 'tz'] as const).forEach((key) => {
      c[key] += (this.g[key] - c[key]) * k;
    });
    const sp = Math.sin(c.phi);
    this.camera.position.set(c.tx + c.r * sp * Math.sin(c.theta), c.ty + c.r * Math.cos(c.phi), c.tz + c.r * sp * Math.cos(c.theta));
    this.camera.lookAt(c.tx, c.ty, c.tz);
  }
  private bindControls() {
    const cv = this.canvas;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pinch = 0;
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const c = this.cam;
      if (pts.size === 1) {
        c.theta -= (e.clientX - p.x) * 0.006;
        c.phi = clamp(c.phi - (e.clientY - p.y) * 0.005, 0.35, 1.55);
        this.g.theta = c.theta;
        this.g.phi = c.phi;
      } else if (pts.size === 2) {
        p.x = e.clientX;
        p.y = e.clientY;
        const [a, b] = Array.from(pts.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) {
          c.r = clamp(c.r * (pinch / d), 4, 34);
          this.g.r = c.r;
        }
        pinch = d;
      }
      p.x = e.clientX;
      p.y = e.clientY;
      c.last = performance.now();
      c.base = c.theta;
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.cam.r = clamp(this.cam.r * (1 + e.deltaY * 0.001), 4, 34);
      this.g.r = this.cam.r;
      this.cam.last = performance.now();
    };
    const keyMap: Record<string, 'u' | 'd' | 'l' | 'r'> = {
      KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
    };
    const key = (v: number) => (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = keyMap[e.code];
      if (!k) return;
      this.keys[k] = v;
      e.preventDefault();
    };
    const kd = key(1);
    const ku = key(0);
    const blur = () => {
      this.keys = { u: 0, d: 0, l: 0, r: 0 };
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', wheel, { passive: false });
    this.cleanup.push(() => {
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      cv.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    });
  }

  /* ---------- مؤثرات ---------- */
  private burstHeartsAt(x: number, y: number, z: number, n: number) {
    let used = 0;
    for (const h of this.hearts) {
      if (used >= n) break;
      if (h.life > 0) continue;
      h.life = 1;
      h.delay = used * 0.15;
      h.vy = 0.6 + Math.random() * 0.5;
      h.sp.position.set(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.4);
      h.sp.visible = false;
      used++;
    }
  }
  private startConfetti(count = this.NC) {
    const pal = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ffffff'].map((h) => new THREE.Color(h));
    for (let i = 0; i < this.NC; i++) {
      const live = i < count;
      this.cpos[i * 3] = (Math.random() - 0.5) * 8;
      this.cpos[i * 3 + 1] = live ? 5 + Math.random() * 4 : -50;
      this.cpos[i * 3 + 2] = -0.5 + (Math.random() - 0.5) * 8;
      this.cvel[i * 3] = (Math.random() - 0.5) * 0.6;
      this.cvel[i * 3 + 1] = live ? -(1.5 + Math.random() * 2) : 0;
      this.cvel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      const c = pal[i % pal.length];
      this.ccol[i * 3] = c.r;
      this.ccol[i * 3 + 1] = c.g;
      this.ccol[i * 3 + 2] = c.b;
    }
    this.cgeo.attributes.position.needsUpdate = true;
    this.cgeo.attributes.color.needsUpdate = true;
    this.confetti.visible = true;
    this.confT = count < this.NC ? 3 : 9;
  }
  private updateFx(dt: number) {
    this.hearts.forEach((h) => {
      if (h.life <= 0) return;
      if (h.delay > 0) {
        h.delay -= dt;
        return;
      }
      h.sp.visible = true;
      h.sp.position.y += h.vy * dt;
      h.life -= dt * 0.3;
      h.sp.material.opacity = clamp(h.life * 1.6, 0, 1);
      if (h.life <= 0) h.sp.visible = false;
    });
    if (this.confetti.visible) {
      this.confT -= dt;
      for (let i = 0; i < this.NC; i++) {
        this.cpos[i * 3] += this.cvel[i * 3] * dt;
        this.cpos[i * 3 + 1] += this.cvel[i * 3 + 1] * dt;
        this.cpos[i * 3 + 2] += this.cvel[i * 3 + 2] * dt;
        if (this.cpos[i * 3 + 1] < 0) {
          if (this.confT > 0 && this.cvel[i * 3 + 1] !== 0) this.cpos[i * 3 + 1] = 6 + Math.random() * 3;
          else {
            this.cpos[i * 3 + 1] = -50;
            this.cvel[i * 3 + 1] = 0;
          }
        }
      }
      this.cgeo.attributes.position.needsUpdate = true;
      if (this.confT < -2) this.confetti.visible = false;
    }
  }

  /* ---------- الحفل ---------- */
  private enterStep(step: number, el: number) {
    this.applyGoal(this.goalFor(step));
    let late = false;
    if (step === 5) {
      if (el < 10000) {
        this.startConfetti();
        this.burstHeartsAt(0, 1.9, -0.5, 12);
      }
      late = el > 2500;
    }
    if (step === 0) late = el > 1500;
    this.opts.onStep?.(step, late);
  }

  private updateCeremony(t: number, nowMs: number, nowP: number) {
    const c = this.ceremony;
    const step = c ? c.step : -1;
    const el = c ? Math.max(0, nowMs - c.stepStartedAt) : 0;
    const key = c ? `${c.round}:${step}:${c.stepStartedAt}` : 'lobby';
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.enterStep(step, el);
    }
    const g = this.actors.groom;
    const b = this.actors.bride;
    let walking = false;
    let walkG = false;
    let walkB = false;
    let clap = false;
    let speaker: 'groom' | 'bride' | null = null;
    if (g && b) {
      if (step < 0) {
        this.applyEnt('groom', g.root);
        this.applyEnt('bride', b.root);
        walkG = !!this.ents.get('groom')?.moving;
        walkB = !!this.ents.get('bride')?.moving;
      } else if (step === 0) {
        const tt = clamp(el / WALK_MS, 0, 1);
        const e = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
        (['groom', 'bride'] as const).forEach((role) => {
          const s = role === 'groom' ? -1 : 1;
          const p = role === 'groom' ? g : b;
          const z = lerp(9.5, -0.5, e);
          const x = lerp(s * 0.5, s * 0.85, ss(0.78, 1, tt));
          const target = role === 'groom' ? Math.PI / 2 : Math.PI * 1.5;
          p.root.position.set(x, platformY(z), z);
          p.root.rotation.y = Math.PI + (target - Math.PI) * ss(0.82, 1, tt);
        });
        walking = tt < 1;
        clap = walking;
      } else {
        const k = step >= 5 ? ss(0, 1, step === 5 ? el / 1500 : 1) : 0;
        g.root.position.set(-lerp(0.85, 0.4, k), 0.12, -0.5);
        b.root.position.set(lerp(0.85, 0.4, k), 0.12, -0.5);
        g.root.rotation.y = Math.PI / 2;
        b.root.rotation.y = Math.PI * 1.5;
        if (step === 3) speaker = Math.floor(el / 2600) % 2 ? 'bride' : 'groom';
        clap = step === 5;
      }
      animPerson(g, t, walking || walkG);
      animPerson(b, t, walking || walkB);
      g.head.rotation.x = speaker === 'groom' ? Math.sin(t * 9) * 0.06 : 0;
      b.head.rotation.x = speaker === 'bride' ? Math.sin(t * 9) * 0.06 : 0;
    }
    this.guests.forEach(({ p }, id) => {
      this.applyEnt(id, p.root);
      const moving = !!this.ents.get(id)?.moving;
      animPerson(p, t, moving);
      const clapping = clap || (this.clapUntil.get(id) ?? 0) > nowP;
      p.arms.forEach((a) => {
        if (clapping) {
          a.rotation.x = -1.05;
          a.rotation.z = -a.userData.s * (0.2 + (Math.sin(t * 14 + p.phase) * 0.5 + 0.5) * 0.35);
        } else {
          a.rotation.z = a.userData.base;
        }
      });
    });
  }

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const nowP = performance.now();
    this.stepLocal(dt, nowP);
    this.updateEnts(dt, nowP);
    this.updateCeremony(nowP / 1000, Date.now(), nowP);
    this.updateFx(dt);
    this.worldAnim(nowP / 1000);
    this.updateCam(dt, nowP);
    this.updateLabels();
    const le = this.localId ? this.ents.get(this.localId) : null;
    if (le && this.ring.visible) this.ring.position.set(le.x, groundY(le.x, le.z) + 0.03, le.z);
    this.renderer.render(this.scene, this.camera);
  };
}
