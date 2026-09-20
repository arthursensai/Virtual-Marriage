'use client';
import type { LPCLayerSource, LPCSheetMeta } from './types';
import { LPC_DIRECTION_ORDER } from './types';

type Drawable = HTMLImageElement | HTMLCanvasElement;

const cache = new Map<string, Drawable>();
const pending = new Set<string>();
const tinted = new Map<string, Drawable>();

function colorFromUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 55%)`;
}

/**
 * يبني صفيحة وهمية (placeholder) بنفس شبكة LPC (صف لكل اتجاه × إطارات المشي)، لتشغيل
 * خط الأنابيب كاملاً (تحميل، تلوين، رسم، حركة) قبل توفّر ملفات LPC الحقيقية. تُستبدل
 * تلقائيًا بمجرد نجاح تحميل الصورة الحقيقية من نفس المسار في manifest.ts.
 */
function buildMockSheet(meta: LPCSheetMeta, seedColor: string): HTMLCanvasElement {
  const cols = Math.max(meta.anims.walk.frames, meta.anims.idle.frames, 1);
  const rows = LPC_DIRECTION_ORDER.length;
  const cv = document.createElement('canvas');
  cv.width = meta.frameW * cols;
  cv.height = meta.frameH * rows;
  const ctx = cv.getContext('2d')!;
  const dirOffset: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  LPC_DIRECTION_ORDER.forEach((dir, row) => {
    for (let col = 0; col < cols; col++) {
      const x = col * meta.frameW;
      const y = row * meta.frameH;
      const bob = Math.sin((col / cols) * Math.PI * 2) * 2;
      ctx.fillStyle = seedColor;
      ctx.beginPath();
      ctx.ellipse(x + meta.frameW / 2, y + meta.frameH * 0.62 + bob, meta.frameW * 0.22, meta.frameH * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + meta.frameW / 2, y + meta.frameH * 0.3, meta.frameW * 0.16, 0, Math.PI * 2);
      ctx.fill();
      const off = dirOffset[dir];
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.arc(x + meta.frameW / 2 + off[0] * 10, y + meta.frameH * 0.3 + off[1] * 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return cv;
}

/** يدمج لون تلوين على طبقة (شعر/زيّ ملوَّن)، مُخزَّن مؤقتًا حسب (المصدر + اللون) */
function applyTint(src: Drawable, layer: LPCLayerSource): Drawable {
  if (!layer.tint) return src;
  const key = `${layer.url}::${layer.tint}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = layer.tint;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  tinted.set(key, cv);
  return cv;
}

/**
 * يعيد صورة الطبقة الجاهزة للرسم (حقيقية إن نجح تحميلها، وإلا صفيحة وهمية)، أو null
 * أثناء أول محاولة تحميل. آمن للاستدعاء من حلقة الرسم كل إطار: لا يبدأ تحميلًا جديدًا
 * إن كان هناك تحميل معلّق لنفس المسار بالفعل.
 */
export function getLayerImage(layer: LPCLayerSource, onReady?: () => void): Drawable | null {
  const cacheKey = layer.url;
  const existing = cache.get(cacheKey);
  if (existing) return applyTint(existing, layer);
  if (!pending.has(cacheKey)) {
    pending.add(cacheKey);
    const img = new Image();
    img.onload = () => {
      cache.set(cacheKey, img);
      pending.delete(cacheKey);
      onReady?.();
    };
    img.onerror = () => {
      cache.set(cacheKey, buildMockSheet(layer.meta, colorFromUrl(layer.url)));
      pending.delete(cacheKey);
      onReady?.();
    };
    img.src = layer.url;
  }
  return null;
}

/** يبدأ تحميل مجموعة طبقات مسبقًا (يُستدعى عند تغيير مظهر لاعب) */
export function preload(layers: LPCLayerSource[], onReady?: () => void) {
  layers.forEach((l) => getLayerImage(l, onReady));
}
