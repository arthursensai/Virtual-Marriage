import * as THREE from 'three';
import { M, add, makeLabel } from './characters';
import { rng } from './util';

/** حدود الساحة التي يتحرك فيها اللاعبون */
export const BOUNDS = { minX: -9.2, maxX: 9.2, minZ: -4.6, maxZ: 13.6 };

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

export interface World {
  obstacles: Obstacle[];
  /** ملصقات فوق المحطات (تُكبَّر مع بُعد الكاميرا) */
  signs: THREE.Sprite[];
  animate: (t: number) => void;
}

/** ارتفاع الأرض تحت نقطة (المنصّة المرتفعة قليلًا عند المذبح) */
export function groundY(x: number, z: number) {
  const d = Math.hypot(x, z + 0.5);
  return 0.12 * Math.min(1, Math.max(0, (2.85 - d) / 0.3));
}

/** يبني الساحة: الأرضية والسياج والكراسي والمحطات (رقص، كعكة، هدايا، نافورة، تصوير) والبوابة */
export function buildWorld(scene: THREE.Scene): World {
  const obstacles: Obstacle[] = [];
  const signs: THREE.Sprite[] = [];
  const r = rng(99);
  const ivory = M('#f3ece0');
  const gold = M('#d8b55a', { metalness: 0.6, roughness: 0.4 });
  const hedgeMat = M('#1f5a3a', { roughness: 1 });
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffcf6b });

  /* الأرضية */
  const plaza = add(scene, new THREE.BoxGeometry(19.6, 0.06, 19.6), M('#a89878', { roughness: 1 }), 0, -0.03, 4.25);
  plaza.receiveShadow = true;

  /* السياج (مع فتحة عند البوابة الجنوبية) */
  const hedge = (w: number, d: number, x: number, z: number) => {
    const h = add(scene, new THREE.BoxGeometry(w, 0.8, d), hedgeMat, x, 0.4, z);
    h.castShadow = true;
  };
  hedge(19.8, 0.5, 0, -5.55);
  hedge(0.5, 19.6, -9.9, 4.25);
  hedge(0.5, 19.6, 9.9, 4.25);
  hedge(8.2, 0.5, -5.8, 14.05);
  hedge(8.2, 0.5, 5.8, 14.05);

  /* أعمدة فوانيس على الأطراف */
  const pole = (x: number, z: number) => {
    add(scene, new THREE.CylinderGeometry(0.04, 0.05, 2.4, 8), M('#5a4630'), x, 1.2, z);
    add(scene, new THREE.SphereGeometry(0.15, 14, 10), lanternMat, x, 2.5, z);
  };
  for (let i = 0; i < 5; i++) {
    const z = -3.6 + i * 4.4;
    pole(-9.5, z);
    pole(9.5, z);
  }
  [-8, -4, 4, 8].forEach((x) => pole(x, -5.2));

  /* بوابة الدخول */
  const gate = new THREE.Group();
  gate.position.set(0, 0, 14.05);
  scene.add(gate);
  [-1.6, 1.6].forEach((x) => add(gate, new THREE.CylinderGeometry(0.14, 0.17, 3, 12), ivory, x, 1.5, 0));
  add(gate, new THREE.TorusGeometry(1.6, 0.09, 10, 40, Math.PI), gold, 0, 3, 0);
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * Math.PI;
    add(gate, new THREE.SphereGeometry(0.08, 8, 6), lanternMat, Math.cos(t) * 1.6, 3 + Math.sin(t) * 1.6, 0);
  }

  /* شجيرات ورد حول المذبح وعلى الأطراف */
  const pal = ['#ffb3c6', '#ffffff', '#ff6b8b', '#ffd166', '#f7a8d8'];
  const bush = (x: number, z: number, s = 1) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    add(g, new THREE.SphereGeometry(0.55, 12, 10), M('#2e7d4f', { roughness: 1 }), 0, 0.45, 0);
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const u = r() * 0.9;
      add(g, new THREE.SphereGeometry(0.07 + r() * 0.05, 8, 6), M(pal[Math.floor(r() * pal.length)], { roughness: 0.8 }), Math.cos(a) * 0.5, 0.45 + Math.sin(u) * 0.35, Math.sin(a) * 0.5);
    }
    scene.add(g);
  };
  [[-3.6, -1.9], [3.6, -1.9], [-3.9, 0.9], [3.9, 0.9], [-9, -5], [9, -5], [-9, 13], [9, 13], [-1.9, 13.2], [1.9, 13.2]].forEach(([x, z]) => bush(x, z, 1.1));

  /* كراسي الضيوف على جانبي الممشى */
  const chairMat = M('#f7f1e4');
  for (const side of [-1, 1]) {
    for (const col of [1.75, 2.6]) {
      for (let row = 0; row < 4; row++) {
        const x = side * col;
        const z = 2.6 + row * 1.5;
        const c = new THREE.Group();
        c.position.set(x, 0, z);
        add(c, new THREE.BoxGeometry(0.5, 0.07, 0.5), chairMat, 0, 0.45, 0);
        add(c, new THREE.BoxGeometry(0.5, 0.5, 0.06), chairMat, 0, 0.72, 0.24);
        add(c, new THREE.BoxGeometry(0.52, 0.03, 0.08), gold, 0, 0.98, 0.24);
        [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([lx, lz]) => add(c, new THREE.BoxGeometry(0.04, 0.42, 0.04), gold, lx, 0.21, lz));
        scene.add(c);
        obstacles.push({ x, z, r: 0.3 });
      }
    }
  }

  /* أرضية الرقص + كرة الديسكو */
  const DX = 6.2;
  const DZ = 6.6;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const cx = cv.getContext('2d')!;
  const cols = ['#ff5c9a', '#7a4dff', '#2f5fa8', '#ffb347'];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      cx.fillStyle = cols[(i + j * 3) % cols.length];
      cx.fillRect(i * 32, j * 32, 32, 32);
      cx.fillStyle = 'rgba(255,255,255,.14)';
      cx.fillRect(i * 32, j * 32, 32, 3);
    }
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(DX, 0.02, DZ);
  scene.add(floor);
  [[0, -2.25, 4.6, 0.1], [0, 2.25, 4.6, 0.1], [-2.25, 0, 0.1, 4.4], [2.25, 0, 0.1, 4.4]].forEach(([ox, oz, w, d]) =>
    add(scene, new THREE.BoxGeometry(w, 0.05, d), gold, DX + ox, 0.03, DZ + oz),
  );
  const disco = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 16), new THREE.MeshStandardMaterial({ color: 0xdfe6ff, metalness: 1, roughness: 0.15, flatShading: true }));
  disco.position.set(DX, 3.6, DZ);
  scene.add(disco);
  add(scene, new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4), gold, DX, 4.5, DZ);
  const discoLight = new THREE.PointLight(0xff7ac8, 0.9, 8, 1.5);
  discoLight.position.set(DX, 3.2, DZ);
  scene.add(discoLight);

  /* طاولة الكعكة */
  const CX = -6.2;
  const CZ = 5.6;
  add(scene, new THREE.CylinderGeometry(0.85, 0.85, 0.9, 24), ivory, CX, 0.45, CZ);
  add(scene, new THREE.CylinderGeometry(0.9, 0.9, 0.04, 24), gold, CX, 0.92, CZ);
  [[0.55, 0.3], [0.4, 0.28], [0.26, 0.26]].forEach(([rad, h], i) => {
    const y = 0.94 + [0, 0.3, 0.58][i] + h / 2;
    add(scene, new THREE.CylinderGeometry(rad, rad, h, 24), M(i === 1 ? '#ffd6e1' : '#fff7f0'), CX, y, CZ);
  });
  add(scene, new THREE.SphereGeometry(0.09, 10, 8), M('#e63956'), CX, 1.9, CZ);
  obstacles.push({ x: CX, z: CZ, r: 0.95 });

  /* طاولة الهدايا */
  const GX = -6.2;
  const GZ = 9.4;
  add(scene, new THREE.BoxGeometry(1.8, 0.9, 0.9), ivory, GX, 0.45, GZ);
  add(scene, new THREE.BoxGeometry(1.9, 0.05, 1), gold, GX, 0.92, GZ);
  const giftCols = ['#e63956', '#4cc9f0', '#ffd166', '#9b5de5', '#06d6a0'];
  [[-0.6, 0.28, 0.35], [-0.1, 0.34, 0.42], [0.45, 0.26, 0.32], [0.2, 0.2, 0.26]].forEach(([ox, s, h], i) => {
    const y = 0.95 + h / 2;
    add(scene, new THREE.BoxGeometry(s + 0.1, h, s + 0.1), M(giftCols[i % giftCols.length]), GX + ox, y, GZ - 0.05 + (i % 2) * 0.1);
    add(scene, new THREE.BoxGeometry(0.04, h + 0.01, s + 0.12), gold, GX + ox, y, GZ - 0.05 + (i % 2) * 0.1);
  });
  obstacles.push({ x: GX, z: GZ, r: 1.0 });

  /* نافورة */
  const FX = 6.4;
  const FZ = 0.8;
  add(scene, new THREE.CylinderGeometry(1.45, 1.55, 0.4, 32), M('#c9c2b4'), FX, 0.2, FZ);
  const water = add(scene, new THREE.CylinderGeometry(1.25, 1.25, 0.04, 32), new THREE.MeshStandardMaterial({ color: 0x4cc9f0, emissive: 0x0b3a5a, roughness: 0.2, metalness: 0.2 }), FX, 0.38, FZ);
  add(scene, new THREE.CylinderGeometry(0.2, 0.28, 1.1, 14), M('#c9c2b4'), FX, 0.9, FZ);
  add(scene, new THREE.CylinderGeometry(0.62, 0.3, 0.16, 20), M('#c9c2b4'), FX, 1.42, FZ);
  const jet = add(scene, new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0x9fe3ff, emissive: 0x2a7ea6, transparent: true, opacity: 0.85 }), FX, 1.7, FZ);
  obstacles.push({ x: FX, z: FZ, r: 1.55 });

  /* ركن التصوير */
  const PX = -6.2;
  const PZ = -3.6;
  add(scene, new THREE.BoxGeometry(3, 2.5, 0.1), M('#8e1b2e'), PX, 1.35, PZ);
  add(scene, new THREE.BoxGeometry(3.2, 0.1, 0.16), gold, PX, 2.65, PZ + 0.02);
  add(scene, new THREE.BoxGeometry(3.2, 0.1, 0.16), gold, PX, 0.05, PZ + 0.02);
  [-1.55, 1.55].forEach((s) => add(scene, new THREE.BoxGeometry(0.1, 2.6, 0.16), gold, PX + s, 1.35, PZ + 0.02));
  for (let i = 0; i < 26; i++) {
    add(scene, new THREE.SphereGeometry(0.1 + r() * 0.06, 8, 6), M(pal[Math.floor(r() * pal.length)]), PX + (r() - 0.5) * 2.8, 0.3 + r() * 2.1, PZ + 0.1);
  }
  const mark = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 32), new THREE.MeshBasicMaterial({ color: 0xd8b55a, side: THREE.DoubleSide }));
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(PX, 0.035, PZ + 1.4);
  scene.add(mark);
  [-1, 0, 1].forEach((k) => obstacles.push({ x: PX + k * 1, z: PZ, r: 0.5 }));

  /* ملصقات المحطات */
  const sign = (text: string, x: number, y: number, z: number) => {
    const s = makeLabel(text);
    s.position.set(x, y, z);
    s.userData.s0 = s.scale.clone();
    scene.add(s);
    signs.push(s);
  };
  sign('💃 ساحة الرقص', DX, 2.2, DZ - 2.6);
  sign('🎂 الكعكة', CX, 2.5, CZ);
  sign('🎁 الهدايا', GX, 1.9, GZ);
  sign('⛲ النافورة', FX, 2.3, FZ);
  sign('📸 ركن التصوير', PX, 3.1, PZ + 0.3);
  sign('🚪 المدخل', 0, 3.9, 14.05);

  return {
    obstacles,
    signs,
    animate: (t: number) => {
      disco.rotation.y = t * 0.8;
      discoLight.color.setHSL((t * 0.08) % 1, 0.8, 0.6);
      jet.position.y = 1.7 + Math.sin(t * 2.4) * 0.08;
      water.position.y = 0.38 + Math.sin(t * 1.5) * 0.005;
    },
  };
}
