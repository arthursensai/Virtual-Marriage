import { rng } from '../util';
import { mix, shade } from './color';

/**
 * ساحة الحفل بأسلوب البكسل-آرت (منظور علوي مائل مثل ألعاب RPG/Habbo).
 * - طبقة الأرض تُرسم مرة واحدة على canvas خارج الشاشة ثم تُنسخ كل إطار.
 * - المجسّمات (كراسي، مذبح، كعكة...) سبرايتات مرتَّبة بالعمق مع اللاعبين.
 * - وحدة العالم = U بكسل-آرت. لا تعتمد على three.js.
 */
export const U = 20;
export const X0 = -12;
export const Z0 = -9;
export const WU = 24;
export const HU = 27;

export const BOUNDS = { minX: -9.2, maxX: 9.2, minZ: -4.6, maxZ: 13.6 };

export interface Obstacle2D {
  x: number;
  z: number;
  r: number;
}

export const DANCE = { x: 6.2, z: 6.6, size: 4.4 };
const ALTAR = { x: 0, z: -0.5, r: 2.9 };
const GOLD = '#d8b55a';

/* ---------- عوائق التصادم ---------- */
export const OBSTACLES_2D: Obstacle2D[] = (() => {
  const list: Obstacle2D[] = [];
  for (const side of [-1, 1]) for (const col of [1.75, 2.6]) for (let row = 0; row < 4; row++) list.push({ x: side * col, z: 2.6 + row * 1.5, r: 0.3 });
  list.push({ x: -6.2, z: 5.6, r: 0.95 }); // الكعكة
  list.push({ x: -6.2, z: 9.4, r: 1.0 }); // الهدايا
  list.push({ x: 6.4, z: 0.8, r: 1.55 }); // النافورة
  [-1.5, -0.75, 0, 0.75, 1.5].forEach((x) => list.push({ x, z: -1.7, r: 0.3 })); // القوس
  [-1.6, -0.8, 0, 0.8, 1.6].forEach((k) => list.push({ x: -6.2 + k, z: -3.6, r: 0.55 })); // خلفية التصوير
  [[-3.6, -1.9], [3.6, -1.9], [-3.9, 0.9], [3.9, 0.9]].forEach(([x, z]) => list.push({ x, z, r: 0.5 })); // الشجيرات
  return list;
})();

export const STATIONS = [
  { label: '💃 ساحة الرقص', x: DANCE.x, z: DANCE.z - 2.4, up: 4 },
  { label: '🎂 الكعكة', x: -6.2, z: 5.6, up: 52 },
  { label: '🎁 الهدايا', x: -6.2, z: 9.4, up: 40 },
  { label: '⛲ النافورة', x: 6.4, z: 0.8, up: 46 },
  { label: '📸 ركن التصوير', x: -6.2, z: -3.6, up: 56 },
  { label: '🚪 المدخل', x: 0, z: 14.05, up: 76 },
];

/* ---------- أدوات الرسم بالبكسل ---------- */
class Q {
  constructor(public g: CanvasRenderingContext2D) {}
  r(x: number, y: number, w: number, h: number, c: string) {
    this.g.fillStyle = c;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  p(x: number, y: number, c: string) {
    this.r(x, y, 1, 1, c);
  }
  /** قرص بكسلي */
  disc(cx: number, cy: number, rad: number, c: string) {
    this.ell(cx, cy, rad, rad, c);
  }
  ell(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
      const t = ry === 0 ? 0 : dy / (ry + 0.35);
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - t * t)) + 0.35);
      if (half >= 0) this.r(cx - half, cy + dy, half * 2 + 1, 1, c);
    }
  }
}

function mk(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return { cv, q: new Q(cv.getContext('2d')!) };
}

const ax = (x: number) => Math.round((x - X0) * U);
const az = (z: number) => Math.round((z - Z0) * U);
const FLOWERS = ['#ff8fb1', '#ffffff', '#ffc2d4', '#ffd166', '#e5537a'];

/* ============================================================
   طبقة الأرض (ثابتة)
   ============================================================ */
let groundCv: HTMLCanvasElement | null = null;

function buildGround(): HTMLCanvasElement {
  const W = WU * U;
  const H = HU * U;
  const { cv, q } = mk(W, H);
  const rnd = rng(11);

  /* عشب */
  q.r(0, 0, W, H, '#5aa64c');
  for (let i = 0; i < 40; i++) q.disc(rnd() * W, rnd() * H, 3 + rnd() * 5, '#55a048');
  for (let i = 0; i < 600; i++) q.r(rnd() * W, rnd() * H, 2, 1, '#4b9440');
  for (let i = 0; i < 380; i++) q.r(rnd() * W, rnd() * H, 1, 2, '#6dbb5d');

  const px0 = ax(-9.8);
  const px1 = ax(9.8);
  const py0 = az(-5.3);
  const py1 = az(14.1);
  const inPlaza = (x: number, y: number) => x > px0 - 6 && x < px1 + 6 && y > py0 - 20 && y < py1 + 8;
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    if (inPlaza(x, y)) continue;
    const c = FLOWERS[Math.floor(rnd() * FLOWERS.length)];
    q.p(x, y, c);
    q.p(x, y + 1, '#3f8a3a');
  }

  /* أشجار خلف السياج الشمالي */
  const tree = (x: number, z: number, s = 1) => {
    const cx = ax(x);
    const by = az(z);
    q.ell(cx, by + 1, 13 * s, 4 * s, 'rgba(0,0,0,0.2)');
    q.r(cx - 2, by - 10 * s, 4, 11 * s, '#6b4a2e');
    q.r(cx + 1, by - 10 * s, 1, 11 * s, '#563a22');
    q.disc(cx, by - 20 * s, 12 * s, '#2a7a3f');
    q.disc(cx - 6 * s, by - 15 * s, 8 * s, '#2f8a46');
    q.disc(cx + 6 * s, by - 15 * s, 8 * s, '#256f38');
    q.disc(cx - 3 * s, by - 24 * s, 7 * s, '#43a35a');
    q.disc(cx - 4 * s, by - 26 * s, 3 * s, '#63c277');
    for (let i = 0; i < 6; i++) q.p(cx + (rnd() - 0.5) * 20 * s, by - 12 * s - rnd() * 16 * s, '#1f5f31');
  };
  [-9, -5.5, -2, 2, 5.5, 9].forEach((x, i) => tree(x, -7 + (i % 2) * 0.4, 1));

  /* ظل الساحة + حدّها الحجري */
  q.r(px0 + 3, py1 + 3, px1 - px0 + 3, 5, 'rgba(0,0,0,0.18)');
  q.r(px1 + 3, py0 + 3, 5, py1 - py0 + 3, 'rgba(0,0,0,0.14)');
  q.r(px0 - 4, py0 - 4, px1 - px0 + 8, py1 - py0 + 8, '#b7a888');
  q.r(px0 - 3, py0 - 3, px1 - px0 + 6, py1 - py0 + 6, '#cbbd9f');
  /* بلاط */
  for (let y = py0; y < py1; y += 10) {
    for (let x = px0; x < px1; x += 10) {
      const odd = (((x - px0) / 10) | 0) + (((y - py0) / 10) | 0);
      q.r(x, y, 10, 10, odd % 2 ? '#e7dcc4' : '#f0e7d2');
      q.r(x, y, 10, 1, 'rgba(255,255,255,0.35)');
      q.r(x, y, 1, 10, 'rgba(255,255,255,0.22)');
      q.r(x, y + 9, 10, 1, 'rgba(140,120,80,0.16)');
    }
  }
  for (let i = 0; i < 160; i++) q.p(px0 + rnd() * (px1 - px0), py0 + rnd() * (py1 - py0), 'rgba(150,130,90,0.25)');
  q.r(px0, py0, px1 - px0, 1, GOLD);
  q.r(px0, py1 - 1, px1 - px0, 1, GOLD);
  q.r(px0, py0, 1, py1 - py0, GOLD);
  q.r(px1 - 1, py0, 1, py1 - py0, GOLD);

  /* ممشى الدخول خارج البوابة */
  const gx0 = ax(-1.1);
  const gx1 = ax(1.1);
  for (let y = py1; y < az(18.2); y += 10) {
    for (let x = gx0; x < gx1; x += 10) {
      q.r(x, y, 10, 10, (((x - gx0) / 10 + (y - py1) / 10) | 0) % 2 ? '#e0d4b8' : '#eadfc6');
      q.r(x, y + 9, 10, 1, 'rgba(140,120,80,0.2)');
    }
  }
  q.r(gx0 - 2, py1, 2, az(18.2) - py1, '#b7a888');
  q.r(gx1, py1, 2, az(18.2) - py1, '#b7a888');

  /* السجادة الحمراء */
  const cx0 = ax(-0.75);
  const cx1 = ax(0.75);
  const cy0 = az(-1);
  const cy1 = az(11.55);
  q.r(cx0 - 1, cy0, cx1 - cx0 + 2, cy1 - cy0, '#7a1727');
  q.r(cx0, cy0, cx1 - cx0, cy1 - cy0, '#a3243a');
  q.r(cx0 + 2, cy0, 1, cy1 - cy0, GOLD);
  q.r(cx1 - 3, cy0, 1, cy1 - cy0, GOLD);
  q.r(cx0 + 4, cy0, 1, cy1 - cy0, '#7a1727');
  q.r(cx1 - 5, cy0, 1, cy1 - cy0, '#7a1727');
  for (let y = cy0 + 6; y < cy1 - 4; y += 14) {
    const mx = (cx0 + cx1) / 2;
    q.p(mx, y - 2, GOLD);
    q.r(mx - 1, y - 1, 3, 1, GOLD);
    q.r(mx - 2, y, 5, 1, GOLD);
    q.r(mx - 1, y + 1, 3, 1, GOLD);
    q.p(mx, y + 2, GOLD);
  }
  q.r(cx0 - 1, cy1, cx1 - cx0 + 2, 2, GOLD);
  for (let i = 0; i < 46; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    q.p((cx0 + cx1) / 2 + side * (9 + rnd() * 9), cy0 + rnd() * (cy1 - cy0), FLOWERS[Math.floor(rnd() * 3)]);
  }

  /* منصّة المذبح */
  const acx = ax(ALTAR.x);
  const acy = az(ALTAR.z);
  const R = Math.round(ALTAR.r * U);
  q.ell(acx, acy + 9, R + 4, R + 1, 'rgba(0,0,0,0.2)');
  q.disc(acx, acy + 5, R + 2, '#6f5233'); // وجه المنصّة
  q.disc(acx, acy + 2, R + 2, GOLD);
  for (let dy = -R; dy <= R; dy++) {
    const half = Math.floor(Math.sqrt(R * R - dy * dy));
    q.r(acx - half, acy + dy, half * 2 + 1, 1, Math.floor((dy + R) / 3) % 2 ? '#c99e6b' : '#d6ab78');
  }
  for (let dy = -R; dy <= R; dy += 3) {
    const half = Math.floor(Math.sqrt(R * R - dy * dy));
    for (let x = -half + ((dy / 3) & 1) * 6; x < half; x += 14) q.p(acx + x, acy + dy, '#b58a58');
  }
  q.disc(acx, acy, 28, GOLD);
  q.disc(acx, acy, 27, '#8f1d31');
  q.disc(acx, acy, 24, '#a3243a');
  q.disc(acx, acy, 22, '#8f1d31');
  q.disc(acx, acy, 21, '#a3243a');
  const heart = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  heart.forEach((row, j) => [...row].forEach((ch, i) => ch === 'X' && q.p(acx - 3 + i, acy - 3 + j, '#ffd6e1')));
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * Math.PI * 2;
    q.p(acx + Math.cos(t) * 14, acy + Math.sin(t) * 14, GOLD);
  }

  /* أرضية الرقص (الإطار) */
  const dx = ax(DANCE.x);
  const dy0 = az(DANCE.z);
  const ds = Math.round(DANCE.size * U);
  q.r(dx - ds / 2 - 4, dy0 - ds / 2 + 3, ds + 8, ds + 6, 'rgba(0,0,0,0.2)');
  q.r(dx - ds / 2 - 3, dy0 - ds / 2 - 3, ds + 6, ds + 6, GOLD);
  q.r(dx - ds / 2 - 1, dy0 - ds / 2 - 1, ds + 2, ds + 2, '#2a1b3d');

  /* ركن التصوير: علامة الوقوف */
  const mx = ax(-6.2);
  const my = az(-2.2);
  q.ell(mx, my, 13, 5, GOLD);
  q.ell(mx, my, 11, 4, '#f5e7b8');
  q.ell(mx, my, 7, 2, GOLD);

  /* السياج */
  const hedgeH = (xa: number, xb: number, zc: number) => {
    const y = az(zc) + 5;
    for (let x = xa; x < xb; x += 1) {
      const bump = ((x * 7) % 5 === 0 ? 1 : 0) + (rnd() < 0.15 ? 1 : 0);
      q.r(x, y - 16 - bump, 1, 16 + bump, '#2c7038');
    }
    q.r(xa, y - 16, xb - xa, 3, '#43a052');
    q.r(xa, y - 5, xb - xa, 5, '#1f5229');
    for (let i = 0; i < (xb - xa) * 0.9; i++) q.p(xa + rnd() * (xb - xa), y - 14 + rnd() * 9, rnd() < 0.5 ? '#3a8b48' : '#245f30');
    for (let x = xa + 3; x < xb; x += 9) if (rnd() < 0.55) q.p(x + rnd() * 5, y - 12 + rnd() * 6, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
  };
  const hedgeV = (xc: number, za: number, zb: number) => {
    const x = ax(xc) - 5;
    const y0 = az(za) - 11;
    const y1 = az(zb) + 5;
    q.r(x, y0, 10, y1 - y0, '#2c7038');
    q.r(x, y0, 10, 3, '#43a052');
    q.r(x, y0, 2, y1 - y0, '#3a8b48');
    q.r(x + 8, y0, 2, y1 - y0, '#1f5229');
    for (let i = 0; i < (y1 - y0) * 0.5; i++) q.p(x + rnd() * 10, y0 + rnd() * (y1 - y0), rnd() < 0.5 ? '#3a8b48' : '#245f30');
    for (let y = y0 + 6; y < y1; y += 9) if (rnd() < 0.5) q.p(x + 2 + rnd() * 6, y, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
  };
  hedgeH(ax(-9.9), ax(9.9), -5.55);
  hedgeV(-9.9, -5.55, 14.05);
  hedgeV(9.9, -5.55, 14.05);
  hedgeH(ax(-9.9), ax(-1.6), 14.05);
  hedgeH(ax(1.6), ax(9.9), 14.05);

  /* أعمدة الفوانيس وحبال الإضاءة */
  const pole = (x: number, z: number) => {
    const cx = ax(x);
    const by = az(z);
    q.ell(cx, by + 1, 4, 2, 'rgba(0,0,0,0.2)');
    q.r(cx - 1, by - 24, 2, 25, '#5a4630');
    q.r(cx - 3, by - 30, 6, 6, '#3d2f20');
    q.r(cx - 2, by - 29, 4, 4, '#ffcf6b');
    q.p(cx - 1, by - 28, '#fff3c0');
    q.r(cx - 3, by - 31, 6, 1, GOLD);
  };
  LANTERNS.forEach(([x, z]) => pole(x, z));
  const bulbs = (xa: number, za: number, xb: number, zb: number) => {
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax(xa) + (ax(xb) - ax(xa)) * t;
      const y = az(za) - 27 + (az(zb) - az(za)) * t + Math.sin(t * Math.PI) * 5;
      q.p(x, y - 1, '#4a3a28');
      q.r(x, y, 2, 2, i % 2 ? '#ffe08a' : '#ffb3c6');
    }
  };
  for (let i = 0; i < LANTERNS.length - 1; i++) {
    const a = LANTERNS[i];
    const b = LANTERNS[i + 1];
    if (a[1] === b[1] || (a[0] === b[0] && Math.abs(a[1] - b[1]) < 5)) bulbs(a[0], a[1], b[0], b[1]);
  }
  return cv;
}

/** مواضع الفوانيس (س، ع): على جانبي الساحة وخلف الحاجز الشمالي */
export const LANTERNS: [number, number][] = [
  [-8, -5.15], [-4, -5.15], [4, -5.15], [8, -5.15],
  [-9.5, -3.4], [-9.5, 1], [-9.5, 5.4], [-9.5, 9.8], [-9.5, 13.6],
  [9.5, -3.4], [9.5, 1], [9.5, 5.4], [9.5, 9.8], [9.5, 13.6],
];

/* ============================================================
   المجسّمات (سبرايتات مرتّبة بالعمق)
   ============================================================ */
export interface Sprite {
  cv: HTMLCanvasElement;
  ax: number;
  ay: number;
  x: number; // موضع القاعدة في العالم
  z: number;
  fx?: (g: CanvasRenderingContext2D, sx: number, sy: number, k: number, t: number) => void;
}

const EDGE: [number, number, number] = [72, 50, 38];

/** خط محيط رفيع حول البكسلات الصلبة (يبقى الظلّ شبه الشفاف بلا محيط) */
function outlineCanvas(cv: HTMLCanvasElement) {
  const w = cv.width;
  const h = cv.height;
  const g = cv.getContext('2d')!;
  const src = g.getImageData(0, 0, w, h);
  const s = src.data;
  const d = new Uint8ClampedArray(s);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && s[(y * w + x) * 4 + 3] > 200;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (s[i + 3] > 200) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        d[i] = EDGE[0];
        d[i + 1] = EDGE[1];
        d[i + 2] = EDGE[2];
        d[i + 3] = 235;
      }
    }
  }
  g.putImageData(new ImageData(d, w, h), 0, 0);
}

function sprite(w: number, h: number, ax_: number, ay_: number, x: number, z: number, draw: (q: Q) => void): Sprite {
  const { cv, q } = mk(w + 2, h + 2);
  q.g.translate(1, 1);
  draw(q);
  q.g.setTransform(1, 0, 0, 1, 0, 0);
  outlineCanvas(cv);
  return { cv, ax: ax_ + 1, ay: ay_ + 1, x, z };
}

function chairSprite(x: number, z: number, i: number): Sprite {
  return sprite(12, 16, 6, 12, x, z, (q) => {
    q.r(1, 10, 10, 3, 'rgba(0,0,0,0.18)');
    q.r(2, 3, 8, 6, '#f0e6d0'); // المقعد
    q.r(2, 8, 8, 1, '#d6c9a8');
    q.r(2, 7, 8, 5, '#fbf6ea'); // الظهر (يواجه المشاهد)
    q.r(2, 7, 8, 1, GOLD);
    q.r(2, 11, 8, 1, '#e2d6bc');
    q.r(1, 6, 1, 6, '#c9a24a');
    q.r(10, 6, 1, 6, '#c9a24a');
    if (i % 2 === 0) {
      q.r(5, 9, 2, 2, '#e58fb0');
      q.p(4, 10, '#e58fb0');
      q.p(7, 10, '#e58fb0');
    }
    q.r(2, 12, 1, 2, '#c9a24a');
    q.r(9, 12, 1, 2, '#c9a24a');
  });
}

function archSprite(): Sprite {
  const W = 84;
  const H = 76;
  const s = sprite(W, H, 42, 68, 0, -1.7, (q) => {
    const rnd = rng(5);
    const cx = 42;
    const base = 68;
    const pillar = (x: number) => {
      q.ell(x, base + 1, 7, 3, 'rgba(0,0,0,0.22)');
      q.r(x - 4, base - 30, 8, 30, '#f5efe0');
      q.r(x + 1, base - 30, 3, 30, '#dcd2bb');
      q.r(x - 5, base - 32, 10, 3, GOLD);
      q.r(x - 5, base - 2, 10, 3, '#cfc4a8');
      for (let y = base - 28; y < base - 3; y += 4) {
        q.p(x - 3 + ((y / 4) & 1) * 4, y, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
        q.p(x - 2 + ((y / 4) & 1) * 3, y + 1, '#3b9c4f');
      }
    };
    pillar(cx - 30);
    pillar(cx + 30);
    const top = base - 32;
    for (let a = 0; a <= 60; a++) {
      const t = Math.PI + (a / 60) * Math.PI;
      const x = cx + Math.cos(t) * 30;
      const y = top + Math.sin(t) * 30;
      q.disc(x, y, 2, '#2f8f4a');
      if (a % 3 === 0) {
        q.disc(x + rnd() * 2 - 1, y + rnd() * 2 - 1, 2, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
        q.p(x, y, '#ffd166');
      }
    }
    [cx - 30, cx + 30].forEach((x) => {
      q.disc(x, top - 3, 5, '#ff8fb1');
      q.disc(x - 3, top - 1, 3, '#ffffff');
      q.disc(x + 3, top - 1, 3, '#ffc2d4');
      q.p(x, top - 3, '#ffd166');
    });
    // خاتم الزفاف في القمة
    q.disc(cx, top - 30, 4, GOLD);
    q.disc(cx, top - 30, 2, '#5f4b1a');
    q.r(cx - 1, top - 36, 3, 3, '#bfeaff');
    q.p(cx, top - 37, '#ffffff');
    // ستائر شفافة
    for (let y = top; y < base - 4; y += 2) {
      q.p(cx - 27 + Math.sin(y) * 1, y, 'rgba(255,255,255,0.35)');
      q.p(cx + 27 + Math.sin(y) * 1, y, 'rgba(255,255,255,0.35)');
    }
  });
  return s;
}

function cakeSprite(): Sprite {
  return sprite(50, 62, 25, 52, -6.2, 5.6, (q) => {
    const cx = 25;
    q.ell(cx, 52, 19, 6, 'rgba(0,0,0,0.2)');
    // القماش
    q.r(cx - 16, 38, 33, 14, '#f7f1e4');
    q.r(cx - 16, 38, 33, 1, '#ffffff');
    q.r(cx + 8, 38, 9, 14, '#e6dcc8');
    q.r(cx - 16, 44, 33, 2, '#f7b8cb');
    for (let x = -15; x <= 15; x += 6) q.disc(cx + x, 52, 3, '#f7f1e4');
    for (let x = -15; x <= 15; x += 6) q.p(cx + x, 54, '#e6dcc8');
    // سطح الطاولة
    q.ell(cx, 36, 17, 7, '#fffaf0');
    q.ell(cx, 37, 17, 6, '#efe6d2');
    q.ell(cx, 36, 17, 7, '#fffaf0');
    q.ell(cx, 35, 12, 4, GOLD);
    q.ell(cx, 35, 11, 3, '#fff2c4');
    // الكعكة (٣ طبقات)
    const tier = (w: number, top: number, h: number, band: string) => {
      q.r(cx - w, top, w * 2, h, '#fff7f0');
      q.r(cx + w - 3, top, 3, h, '#f0e2d6');
      q.r(cx - w, top + Math.floor(h / 2), w * 2, 2, band);
      q.ell(cx, top, w, Math.max(2, Math.floor(w / 3)), '#ffffff');
      for (let x = -w + 2; x < w; x += 4) q.r(cx + x, top + h - 1, 2, 2, '#ffffff');
    };
    tier(9, 26, 8, '#f7b8cb');
    tier(6, 19, 7, '#ff9fbb');
    tier(4, 13, 6, '#f7b8cb');
    q.r(cx - 1, 8, 3, 3, '#e5314f');
    q.p(cx, 7, '#e5314f');
    q.p(cx - 2, 8, '#e5314f');
    q.p(cx + 2, 8, '#e5314f');
    q.p(cx, 6, '#ffd166');
    // ورد صغير حول القاعدة
    [[-8, 34], [8, 34], [-4, 37], [5, 37]].forEach(([x, y], i) => q.disc(cx + x, y, 1, FLOWERS[i % FLOWERS.length]));
  });
}

function giftSprite(): Sprite {
  return sprite(50, 44, 25, 34, -6.2, 9.4, (q) => {
    const cx = 25;
    q.ell(cx, 35, 22, 5, 'rgba(0,0,0,0.2)');
    q.r(cx - 19, 22, 38, 12, '#f7f1e4');
    q.r(cx + 10, 22, 9, 12, '#e6dcc8');
    q.r(cx - 19, 26, 38, 2, GOLD);
    for (let x = -18; x <= 16; x += 6) q.disc(cx + x, 34, 3, '#f7f1e4');
    q.r(cx - 20, 19, 40, 4, '#fffaf0');
    q.r(cx - 20, 19, 40, 1, GOLD);
    const box = (x: number, y: number, w: number, h: number, c: string) => {
      q.r(x, y, w, h, c);
      q.r(x + w - 2, y, 2, h, shade(c, 0.78));
      q.r(x, y, w, 1, shade(c, 1.25));
      q.r(x + Math.floor(w / 2) - 1, y, 2, h, GOLD);
      q.r(x, y + Math.floor(h / 2) - 1, w, 2, GOLD);
      q.p(x + Math.floor(w / 2) - 2, y - 1, GOLD);
      q.p(x + Math.floor(w / 2) + 1, y - 1, GOLD);
    };
    box(cx - 17, 10, 9, 9, '#e63956');
    box(cx - 7, 5, 10, 14, '#4cc9f0');
    box(cx + 5, 11, 9, 8, '#ffd166');
    box(cx + 13, 13, 6, 6, '#9b5de5');
    box(cx - 3, 0, 6, 6, '#06d6a0');
  });
}

function fountainSprite(): Sprite {
  const s = sprite(78, 66, 39, 46, 6.4, 0.8, (q) => {
    const cx = 39;
    q.ell(cx, 48, 34, 14, 'rgba(0,0,0,0.2)');
    q.ell(cx, 44, 32, 17, '#a59d8c'); // جدار الحوض
    q.ell(cx, 40, 32, 17, '#d8d0be');
    q.ell(cx, 40, 28, 14, '#efe8d8');
    q.ell(cx, 41, 25, 12, '#4db5e6'); // الماء
    q.ell(cx, 40, 22, 10, '#63c7f0');
    q.ell(cx, 39, 15, 6, '#7fd6f7');
    // العمود والوعاء العلوي
    q.r(cx - 3, 20, 7, 20, '#cfc7b4');
    q.r(cx + 1, 20, 3, 20, '#b7af9c');
    q.ell(cx, 22, 13, 5, '#d8d0be');
    q.ell(cx, 22, 11, 4, '#63c7f0');
    q.r(cx - 2, 11, 5, 11, '#cfc7b4');
    q.ell(cx, 12, 6, 2, '#d8d0be');
    q.disc(cx, 8, 2, '#b6ecff');
  });
  s.fx = (g, sx, sy, k, t) => {
    // قطرات تتساقط وتلألؤ الماء
    const q = new Q(g);
    for (let i = 0; i < 9; i++) {
      const a = (t * 1.6 + i / 9) % 1;
      const ang = (i / 9) * Math.PI * 2;
      const rr = 3 + a * 15;
      const x = Math.cos(ang) * rr;
      const y = -30 + Math.sin(a * Math.PI) * -6 + a * a * 38 - 4;
      const w = Math.max(1, Math.round(k));
      g.fillStyle = 'rgba(200,240,255,0.9)';
      g.fillRect(Math.round(sx + x * k), Math.round(sy + y * k), w, w * 2);
    }
    for (let i = 0; i < 6; i++) {
      const a = (t * 0.8 + i * 0.37) % 1;
      const x = Math.cos(i * 1.7) * 18;
      const y = -4 + Math.sin(i * 2.3) * 5;
      g.fillStyle = `rgba(255,255,255,${(0.9 - a * 0.9).toFixed(2)})`;
      g.fillRect(Math.round(sx + x * k), Math.round(sy + y * k), Math.max(1, Math.round(k)) * 2, Math.max(1, Math.round(k)));
    }
    void q;
  };
  return s;
}

function photoSprite(): Sprite {
  return sprite(76, 66, 38, 56, -6.2, -3.6, (q) => {
    const rnd = rng(21);
    const cx = 38;
    q.ell(cx, 57, 32, 5, 'rgba(0,0,0,0.2)');
    q.r(cx - 30, 4, 60, 52, GOLD);
    q.r(cx - 28, 6, 56, 48, '#6d1424');
    q.r(cx - 27, 7, 54, 46, '#8e1b2e');
    for (let x = cx - 26; x < cx + 26; x += 4) q.r(x, 7, 1, 46, '#7d1727');
    q.r(cx - 27, 7, 54, 2, '#a3243a');
    q.r(cx - 24, 54, 6, 4, '#4a3a28');
    q.r(cx + 18, 54, 6, 4, '#4a3a28');
    // قلب مضيء
    const heart = ['..XXX...XXX..', '.XXXXX.XXXXX.', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', '.XXXXXXXXXXX.', '..XXXXXXXXX..', '...XXXXXXX...', '....XXXXX....', '.....XXX.....', '......X......'];
    heart.forEach((row, j) => [...row].forEach((ch, i) => ch === 'X' && q.p(cx - 6 + i, 22 + j, j < 3 && i > 3 && i < 9 ? '#ffe0ea' : '#ff7aa8')));
    // ورد على الزوايا
    const cluster = (x: number, y: number) => {
      for (let i = 0; i < 9; i++) q.disc(x + (rnd() - 0.5) * 12, y + (rnd() - 0.5) * 9, 2, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
      q.disc(x + 4, y + 3, 1, '#2f8f4a');
    };
    cluster(cx - 24, 11);
    cluster(cx + 24, 11);
    cluster(cx - 24, 49);
    cluster(cx + 24, 49);
    for (let i = 0; i < 8; i++) q.p(cx - 22 + rnd() * 44, 8 + rnd() * 3, '#ffe9a8');
  });
}

function gateSprite(): Sprite {
  return sprite(92, 84, 46, 76, 0, 14.05, (q) => {
    const rnd = rng(9);
    const cx = 46;
    const base = 76;
    const pillar = (x: number) => {
      q.ell(x, base + 1, 9, 3, 'rgba(0,0,0,0.22)');
      q.r(x - 5, base - 44, 10, 44, '#f5efe0');
      q.r(x + 2, base - 44, 3, 44, '#dcd2bb');
      q.r(x - 6, base - 47, 12, 4, GOLD);
      q.r(x - 6, base - 3, 12, 4, '#cfc4a8');
      q.r(x - 3, base - 56, 6, 9, '#3d2f20');
      q.r(x - 2, base - 55, 4, 7, '#ffcf6b');
      q.p(x - 1, base - 54, '#fff3c0');
      q.r(x - 4, base - 57, 8, 2, GOLD);
      for (let y = base - 42; y < base - 6; y += 5) {
        q.p(x - 3, y, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
        q.p(x + 2, y + 2, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
      }
    };
    pillar(cx - 32);
    pillar(cx + 32);
    const top = base - 46;
    for (let a = 0; a <= 64; a++) {
      const t = Math.PI + (a / 64) * Math.PI;
      const x = cx + Math.cos(t) * 32;
      const y = top + Math.sin(t) * 18;
      q.disc(x, y, 2, '#2f8f4a');
      if (a % 2 === 0) q.disc(x, y - 1, 2, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
      if (a % 4 === 0) q.r(x, y + 3, 2, 2, '#ffe08a');
    }
    q.r(cx - 8, top - 20, 16, 6, GOLD);
    q.r(cx - 7, top - 19, 14, 4, '#6d1424');
    for (let i = 0; i < 5; i++) q.p(cx - 5 + i * 2.4, top - 17, '#ffe9a8');
  });
}

function bushSprite(x: number, z: number, seed: number): Sprite {
  return sprite(28, 24, 14, 19, x, z, (q) => {
    const rnd = rng(seed);
    q.ell(14, 19, 12, 4, 'rgba(0,0,0,0.2)');
    q.disc(14, 12, 9, '#2a7a3f');
    q.disc(8, 14, 6, '#2f8a46');
    q.disc(20, 14, 6, '#256f38');
    q.disc(12, 8, 5, '#43a35a');
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 9;
      q.disc(14 + Math.cos(a) * r, 11 + Math.sin(a) * r * 0.8, 1, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
    }
  });
}

let propsCache: Sprite[] | null = null;
export function getProps(): Sprite[] {
  if (propsCache) return propsCache;
  const list: Sprite[] = [];
  let i = 0;
  for (const side of [-1, 1]) for (const col of [1.75, 2.6]) for (let row = 0; row < 4; row++) list.push(chairSprite(side * col, 2.6 + row * 1.5, i++));
  list.push(archSprite(), cakeSprite(), giftSprite(), fountainSprite(), photoSprite(), gateSprite());
  [[-3.6, -1.9], [3.6, -1.9], [-3.9, 0.9], [3.9, 0.9]].forEach(([x, z], k) => list.push(bushSprite(x, z, 30 + k)));
  [[-9, -4.9], [9, -4.9], [-9, 13.4], [9, 13.4], [-2, 13.5], [2, 13.5]].forEach(([x, z], k) => list.push(bushSprite(x, z, 60 + k)));
  propsCache = list;
  return list;
}

/* ============================================================
   عناصر حيّة: أرضية الرقص وكرة الديسكو
   ============================================================ */
const DANCE_PAL = ['#ff5c9a', '#7a4dff', '#2f8fd8', '#ffb347'];
let danceCv: HTMLCanvasElement | null = null;
let danceFrame = -1;

export function danceFloor(t: number): HTMLCanvasElement {
  const N = 8;
  const ts = Math.round((DANCE.size * U) / N);
  if (!danceCv) {
    danceCv = document.createElement('canvas');
    danceCv.width = danceCv.height = ts * N;
  }
  const f = Math.floor(t * 2.5);
  if (f !== danceFrame) {
    danceFrame = f;
    const q = new Q(danceCv.getContext('2d')!);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const c = DANCE_PAL[(i + j + f) % DANCE_PAL.length];
        q.r(i * ts, j * ts, ts, ts, c);
        q.r(i * ts, j * ts, ts, 1, 'rgba(255,255,255,0.35)');
        q.r(i * ts, j * ts, 1, ts, 'rgba(255,255,255,0.2)');
        q.r(i * ts + ts - 1, j * ts, 1, ts, 'rgba(0,0,0,0.25)');
        q.r(i * ts, j * ts + ts - 1, ts, 1, 'rgba(0,0,0,0.25)');
      }
    }
    for (let k = 0; k < 7; k++) {
      const x = Math.floor(((k * 37 + f * 13) % 100) / 100 * ts * N);
      const y = Math.floor(((k * 53 + f * 29) % 100) / 100 * ts * N);
      q.r(x, y, 2, 2, 'rgba(255,255,255,0.85)');
    }
  }
  return danceCv;
}

/** كرة الديسكو المعلّقة: تُرسم فوق اللاعبين */
export function drawDiscoBall(g: CanvasRenderingContext2D, sx: number, sy: number, k: number, t: number) {
  const q = new Q(g);
  const R = (v: number) => Math.round(v * k);
  g.fillStyle = '#6b6b78';
  g.fillRect(Math.round(sx), Math.round(sy - R(30)), Math.max(1, Math.round(k)), R(14));
  for (let dy = -5; dy <= 5; dy++) {
    const half = Math.floor(Math.sqrt(30 - dy * dy));
    for (let dx = -half; dx <= half; dx++) {
      const shine = Math.sin(dx * 1.3 + dy * 0.9 + t * 3);
      g.fillStyle = shine > 0.55 ? '#ffffff' : shine > 0 ? '#d7ddf5' : shine > -0.5 ? '#a9b2d8' : '#7a83ab';
      g.fillRect(Math.round(sx + R(dx)), Math.round(sy - R(16) + R(dy)), Math.max(1, Math.round(k)), Math.max(1, Math.round(k)));
    }
  }
  void q;
}

/* ============================================================
   الرسم الكامل للمشهد
   ============================================================ */
export interface DrawItem {
  z: number;
  draw: (g: CanvasRenderingContext2D, sx: number, sy: number, k: number) => void;
  x: number;
}
export interface View {
  cx: number;
  cz: number;
  /** بكسلات CSS لكل وحدة عالم */
  S: number;
  w: number;
  h: number;
  dpr: number;
  crisp: boolean;
  night: boolean;
  t: number;
}

/** أضواء الليل: موضع العالم، ارتفاع (بكسل-آرت)، نصف القطر (وحدة)، اللون */
function lights(t: number) {
  const list: { x: number; z: number; up: number; r: number; c: string; a: number }[] = [];
  LANTERNS.forEach(([x, z]) => list.push({ x, z, up: 28, r: 3.2, c: '255,207,107', a: 0.5 }));
  list.push({ x: 0, z: 14.05, up: 54, r: 4.5, c: '255,207,107', a: 0.55 });
  list.push({ x: ALTAR.x, z: ALTAR.z, up: 20, r: 5, c: '255,226,170', a: 0.4 });
  const hue = (t * 60) % 360;
  list.push({ x: DANCE.x, z: DANCE.z, up: 0, r: 4, c: `${Math.round(200 + 55 * Math.sin(hue / 57))},${Math.round(100 + 90 * Math.sin(hue / 31 + 2))},${Math.round(200 + 55 * Math.sin(hue / 43 + 4))}`, a: 0.5 });
  list.push({ x: 6.4, z: 0.8, up: 18, r: 3, c: '120,220,255', a: 0.3 });
  list.push({ x: -6.2, z: -3.6, up: 26, r: 3.4, c: '255,120,170', a: 0.4 });
  list.push({ x: -6.2, z: 5.6, up: 26, r: 2.4, c: '255,200,220', a: 0.3 });
  return list;
}

export function renderVenue(g: CanvasRenderingContext2D, v: View, items: DrawItem[]) {
  const { cx, cz, S, w, h, dpr } = v;
  const snap = (n: number) => Math.round(n * dpr) / dpr;
  const P = (x: number, z: number) => ({ x: snap(w / 2 + (x - cx) * S), y: snap(h / 2 + (z - cz) * S) });
  const k = S / U;

  g.imageSmoothingEnabled = !v.crisp;
  g.fillStyle = '#4b9440';
  g.fillRect(0, 0, w, h);

  if (!groundCv) groundCv = buildGround();
  const o = P(X0, Z0);
  g.drawImage(groundCv, o.x, o.y, snap(WU * S), snap(HU * S));

  /* أرضية الرقص الحيّة */
  const dv = danceFloor(v.t);
  const dp = P(DANCE.x - DANCE.size / 2, DANCE.z - DANCE.size / 2);
  g.drawImage(dv, dp.x, dp.y, dv.width * k, dv.height * k);

  /* مجسّمات + لاعبون بترتيب العمق */
  const all: DrawItem[] = [
    ...getProps().map((s) => ({
      z: s.z,
      x: s.x,
      draw: (gg: CanvasRenderingContext2D, sx: number, sy: number, kk: number) => {
        gg.drawImage(s.cv, snap(sx - s.ax * kk), snap(sy - s.ay * kk), s.cv.width * kk, s.cv.height * kk);
        s.fx?.(gg, sx, sy, kk, v.t);
      },
    })),
    ...items,
  ];
  all.sort((a, b) => a.z - b.z);
  all.forEach((it) => {
    const p = P(it.x, it.z);
    it.draw(g, p.x, p.y, k);
  });

  /* عناصر علوية */
  const db = P(DANCE.x, DANCE.z);
  drawDiscoBall(g, db.x, db.y - 26 * k, k, v.t);

  /* الليل: تعتيم + توهّج الفوانيس */
  if (v.night) {
    g.fillStyle = 'rgba(16,20,58,0.34)';
    g.fillRect(0, 0, w, h);
    g.save();
    g.globalCompositeOperation = 'lighter';
    lights(v.t).forEach((l) => {
      const p = P(l.x, l.z);
      const r = l.r * S;
      const y = p.y - l.up * k;
      if (p.x < -r || p.x > w + r || y < -r || y > h + r) return;
      const grad = g.createRadialGradient(p.x, y, 0, p.x, y, r);
      grad.addColorStop(0, `rgba(${l.c},${l.a})`);
      grad.addColorStop(1, `rgba(${l.c},0)`);
      g.fillStyle = grad;
      g.fillRect(p.x - r, y - r, r * 2, r * 2);
    });
    g.restore();
  }
}

/** ملصقات المحطات (تُرسم بعد كل شيء لتبقى مقروءة) */
export function drawStationLabels(g: CanvasRenderingContext2D, v: View, fontPx: number) {
  const k = v.S / U;
  g.save();
  g.font = `700 ${fontPx}px Tajawal, Tahoma, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  STATIONS.forEach((s) => {
    const x = v.w / 2 + (s.x - v.cx) * v.S;
    const y = v.h / 2 + (s.z - v.cz) * v.S - s.up * k - fontPx * 0.9;
    if (x < -80 || x > v.w + 80 || y < -20 || y > v.h + 20) return;
    const tw = g.measureText(s.label).width + fontPx * 1.1;
    const th = fontPx * 1.7;
    g.fillStyle = 'rgba(12,16,38,0.72)';
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(x - tw / 2, y - th / 2, tw, th, th / 2);
    else g.rect(x - tw / 2, y - th / 2, tw, th);
    g.fill();
    g.strokeStyle = 'rgba(216,181,90,0.75)';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#ffeec2';
    g.fillText(s.label, x, y + 1);
  });
  g.restore();
}

/** بقعة الضوء الملوّنة تحت أقدام اللاعب المحلي */
export function tint(hex: string) {
  return mix(hex, '#ffffff', 0.2);
}
