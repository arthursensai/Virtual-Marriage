'use client';
import { CATALOG, ITEM_BY_ID } from './catalog';
import { parseHex } from '../pixel/color';
import type { LpcLook } from './types';

/**
 * محرّك تركيب شخصيات LPC:
 *  - يحمّل صفائح PNG كسولًا (كل طبقة، لكل حركة)، ويعيد null حتى تجهز كل الطبقات.
 *  - يعيد تلوين الطبقات (بشرة/شعر/ملابس/معادن) مع الحفاظ على التظليل.
 *  - يركّب لقطة 64×64 لكل (مظهر، اتجاه، حركة، إطار) ويخزّنها مؤقتًا.
 *  - يرسم العناصر غير الموجودة في LPC (طرحة، باقة، طربوش) برمجيًا فوق اللقطة.
 */
export type Dir = 'up' | 'down' | 'left' | 'right';
const ROW: Record<Dir, number> = { up: 0, left: 1, down: 2, right: 3 };
const F = 64;
/** نقطة القدمين في اللقطة وارتفاع الرأس (بكسل) */
export const LPC_ANCHOR = { x: 32, y: 62, top: 50 };
/** نسبة حجم شخصية LPC إلى وحدة الرسم الأساسية (تُطابق حجم الشخصيات البكسلية) */
export const LPC_SCALE = 0.65;

const DEFAULT_COL: Record<string, string> = {
  hair: '#3b2417', top: '#ffffff', top2: '#ffffff', bottom: '#1b2a49', shoes: '#3b2417', hat: '#ffffff', neck: '#9b1c1c', metal: '#d8b55a',
};

/* ---------- تحميل الصور ---------- */
interface Ent {
  state: 'loading' | 'ok' | 'err';
  img: HTMLImageElement | null;
}
const imgs = new Map<string, Ent>();
const listeners = new Set<() => void>();
let version = 0;
let pending = false;

function bump() {
  version++;
  if (pending || typeof requestAnimationFrame === 'undefined') return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    listeners.forEach((f) => f());
  });
}
/** للاشتراك في حدث "جهزت صور جديدة" (يستعمله المعاينة والصور المصغّرة) */
export function onLpcChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function lpcVersion() {
  return version;
}

function load(rel: string): Ent {
  let e = imgs.get(rel);
  if (e) return e;
  e = { state: 'loading', img: null };
  imgs.set(rel, e);
  if (typeof window === 'undefined') return e;
  const ent = e;
  const im = new Image();
  im.onload = () => {
    ent.state = 'ok';
    ent.img = im;
    bump();
  };
  im.onerror = () => {
    ent.state = 'err';
    bump();
  };
  im.src = `${CATALOG.base}/${rel}`;
  return e;
}

/** هل ملفات LPC موجودة على الخادم؟ نجرّب جسم الرجل (أول طبقة أساسية). */
export function lpcAvailability(): 'unknown' | 'yes' | 'no' {
  const body = CATALOG.baseLayers.find((l) => l.recolor === 'skin')?.files.male?.walk;
  if (!body) return 'no';
  const e = load(body);
  return e.state === 'loading' ? 'unknown' : e.state === 'ok' ? 'yes' : 'no';
}

/* ---------- تحليل المظهر إلى طبقات ---------- */
interface RLayer {
  z: number;
  walk: string;
  idle: string | null;
  hex: string | null;
}

function keyOf(look: LpcLook) {
  const sel = Object.keys(look.sel).sort().map((k) => `${k}=${look.sel[k]}`).join(',');
  const col = Object.keys(look.col).sort().map((k) => `${k}=${look.col[k]}`).join(',');
  const proc = Object.keys(look.proc).filter((k) => look.proc[k]).sort().join(',');
  return `${look.body}|${look.skin}|${look.eyes}|${sel}|${col}|${proc}`;
}

function hexFor(look: LpcLook, slot: string | null): string | null {
  if (!slot) return null;
  if (slot === 'skin') return look.skin;
  return look.col[slot] ?? DEFAULT_COL[slot] ?? null;
}

const layerCache = new Map<string, RLayer[]>();
export function resolveLayers(look: LpcLook): RLayer[] {
  const k = keyOf(look);
  const hit = layerCache.get(k);
  if (hit) return hit;
  const b = look.body;
  const hidden = new Set<string>();
  Object.values(look.sel).forEach((id) => ITEM_BY_ID[id]?.hides.forEach((h) => hidden.add(h)));
  CATALOG.proc.forEach((p) => {
    if (look.proc[p.id]) p.hides?.forEach((h) => hidden.add(h));
  });
  const out: RLayer[] = [];
  const push = (z: number, f: { walk: string | null; idle: string | null } | undefined, slot: string | null) => {
    if (f?.walk) out.push({ z, walk: f.walk, idle: f.idle, hex: hexFor(look, slot) });
  };
  CATALOG.baseLayers.forEach((l) => push(l.z, l.files[b], l.recolor));
  const ef = CATALOG.eyes.files[b];
  push(CATALOG.eyes.z, ef?.[look.eyes] ?? ef?.brown, null);
  for (const [cat, id] of Object.entries(look.sel)) {
    if (hidden.has(cat)) continue;
    const it = ITEM_BY_ID[id];
    if (!it || !it.bodies.includes(b)) continue;
    it.layers.forEach((l) => push(l.z, l.files[b], l.recolor));
  }
  out.sort((a, c) => a.z - c.z);
  if (layerCache.size > 300) layerCache.clear();
  layerCache.set(k, out);
  return out;
}

/* ---------- إعادة التلوين مع حفظ التظليل ---------- */
const recolorCache = new Map<string, HTMLCanvasElement>();
function recolored(path: string, img: HTMLImageElement, hex: string): HTMLCanvasElement {
  const key = `${path}|${hex}`;
  const hit = recolorCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, cv.width, cv.height);
  const d = id.data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 128) {
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      n++;
    }
  }
  const mean = n ? sum / n : 128;
  const [tr, tg, tb] = parseHex(hex);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / mean;
    d[i] = Math.min(255, tr * l);
    d[i + 1] = Math.min(255, tg * l);
    d[i + 2] = Math.min(255, tb * l);
  }
  g.putImageData(id, 0, 0);
  if (recolorCache.size > 400) recolorCache.clear();
  recolorCache.set(key, cv);
  return cv;
}

/* ---------- عناصر مرسومة برمجيًا ---------- */
function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}
function drawProc(g: CanvasRenderingContext2D, look: LpcLook, dir: Dir) {
  if (look.proc.veil) {
    const t = 'rgba(250,247,240,0.72)';
    const e = 'rgba(255,255,255,0.95)';
    if (dir === 'up') {
      rect(g, 19, 12, 26, 48, t);
      rect(g, 19, 12, 26, 1, e);
      rect(g, 19, 59, 26, 1, e);
    } else if (dir === 'down') {
      rect(g, 18, 14, 4, 45, t);
      rect(g, 42, 14, 4, 45, t);
      rect(g, 22, 11, 20, 2, t);
      rect(g, 18, 58, 4, 1, e);
      rect(g, 42, 58, 4, 1, e);
    } else {
      const x = dir === 'right' ? 15 : 41;
      rect(g, x, 13, 8, 46, t);
      rect(g, x, 58, 8, 1, e);
    }
  }
  if (look.proc.bouquet && dir !== 'up') {
    const bx = dir === 'down' ? 27 : dir === 'right' ? 36 : 20;
    const by = 42;
    rect(g, bx + 3, by + 6, 4, 6, '#3b9c4f');
    rect(g, bx, by, 5, 5, '#ff8fb1');
    rect(g, bx + 5, by, 5, 5, '#ffffff');
    rect(g, bx + 2, by - 3, 5, 4, '#ffc2d4');
    rect(g, bx + 4, by + 1, 2, 2, '#ffd166');
    rect(g, bx + 3, by + 11, 4, 3, '#f2d9e6');
  }
  if (look.proc.fez) {
    rect(g, 24, 8, 16, 7, '#b3202a');
    rect(g, 25, 6, 14, 2, '#b3202a');
    rect(g, 24, 8, 16, 1, '#d63a44');
    rect(g, 24, 14, 16, 1, '#7d1219');
    rect(g, 30, 4, 4, 2, '#111111');
    const tx = dir === 'left' ? 24 : dir === 'up' ? 31 : 39;
    rect(g, tx, 6, 1, 10, '#1a1a1a');
    rect(g, tx - 1, 15, 3, 2, '#d8b55a');
  }
}

/* ---------- تركيب اللقطات ---------- */
const frameCache = new Map<string, HTMLCanvasElement>();

/** يعيد null حتى تكتمل الصور (يستعمل المستدعي الشخصية البكسلية مؤقتًا) */
export function getLpcFrame(look: LpcLook, dir: Dir, moving: boolean, idx: number): HTMLCanvasElement | null {
  if (lpcAvailability() !== 'yes') return null;
  const layers = resolveLayers(look);
  let ready = true;
  for (const l of layers) {
    if (load(l.walk).state === 'loading') ready = false;
    if (l.idle && load(l.idle).state === 'loading') ready = false;
  }
  if (!ready) return null;

  const col = moving ? 1 + (idx % 8) : idx % 2;
  const key = `${keyOf(look)}|${dir}|${moving ? 'w' : 'i'}${col}`;
  const hit = frameCache.get(key);
  if (hit) return hit;

  const cv = document.createElement('canvas');
  cv.width = cv.height = F;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  for (const l of layers) {
    let path = l.walk;
    let c = moving ? col : 0;
    if (!moving && l.idle && imgs.get(l.idle)?.state === 'ok') {
      path = l.idle;
      c = col;
    }
    const e = imgs.get(path);
    if (!e || e.state !== 'ok' || !e.img) continue;
    const src: CanvasImageSource = l.hex ? recolored(path, e.img, l.hex) : e.img;
    g.drawImage(src, c * F, ROW[dir] * F, F, F, 0, 0, F, F);
  }
  drawProc(g, look, dir);
  if (frameCache.size > 900) frameCache.clear();
  frameCache.set(key, cv);
  return cv;
}
