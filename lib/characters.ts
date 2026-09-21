import * as THREE from 'three';
import type { Look } from './types';
import { hash, rng } from './util';

export { SKINS, HAIRC, CLOTHC, OPT, DEFAULT_LOOKS, cloneLook, randomLook, guestLook, type OptSet } from './looks';

/* ---------- أدوات THREE ---------- */
export function M(c: THREE.ColorRepresentation, o?: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, metalness: 0, ...(o || {}) });
}
function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c;
}
export function add(p: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  p.add(o);
  return o;
}
export function disposeObj(o: THREE.Object3D) {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = (m as { material?: THREE.Material | THREE.Material[] }).material;
    if (mat) {
      (Array.isArray(mat) ? mat : [mat]).forEach((mm) => {
        const mp = (mm as THREE.MeshBasicMaterial).map;
        if (mp) mp.dispose();
        mm.dispose();
      });
    }
  });
}

export interface Person {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legs: THREE.Group[];
  arms: THREE.Group[];
  hold: boolean;
  phase: number;
  label: THREE.Sprite | null;
}

export function makeLabel(text: string, gold = false): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 84;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(10,14,30,.66)';
  const rx = 8, ry = 10, w = 304, h = 64, r = 32;
  x.beginPath();
  x.moveTo(rx + r, ry);
  x.lineTo(rx + w - r, ry);
  x.arc(rx + w - r, ry + r, r, -Math.PI / 2, Math.PI / 2);
  x.lineTo(rx + r, ry + h);
  x.arc(rx + r, ry + r, r, Math.PI / 2, Math.PI * 1.5);
  x.closePath();
  x.fill();
  if (gold) {
    x.strokeStyle = '#d8b55a';
    x.lineWidth = 3;
    x.stroke();
  }
  x.fillStyle = gold ? '#ffe9a8' : '#fff';
  x.font = '700 32px Tajawal, Tahoma, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 160, 44, 280);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(1.3, 0.34, 1);
  return sp;
}

export function attachLabel(p: Person, text: string, y: number, scale = 1, gold = false) {
  if (p.label) {
    p.root.remove(p.label);
    disposeObj(p.label);
  }
  p.label = makeLabel(text, gold);
  p.label.position.set(0, y, 0);
  p.label.scale.multiplyScalar(scale);
  p.label.userData.s0 = p.label.scale.clone();
  p.root.add(p.label);
}

/* ---------- بناء الشخصية ---------- */
export function buildPerson(cfg: Look): Person {
  const female = cfg.female;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = M(cfg.skin, { roughness: 0.5 });
  const cloth = M(cfg.color);
  const hairM = M(cfg.hair, { roughness: 0.85, side: THREE.DoubleSide });
  const gold = M('#d8b55a', { metalness: 0.7, roughness: 0.3 });
  const dark = M('#141414', { roughness: 0.4 });
  const white = M('#ffffff');
  const legs: THREE.Group[] = [];
  const arms: THREE.Group[] = [];
  let hold = false;
  const o = cfg.outfit;
  const acc = cfg.acc || {};
  const hs = cfg.hairStyle;
  let frontZ = 0.19;
  let rr: ((y: number) => number) | null = null;

  /* الرأس */
  const head = new THREE.Group();
  head.position.y = 1.62;
  body.add(head);
  add(head, new THREE.SphereGeometry(0.27, 32, 24), skin);
  add(head, new THREE.SphereGeometry(0.032, 12, 10), dark, -0.09, 0.04, 0.245);
  add(head, new THREE.SphereGeometry(0.032, 12, 10), dark, 0.09, 0.04, 0.245);
  const nose = add(head, new THREE.SphereGeometry(0.035, 12, 10), skin, 0, -0.02, 0.265);
  nose.scale.set(1, 1, 0.8);
  const smile = add(head, new THREE.TorusGeometry(0.07, 0.013, 8, 20, Math.PI), M('#8a2b2b'), 0, -0.06, 0.262);
  smile.rotation.z = Math.PI;
  [-1, 1].forEach((s) => {
    const ch = add(head, new THREE.SphereGeometry(0.035, 10, 8), M('#ff9aa2'), s * 0.15, -0.03, 0.215);
    ch.scale.z = 0.4;
    ch.castShadow = false;
  });
  add(body, new THREE.CylinderGeometry(0.085, 0.09, 0.16, 12), skin, 0, 1.36, 0);

  const cap = (r: number, th: number) => {
    const m = add(head, new THREE.SphereGeometry(r, 32, 20, 0, Math.PI * 2, 0, th), hairM, 0, 0.015, -0.012);
    m.rotation.x = -0.32;
    return m;
  };
  if (hs === 'short') {
    cap(0.285, Math.PI * 0.5);
  } else if (hs === 'curly') {
    cap(0.283, Math.PI * 0.46);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      add(head, new THREE.SphereGeometry(0.075, 10, 8), hairM, Math.cos(a) * 0.2, 0.17 + (i % 2) * 0.03, Math.sin(a) * 0.2 - 0.03);
    }
    add(head, new THREE.SphereGeometry(0.09, 10, 8), hairM, 0, 0.27, -0.02);
  } else if (hs === 'long') {
    cap(0.288, Math.PI * 0.52);
    const lb = add(head, new THREE.CylinderGeometry(0.25, 0.19, 0.8, 20), hairM, 0, -0.3, -0.09);
    lb.scale.z = 0.55;
  } else if (hs === 'bun') {
    cap(0.285, Math.PI * 0.5);
    add(head, new THREE.SphereGeometry(0.11, 16, 12), hairM, 0, 0.3, -0.1);
  } else if (hs === 'hijab') {
    add(head, new THREE.SphereGeometry(0.3, 32, 24, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6), hairM, 0, 0.02, -0.02);
    add(body, new THREE.CylinderGeometry(0.23, 0.36, 0.46, 28, 1, true), hairM, 0, 1.16, -0.01);
  }

  const arm = (s: number, len: number, r: number, mat: THREE.Material, x: number, y: number) => {
    const g = new THREE.Group();
    g.position.set(s * x, y, 0);
    add(g, new THREE.CylinderGeometry(r, r * 0.9, len, 14), mat, 0, -len / 2, 0);
    add(g, new THREE.SphereGeometry(r * 1.02, 12, 10), mat, 0, 0, 0);
    add(g, new THREE.SphereGeometry(0.068, 12, 10), skin, 0, -len - 0.015, 0);
    g.rotation.z = s * 0.12;
    g.userData = { s, base: s * 0.12, rx: 0 };
    body.add(g);
    arms.push(g);
  };

  /* اللباس */
  if (o === 'suit') {
    const pants = M(shade(cfg.color, 0.75));
    [-1, 1].forEach((s) => {
      const lg = new THREE.Group();
      lg.position.set(s * 0.13, 0.82, 0);
      add(lg, new THREE.BoxGeometry(0.2, 0.78, 0.22), pants, 0, -0.39, 0);
      add(lg, new THREE.BoxGeometry(0.22, 0.06, 0.32), dark, 0, -0.79, 0.04);
      body.add(lg);
      legs.push(lg);
    });
    add(body, new THREE.BoxGeometry(0.64, 0.58, 0.34), cloth, 0, 1.09, 0);
    add(body, new THREE.BoxGeometry(0.2, 0.46, 0.02), white, 0, 1.14, 0.175);
    if (!acc.bowtie) add(body, new THREE.BoxGeometry(0.06, 0.36, 0.02), M('#9b1c1c'), 0, 1.12, 0.19);
    [-1, 1].forEach((s) => arm(s, 0.62, 0.075, cloth, 0.4, 1.3));
    frontZ = 0.2;
  } else if (o === 'jellaba' || o === 'kaftan') {
    const rt = female ? 0.25 : 0.31;
    const rb = female ? 0.48 : 0.5;
    add(body, new THREE.CylinderGeometry(rt, rb, 1.34, 32), cloth, 0, 0.675, 0);
    const rf = (y: number) => rb - (rb - rt) * ((y - 0.005) / 1.34);
    rr = rf;
    if (o === 'kaftan') {
      const bt = add(body, new THREE.TorusGeometry(rf(1.02) + 0.01, 0.03, 8, 32), gold, 0, 1.02, 0);
      bt.rotation.x = Math.PI / 2;
      const hm = add(body, new THREE.TorusGeometry(rb + 0.005, 0.03, 8, 40), gold, 0, 0.03, 0);
      hm.rotation.x = Math.PI / 2;
      for (let k = 0; k < 7; k++) {
        const y = 1.25 - k * 0.14;
        add(body, new THREE.SphereGeometry(0.028, 8, 8), gold, 0, y, rf(y) + 0.005);
      }
      const nt = add(body, new THREE.TorusGeometry(rf(1.3) * 0.8, 0.02, 8, 24), gold, 0, 1.32, 0);
      nt.rotation.x = Math.PI / 2;
    } else {
      for (let k = 0; k < 6; k++) {
        const y = 1.25 - k * 0.15;
        add(body, new THREE.SphereGeometry(0.03, 8, 8), gold, 0, y, rf(y) + 0.005);
      }
      const hood = add(body, new THREE.ConeGeometry(0.24, 0.42, 16), cloth, 0, 1.42, -0.2);
      hood.rotation.x = -0.9;
      [-1, 1].forEach((s) => {
        const b = add(body, new THREE.SphereGeometry(0.12, 12, 8), M('#e0b13a'), s * 0.13, 0.05, 0.22);
        b.scale.set(0.9, 0.5, 1.5);
      });
    }
    [-1, 1].forEach((s) => arm(s, 0.6, o === 'jellaba' ? 0.11 : 0.095, cloth, rt + 0.08, 1.3));
    frontZ = rf(1.3) + 0.02;
  } else {
    const pts = (o === 'gown'
      ? [[0.01, 0.02], [0.8, 0.02], [0.74, 0.22], [0.52, 0.68], [0.3, 0.98], [0.2, 1.12]]
      : [[0.01, 0.02], [0.46, 0.02], [0.3, 0.3], [0.2, 0.58], [0.24, 0.86], [0.2, 1.12]]
    ).map((p) => new THREE.Vector2(p[0], p[1]));
    add(body, new THREE.LatheGeometry(pts, 40), M(cfg.color, { side: THREE.DoubleSide }), 0, 0, 0);
    add(body, new THREE.CylinderGeometry(0.21, 0.19, 0.2, 24), cloth, 0, 1.2, 0);
    add(body, new THREE.CylinderGeometry(0.16, 0.2, 0.14, 20), skin, 0, 1.37, 0);
    const sa = add(body, new THREE.TorusGeometry(0.2, 0.02, 8, 24), gold, 0, 1.12, 0);
    sa.rotation.x = Math.PI / 2;
    const hm2 = add(body, new THREE.TorusGeometry(o === 'gown' ? 0.79 : 0.45, 0.025, 8, 40), white, 0, 0.03, 0);
    hm2.rotation.x = Math.PI / 2;
    [-1, 1].forEach((s) => arm(s, 0.6, 0.05, skin, 0.24, 1.36));
    frontZ = 0.22;
  }

  /* الإكسسوارات */
  if (acc.bowtie && !female && (o === 'suit' || o === 'jellaba' || o === 'kaftan')) {
    const bm = M('#9b1c1c');
    const w1 = add(body, new THREE.ConeGeometry(0.07, 0.14, 8), bm, -0.08, 1.3, frontZ);
    w1.rotation.z = -Math.PI / 2;
    const w2 = add(body, new THREE.ConeGeometry(0.07, 0.14, 8), bm, 0.08, 1.3, frontZ);
    w2.rotation.z = Math.PI / 2;
    add(body, new THREE.SphereGeometry(0.04, 10, 8), bm, 0, 1.3, frontZ);
  }
  if (acc.tarbouche) {
    add(head, new THREE.CylinderGeometry(0.13, 0.17, 0.22, 20), M('#b3202a'), 0, 0.3, 0);
    add(head, new THREE.SphereGeometry(0.03, 8, 8), gold, 0, 0.42, 0);
  }
  if (acc.beard) {
    const bd = add(head, new THREE.SphereGeometry(0.18, 20, 14), hairM, 0, -0.19, 0.08);
    bd.scale.set(1, 0.5, 0.9);
  }
  if (acc.shades) {
    add(head, new THREE.BoxGeometry(0.14, 0.08, 0.03), dark, -0.09, 0.04, 0.262);
    add(head, new THREE.BoxGeometry(0.14, 0.08, 0.03), dark, 0.09, 0.04, 0.262);
    add(head, new THREE.BoxGeometry(0.05, 0.015, 0.02), dark, 0, 0.055, 0.268);
  }
  if (acc.flower && !female) {
    add(body, new THREE.SphereGeometry(0.05, 10, 8), M('#e58fb0'), -0.22, 1.25, frontZ);
  }
  if (acc.veil) {
    const v = add(head, new THREE.PlaneGeometry(0.85, 1.7), M('#ffffff', { transparent: true, opacity: 0.45, side: THREE.DoubleSide }), 0, -0.75, -0.3);
    v.rotation.x = 0.05;
    v.castShadow = false;
  }
  if (acc.tiara) {
    const R = hs === 'hijab' ? 0.278 : 0.258;
    const tr = add(head, new THREE.TorusGeometry(R, 0.014, 8, 36), gold, 0, 0.16, 0);
    tr.rotation.x = Math.PI / 2;
    add(head, new THREE.ConeGeometry(0.035, 0.11, 6), gold, 0, 0.22, R);
    add(head, new THREE.SphereGeometry(0.026, 10, 8), M('#ff4d6d', { emissive: 0x551122 }), 0, 0.16, R + 0.006);
  }
  if (acc.necklace) {
    const nr = o === 'gown' || o === 'mermaid' ? 0.205 : rr ? rr(1.3) + 0.012 : 0.34;
    const nk = add(body, new THREE.TorusGeometry(nr, 0.012, 8, 32), gold, 0, 1.31, 0);
    nk.rotation.x = Math.PI / 2;
  }
  if (acc.bouquet) {
    hold = true;
    arms.forEach((a) => {
      a.rotation.x = -0.85;
      a.rotation.z = -a.userData.s * 0.14;
      a.userData.base = a.rotation.z;
      a.userData.rx = -0.85;
    });
    const bq = new THREE.Group();
    bq.position.set(0, 0.98, 0.5);
    body.add(bq);
    const pal = ['#ff6b8b', '#ffffff', '#ffb3c6', '#ffd166'];
    for (let q = 0; q < 7; q++) {
      const aa = (q / 7) * Math.PI * 2;
      add(bq, new THREE.SphereGeometry(0.07, 10, 8), M(pal[q % 4], { roughness: 0.8 }), Math.cos(aa) * 0.08, 0.05 + Math.sin(aa) * 0.06, Math.sin(aa) * 0.03);
    }
    add(bq, new THREE.SphereGeometry(0.07, 10, 8), M('#ff6b8b'), 0, 0.06, 0.03);
    const st = add(bq, new THREE.ConeGeometry(0.04, 0.22, 8), M('#2e7d4f'), 0, -0.12, 0);
    st.rotation.x = Math.PI;
  }

  return { root, body, head, legs, arms, hold, phase: Math.random() * 6, label: null };
}
