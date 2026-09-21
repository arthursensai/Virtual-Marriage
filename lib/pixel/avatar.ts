import type { Look } from '../types';
import { luma, mix, shade } from './color';

/**
 * شخصيات بكسل-آرت مرسومة برمجيًا من نفس بيانات Look (بشرة، شعر، زي، لون، إكسسوارات).
 * تدعم الاتجاهات الأربعة (الأيسر = مرآة الأيمن) وحركتَي الوقوف والمشي، وتُخزَّن كل لقطة مؤقتًا.
 */
export type Dir = 'up' | 'down' | 'left' | 'right';

export const AW = 24;
export const AH = 38;
/** نقطة القدمين داخل اللقطة (منتصف أفقيًا، أسفل الحذاء) */
export const ANCHOR_X = 12;
export const ANCHOR_Y = 35;
const OY = 2; // هامش علوي لخط المحيط

const OUTLINE: [number, number, number] = [38, 26, 40];
const GOLD = '#d8b55a';

class Pen {
  flip = false;
  constructor(public g: CanvasRenderingContext2D) {}
  r(x: number, y: number, w: number, h: number, c: string) {
    this.g.fillStyle = c;
    this.g.fillRect(this.flip ? AW - x - w : x, y + OY, w, h);
  }
  p(x: number, y: number, c: string) {
    this.r(x, y, 1, 1, c);
  }
  /** صفوف أفقية متمركزة على cx بعرض w(y) */
  rows(cx: number, y0: number, y1: number, wOf: (y: number) => number, c: string | ((y: number) => string)) {
    for (let y = y0; y < y1; y++) {
      const w = Math.round(wOf(y));
      this.r(cx - Math.floor(w / 2), y, w, 1, typeof c === 'string' ? c : c(y));
    }
  }
}

interface Pal {
  S: string; // بشرة
  SD: string;
  SL: string;
  H: string; // شعر
  HD: string;
  HL: string;
  C: string; // لون الزي
  CD: string;
  CL: string;
  eye: string;
}
function palette(look: Look): Pal {
  return {
    S: look.skin,
    SD: shade(look.skin, 0.8),
    SL: shade(look.skin, 1.12),
    H: look.hair,
    HD: shade(look.hair, 0.68),
    HL: shade(look.hair, 1.25),
    C: look.color,
    CD: shade(look.color, luma(look.color) > 0.85 ? 0.82 : 0.72),
    CL: shade(look.color, 1.18),
    eye: '#2a1d1a',
  };
}

interface Motion {
  by: number; // إزاحة الجزء العلوي
  legL: number; // رفع الساق
  legR: number;
  armL: number; // تأرجح الذراع
  armR: number;
  swing: number; // للجانب: -1، 0، 1
  sway: number; // اهتزاز الحافة السفلية للفستان
}
function motion(moving: boolean, f: number): Motion {
  if (!moving) return { by: f === 1 ? 1 : 0, legL: 0, legR: 0, armL: 0, armR: 0, swing: 0, sway: 0 };
  const k = f % 4;
  return {
    by: k % 2 === 1 ? -1 : 0,
    legL: k === 1 ? 1 : 0,
    legR: k === 3 ? 1 : 0,
    armL: k === 1 ? 1 : k === 3 ? -1 : 0,
    armR: k === 1 ? -1 : k === 3 ? 1 : 0,
    swing: k === 1 ? 1 : k === 3 ? -1 : 0,
    sway: k === 1 ? 1 : k === 3 ? -1 : 0,
  };
}

const isRobe = (look: Look) => !look.female && (look.outfit === 'jellaba' || look.outfit === 'kaftan');
const isSkirt = (look: Look) => look.female;

/* ============================ أمامي / خلفي ============================ */
function drawFB(p: Pen, look: Look, back: boolean, f: number, moving: boolean) {
  const K = palette(look);
  const m = motion(moving, f);
  const by = m.by;
  const female = look.female;
  const o = look.outfit;
  const hijab = female && look.hairStyle === 'hijab';
  const robe = isRobe(look);
  const skirt = isSkirt(look);
  const TR = look.outfit === 'suit' && !female ? (luma(look.color) > 0.85 ? '#c9c9d2' : shade(look.color, 0.62)) : K.CD;

  /* --- خلف الجسد: شعر طويل / قلنسوة الجلابة --- */
  if (!hijab && female && (look.hairStyle === 'long') && !look.acc.veil) {
    p.r(5, 8 + by, 14, 15, K.HD);
  }
  if (back && robe && o === 'jellaba') p.r(7, 13 + by, 10, 6, K.CD);

  /* --- الساقان والحذاء --- */
  if (!robe && !skirt) {
    const legC = look.outfit === 'suit' ? TR : K.S;
    p.r(8, 26 - m.legL, 4, 6, legC);
    p.r(12, 26 - m.legR, 4, 6, legC);
    const sh = look.outfit === 'suit' ? '#1c1a20' : '#3a2a22';
    p.r(7, 31 - m.legL, 5, 2, sh);
    p.r(12, 31 - m.legR, 5, 2, sh);
  }

  /* --- الفستان / الجلابة (يغطي الساقين) --- */
  if (skirt || robe) {
    const hem = 32;
    const sw = m.sway;
    if (skirt && (o === 'gown' || (o !== 'mermaid' && o !== 'kaftan'))) {
      p.rows(12, 22, hem + 1, (y) => 10 + (y - 22) * 0.95, (y) => (y % 5 === 0 ? K.CL : (y > 27 ? K.C : K.C)));
      // ظلال الطيّات
      for (let y = 24; y <= hem; y += 2) {
        const w = Math.round(10 + (y - 22) * 0.95);
        p.p(12 - Math.floor(w / 2) + 2, y, K.CD);
        p.p(12 + Math.floor(w / 2) - 3, y, K.CD);
        p.p(12, y + 1, K.CL);
      }
      p.r(12 - 9 + sw, hem, 18, 1, GOLD);
      p.r(12 - 9 - sw, hem + 1, 18, 1, K.CD);
      p.r(6, 22, 12, 1, GOLD); // حزام
    } else if (o === 'mermaid') {
      p.rows(12, 22, hem + 1, (y) => (y < 28 ? 10 : 10 + (y - 27) * 1.2), K.C);
      for (let y = 23; y <= hem; y += 3) p.p(10, y, K.CD);
      for (let y = 24; y <= hem; y += 3) p.p(14, y, K.CL);
      p.r(12 - 6 + sw, hem, 12, 1, GOLD);
      p.r(7, 22, 10, 1, K.CD);
    } else {
      // قفطان طويل مستقيم (أنثوي أو رجالي) / جلابة
      p.rows(12, 21, hem + 1, (y) => 11 + (y - 21) * 0.25, K.C);
      p.r(12 - 5 + sw, hem, 10, 1, K.CD);
      p.r(11, 17, 2, hem - 17 + 1, GOLD); // شريط أمامي مطرّز
      for (let y = 20; y < hem; y += 3) {
        p.p(9, y, K.CL);
        p.p(14, y, K.CL);
      }
      p.r(7, 24, 10, 1, GOLD);
    }
    // أحذية ظاهرة
    if (robe) {
      p.r(8 - m.legL, 33, 4, 1, '#d9a441');
      p.r(12 - m.legR, 33, 4, 1, '#d9a441');
    } else {
      p.p(9, 33, '#f4eadc');
      p.p(14, 33, '#f4eadc');
    }
  }

  /* --- الجذع --- */
  if (!skirt && !robe) {
    if (o === 'suit') {
      p.r(7, 16 + by, 10, 10, K.C);
      p.r(7, 16 + by, 10, 1, K.CL);
      if (!back) {
        p.r(10, 16 + by, 4, 6, '#f7f7f7'); // القميص
        p.r(11, 16 + by, 2, 5, '#e2e2e8');
        p.p(9, 17 + by, K.CD);
        p.p(14, 17 + by, K.CD); // طيّات الياقة
        p.p(9, 18 + by, K.CD);
        p.p(14, 18 + by, K.CD);
        p.p(11, 22 + by, K.CL);
        p.p(12, 24 + by, K.CL);
      } else {
        p.r(11, 17 + by, 2, 9, K.CD);
      }
      p.r(7, 25, 10, 1, K.CD);
    }
  } else if (skirt) {
    // القسم العلوي من الفستان
    p.r(7, 16 + by, 10, 6, K.C);
    if (!back) {
      p.r(10, 16 + by, 4, 1, K.S); // فتحة الرقبة
      p.r(9, 17 + by, 6, 1, K.CL);
      p.p(11, 19 + by, K.CL);
      p.p(12, 19 + by, K.CL);
    } else {
      p.r(11, 17 + by, 2, 5, K.CD);
      p.p(11, 21 + by, GOLD);
    }
  } else if (robe) {
    p.r(7, 16 + by, 10, 6, K.C);
    if (!back) p.r(10, 16 + by, 4, 1, K.S);
    p.r(7, 16 + by, 10, 1, K.CL);
  }

  /* --- الذراعان --- */
  const sleeve = skirt && o !== 'kaftan' ? null : K.C;
  const armLy = 17 + by + m.armL;
  const armRy = 17 + by + m.armR;
  if (skirt && o !== 'kaftan') {
    p.r(5, armLy, 2, 8, K.S);
    p.r(17, armRy, 2, 8, K.S);
    p.r(5, armLy, 2, 2, K.C); // كُمّ قصير
    p.r(17, armRy, 2, 2, K.C);
  } else {
    const w = robe || o === 'kaftan' ? 3 : 2;
    p.r(5 - (w - 2), armLy, w, 7, sleeve ?? K.C);
    p.r(17, armRy, w, 7, sleeve ?? K.C);
    p.r(5, armLy + 6, 2, 2, K.S);
    p.r(17, armRy + 6, 2, 2, K.S);
    if (o === 'suit' && !female) {
      p.r(5, armLy + 5, 2, 1, '#f5f5f5');
      p.r(17, armRy + 5, 2, 1, '#f5f5f5');
    }
  }

  /* --- الرقبة والرأس --- */
  p.r(10, 15 + by, 4, 2, K.SD);
  drawHeadFB(p, look, K, back, by, hijab);

  /* --- إكسسوارات --- */
  accessoriesFB(p, look, K, back, by, m);
}

function drawHeadFB(p: Pen, look: Look, K: Pal, back: boolean, by: number, hijab: boolean) {
  const hy = 3 + by;
  const female = look.female;
  // الوجه/الرأس مع زوايا مقصوصة
  p.r(7, hy, 10, 12, K.S);
  p.r(6, hy + 2, 12, 8, K.S);
  const st = look.hairStyle;
  if (!back) {
    // عينان وحاجبان وخدّان وفم
    p.r(9, hy + 6, 2, 2, K.eye);
    p.r(13, hy + 6, 2, 2, K.eye);
    p.p(9, hy + 6, '#ffffff');
    p.p(13, hy + 6, '#ffffff');
    if (female) {
      p.p(8, hy + 5, K.eye);
      p.p(15, hy + 5, K.eye);
    } else {
      p.r(9, hy + 4, 2, 1, K.HD);
      p.r(13, hy + 4, 2, 1, K.HD);
    }
    p.p(8, hy + 8, '#f08a7a');
    p.p(15, hy + 8, '#f08a7a');
    p.r(11, hy + 9, 2, 1, female ? '#d4566e' : shade(K.S, 0.62));
    p.p(11, hy + 7, K.SD);
  }

  if (hijab) {
    // حجاب يغطي الشعر والرقبة
    const sc = look.hair;
    const scD = shade(sc, 0.75);
    const scL = shade(sc, 1.2);
    if (back) {
      p.r(6, hy - 1, 12, 15, sc);
      p.r(5, hy + 2, 14, 13, sc);
      p.r(8, hy + 2, 2, 10, scL);
    } else {
      p.r(6, hy - 1, 12, 4, sc);
      p.r(5, hy + 2, 14, 13, sc);
      p.r(7, hy + 3, 10, 1, scD);
      // فتحة الوجه
      p.r(8, hy + 3, 8, 9, K.S);
      p.r(7, hy + 5, 10, 5, K.S);
      p.r(9, hy + 6, 2, 2, K.eye);
      p.r(13, hy + 6, 2, 2, K.eye);
      p.p(9, hy + 6, '#ffffff');
      p.p(13, hy + 6, '#ffffff');
      p.p(8, hy + 5, K.eye);
      p.p(15, hy + 5, K.eye);
      p.p(8, hy + 8, '#f08a7a');
      p.p(15, hy + 8, '#f08a7a');
      p.r(11, hy + 9, 2, 1, '#d4566e');
      p.r(6, hy + 12, 12, 3, sc);
      p.r(7, hy + 13, 4, 1, scD);
    }
    return;
  }

  if (st === 'bald') {
    p.r(9, hy, 3, 1, K.SL);
    return;
  }
  const covered = !!look.acc.tarbouche;
  if (back) {
    p.r(6, hy - 1, 12, 12, K.H);
    p.r(5, hy + 2, 14, 8, K.H);
    p.r(8, hy + 1, 3, 2, K.HL);
    p.r(6, hy + 9, 12, 2, K.HD);
    if (st === 'bun') {
      p.r(9, hy - 3, 6, 4, K.H);
      p.r(10, hy - 3, 2, 1, K.HL);
    }
    if (st === 'long') p.r(6, hy + 10, 12, 10, K.H);
    if (st === 'curly') for (let x = 6; x < 18; x += 2) p.p(x, hy - 2, K.H);
  } else {
    if (covered) {
      p.r(6, hy + 3, 2, 4, K.H);
      p.r(16, hy + 3, 2, 4, K.H);
      return;
    }
    p.r(6, hy - 1, 12, 5, K.H);
    p.r(5, hy + 1, 14, 3, K.H);
    p.r(8, hy - 1, 3, 1, K.HL);
    p.r(6, hy + 3, 2, 5, K.H);
    p.r(16, hy + 3, 2, 5, K.H);
    // غرّة
    if (st === 'short') {
      p.r(8, hy + 3, 4, 1, K.H);
      p.r(13, hy + 3, 3, 1, K.H);
      p.p(11, hy + 3, K.HD);
    } else if (st === 'curly') {
      for (let x = 6; x < 18; x += 2) p.p(x, hy - 2, K.H);
      p.r(7, hy + 3, 10, 1, K.H);
      for (let x = 7; x < 17; x += 2) p.p(x, hy + 4, K.H);
      p.r(5, hy + 3, 1, 5, K.H);
      p.r(18, hy + 3, 1, 5, K.H);
    } else {
      // long / bun
      p.r(8, hy + 3, 3, 1, K.H);
      p.r(12, hy + 3, 4, 1, K.H);
      if (st === 'long') {
        p.r(5, hy + 6, 2, 12, K.H);
        p.r(17, hy + 6, 2, 12, K.H);
        p.r(5, hy + 6, 1, 12, K.HD);
      }
      if (st === 'bun') {
        p.r(9, hy - 3, 6, 4, K.H);
        p.r(10, hy - 3, 2, 1, K.HL);
      }
    }
  }
}

function accessoriesFB(p: Pen, look: Look, K: Pal, back: boolean, by: number, m: Motion) {
  const a = look.acc;
  const hy = 3 + by;
  if (a.bowtie && !look.female) {
    if (!back) {
      p.r(8, 16 + by, 3, 3, '#a3242f');
      p.r(13, 16 + by, 3, 3, '#a3242f');
      p.r(11, 16 + by, 2, 2, '#7a1a22');
      p.p(9, 16 + by, '#d4525c');
    }
  }
  if (a.flower && !look.female && !back) {
    p.r(14, 19 + by, 2, 2, '#ff6b8b');
    p.p(15, 19 + by, '#ffd166');
    p.p(14, 21 + by, '#3b9c4f');
  }
  if (a.necklace && look.female && !back) {
    p.r(9, 16 + by, 6, 1, '#fff2cc');
    p.p(11, 17 + by, '#7fd8ff');
    p.p(12, 17 + by, '#7fd8ff');
  }
  if (a.beard && !look.female && !back) {
    p.r(8, hy + 8, 8, 3, K.H);
    p.r(9, hy + 11, 6, 1, K.H);
    p.r(11, hy + 9, 2, 1, shade(K.S, 0.55));
  }
  if (a.shades && !back) {
    p.r(8, hy + 5, 8, 3, '#111318');
    p.p(11, hy + 5, K.S);
    p.p(12, hy + 5, K.S);
    p.p(9, hy + 5, '#4b5563');
    p.p(13, hy + 5, '#4b5563');
  } else if (a.shades && back) {
    p.r(6, hy + 5, 12, 1, '#111318');
  }
  if (a.tarbouche) {
    p.r(7, hy - 3, 10, 6, '#b3202a');
    p.r(8, hy - 4, 8, 1, '#b3202a');
    p.r(7, hy - 3, 10, 1, '#d63a44');
    p.r(7, hy + 2, 10, 1, '#7d1219');
    p.r(11, hy - 5, 2, 1, '#111111');
    p.r(16, hy - 4, 1, 6, '#1a1a1a'); // الشرّابة
    p.p(16, hy + 2, '#d8b55a');
  }
  if (a.tiara) {
    p.r(8, hy - 2, 8, 1, GOLD);
    p.p(9, hy - 3, GOLD);
    p.p(12, hy - 4, '#fff2a8');
    p.p(11, hy - 3, GOLD);
    p.p(12, hy - 3, GOLD);
    p.p(14, hy - 3, GOLD);
    p.p(12, hy - 2, '#7fd8ff');
  }
  if (a.veil) {
    const t = 'rgba(250,247,240,0.78)';
    const e = 'rgba(255,255,255,0.95)';
    if (back) {
      p.r(5, hy, 14, 27, t);
      p.r(5, hy, 14, 1, e);
      p.r(4, hy + 6, 1, 21, t);
      p.r(19, hy + 6, 1, 21, t);
    } else {
      p.r(4, hy + 1, 3, 26, t);
      p.r(17, hy + 1, 3, 26, t);
      p.r(6, hy - 1, 12, 2, t);
      p.r(4, hy + 26, 3, 1, e);
      p.r(17, hy + 26, 3, 1, e);
    }
  }
  if (a.bouquet && look.female && !back) {
    const bx = 9;
    const by2 = 22 + by + (m.armL ? 0 : 0);
    p.r(bx + 1, by2 + 3, 4, 3, '#3b9c4f');
    p.r(bx, by2, 3, 3, '#ff8fb1');
    p.r(bx + 3, by2, 3, 3, '#ffffff');
    p.r(bx + 1, by2 - 1, 3, 2, '#ffc2d4');
    p.p(bx + 1, by2 + 1, '#ffd166');
    p.p(bx + 4, by2 + 1, '#ffd166');
    p.r(bx + 2, by2 + 6, 2, 2, '#f2d9e6'); // شريط
  }
}

/* ============================ جانبي (يواجه اليمين) ============================ */
function drawSide(p: Pen, look: Look, f: number, moving: boolean) {
  const K = palette(look);
  const m = motion(moving, f);
  const by = m.by;
  const female = look.female;
  const o = look.outfit;
  const hijab = female && look.hairStyle === 'hijab';
  const robe = isRobe(look);
  const skirt = isSkirt(look);
  const st = look.hairStyle;
  const TR = look.outfit === 'suit' && !female ? (luma(look.color) > 0.85 ? '#c9c9d2' : shade(look.color, 0.62)) : K.CD;

  // الحجاب/الطرحة خلف الجسد
  if (look.acc.veil) p.r(4, 6 + by, 6, 26, 'rgba(255,255,255,0.55)');
  if (!hijab && female && st === 'long') p.r(5, 8 + by, 6, 15, K.HD);

  /* الساقان */
  if (!robe && !skirt) {
    const legC = o === 'suit' ? TR : K.S;
    const sh = o === 'suit' ? '#1c1a20' : '#3a2a22';
    const fw = m.swing;
    p.r(11 - fw * 2, 26, 4, 6, shade(legC, 0.85));
    p.r(11 - fw * 2 - 1, 31, 6, 2, shade(sh, 1));
    p.r(11 + fw * 2, 26, 4, 6, legC);
    p.r(11 + fw * 2, 31, 6, 2, sh);
  } else {
    const hem = 32;
    const sw = m.sway;
    if (skirt && o === 'mermaid') p.rows(12, 22, hem + 1, (y) => (y < 28 ? 8 : 8 + (y - 27) * 1.0), K.C);
    else if (skirt && o !== 'kaftan') p.rows(12, 22, hem + 1, (y) => 8 + (y - 22) * 0.9, (y) => (y % 5 === 0 ? K.CL : K.C));
    else p.rows(12, 21, hem + 1, (y) => 9 + (y - 21) * 0.2, K.C);
    p.r(12 - 5 + sw, hem, 10, 1, GOLD);
    if (!skirt || o === 'kaftan') p.r(12, 17, 2, hem - 17, GOLD);
    p.r(12 + 3, 24, 4, 1, GOLD);
    if (robe) p.r(12 + m.swing, 33, 5, 1, '#d9a441');
    else p.r(13 + m.swing, 33, 3, 1, '#f4eadc');
    if (o === 'jellaba' && robe) p.r(6, 13 + by, 5, 6, K.CD);
  }

  /* الجذع */
  if (!skirt && !robe) {
    p.r(9, 16 + by, 7, 10, K.C);
    p.r(9, 16 + by, 7, 1, K.CL);
    p.r(15, 17 + by, 1, 4, '#f5f5f5');
    p.r(9, 25, 7, 1, K.CD);
  } else {
    p.r(9, 16 + by, 7, 6, K.C);
    p.r(9, 16 + by, 7, 1, K.CL);
    if (skirt && o !== 'kaftan') p.r(8, 22, 9, 1, GOLD);
  }

  /* الذراع */
  const ax = 10 + m.swing * 2;
  const armC = skirt && o !== 'kaftan' ? K.S : K.C;
  p.r(ax, 17 + by, 3, 8, armC);
  p.r(ax, 24 + by, 3, 2, K.S);
  if (skirt && o !== 'kaftan') p.r(ax, 17 + by, 3, 2, K.C);
  if (look.acc.bouquet && look.female) {
    const bx = ax + 3;
    p.r(bx, 22 + by, 3, 3, '#ff8fb1');
    p.r(bx + 1, 21 + by, 2, 2, '#ffffff');
    p.r(bx, 25 + by, 2, 2, '#3b9c4f');
  }

  /* الرقبة والرأس */
  p.r(10, 15 + by, 4, 2, K.SD);
  const hy = 3 + by;
  p.r(7, hy, 9, 12, K.S);
  p.r(6, hy + 2, 11, 8, K.S);
  p.r(17, hy + 6, 1, 2, K.S); // الأنف
  p.p(17, hy + 7, K.SD);
  p.r(14, hy + 6, 2, 2, K.eye);
  p.p(14, hy + 6, '#ffffff');
  if (female) p.p(15, hy + 5, K.eye);
  else p.r(13, hy + 4, 3, 1, K.HD);
  p.p(14, hy + 8, '#f08a7a');
  p.r(15, hy + 9, 2, 1, female ? '#d4566e' : shade(K.S, 0.62));

  if (hijab) {
    const sc = look.hair;
    p.r(5, hy - 1, 12, 5, sc);
    p.r(4, hy + 2, 9, 13, sc);
    p.r(13, hy + 1, 3, 3, sc);
    p.r(6, hy + 12, 10, 3, sc);
    p.r(5, hy + 3, 1, 10, shade(sc, 0.75));
  } else if (st !== 'bald' && !look.acc.tarbouche) {
    p.r(6, hy - 1, 10, 4, K.H);
    p.r(5, hy + 1, 8, 9, K.H);
    p.r(9, hy - 1, 3, 1, K.HL);
    p.r(14, hy + 2, 2, 1, K.H);
    if (st === 'long') p.r(4, hy + 6, 5, 13, K.H);
    if (st === 'bun') p.r(5, hy - 3, 5, 4, K.H);
    if (st === 'curly') for (let x = 6; x < 15; x += 2) p.p(x, hy - 2, K.H);
  } else if (look.acc.tarbouche) {
    p.r(5, hy + 2, 5, 7, K.H);
  }

  /* إكسسوارات */
  const a = look.acc;
  if (a.beard && !female) p.r(11, hy + 8, 6, 4, K.H);
  if (a.shades) {
    p.r(12, hy + 5, 5, 3, '#111318');
    p.r(6, hy + 5, 7, 1, '#111318');
  }
  if (a.bowtie && !female) {
    p.r(13, 16 + by, 3, 3, '#a3242f');
    p.p(14, 16 + by, '#7a1a22');
  }
  if (a.necklace && female) p.r(13, 16 + by, 3, 1, '#fff2cc');
  if (a.flower && !female) {
    p.r(14, 19 + by, 2, 2, '#ff6b8b');
    p.p(15, 19 + by, '#ffd166');
  }
  if (a.tarbouche) {
    p.r(6, hy - 3, 9, 6, '#b3202a');
    p.r(7, hy - 4, 7, 1, '#b3202a');
    p.r(6, hy - 3, 9, 1, '#d63a44');
    p.r(6, hy + 2, 9, 1, '#7d1219');
    p.r(6, hy - 4, 1, 6, '#1a1a1a');
  }
  if (a.tiara) {
    p.r(7, hy - 2, 7, 1, GOLD);
    p.p(8, hy - 3, GOLD);
    p.p(10, hy - 4, '#fff2a8');
    p.p(12, hy - 3, GOLD);
  }
  if (a.veil) p.r(5, hy - 1, 10, 2, 'rgba(255,255,255,0.7)');
}

/* ============================ التوليد والتخزين المؤقت ============================ */
function outline(g: CanvasRenderingContext2D, w: number, h: number) {
  const src = g.getImageData(0, 0, w, h);
  const s = src.data;
  const d = new Uint8ClampedArray(s);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && s[(y * w + x) * 4 + 3] > 200;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (s[i + 3] > 200) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        d[i] = OUTLINE[0];
        d[i + 1] = OUTLINE[1];
        d[i + 2] = OUTLINE[2];
        d[i + 3] = s[i + 3] > 30 ? 255 : 235;
      }
    }
  }
  g.putImageData(new ImageData(d, w, h), 0, 0);
}

function lookKey(look: Look) {
  const acc = Object.keys(look.acc)
    .filter((k) => look.acc[k])
    .sort()
    .join('+');
  return `${look.female ? 'f' : 'm'}|${look.skin}|${look.hair}|${look.hairStyle}|${look.outfit}|${look.color}|${acc}`;
}

const cache = new Map<string, HTMLCanvasElement>();

/** لقطة واحدة جاهزة للرسم (24×38 بكسل، القدمان عند ANCHOR_X/ANCHOR_Y) */
export function getAvatarFrame(look: Look, dir: Dir, moving: boolean, idx: number): HTMLCanvasElement {
  const f = moving ? idx % 4 : idx % 2;
  const key = `${lookKey(look)}|${dir}|${moving ? 'w' : 'i'}${f}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = AW;
  cv.height = AH;
  const g = cv.getContext('2d')!;
  const pen = new Pen(g);
  if (dir === 'down') drawFB(pen, look, false, f, moving);
  else if (dir === 'up') drawFB(pen, look, true, f, moving);
  else {
    pen.flip = dir === 'left';
    drawSide(pen, look, f, moving);
  }
  outline(g, AW, AH);
  if (cache.size > 400) cache.clear();
  cache.set(key, cv);
  return cv;
}

/** يحوّل زاوية حرة إلى أقرب اتجاه رئيسي */
export function directionOf(rot: number): Dir {
  const a = Math.atan2(Math.sin(rot), Math.cos(rot));
  const q = Math.round(a / (Math.PI / 2)) & 3;
  return (['down', 'right', 'up', 'left'] as const)[q];
}

export { mix };
