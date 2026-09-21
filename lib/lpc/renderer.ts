'use client';
import type { AnimState, Direction, LPCAppearance } from './types';
import { LPC_DIRECTION_ORDER } from './types';
import { getLayerImage } from './assetLoader';

export interface DrawCharacterOpts {
  ctx: CanvasRenderingContext2D;
  /** نقطة القدمين على الشاشة (مركز أفقيًا، أسفل الشخصية عموديًا) */
  screenX: number;
  screenY: number;
  /** بكسلات شاشة لكل بكسل من إطار LPC (64×64) */
  pxScale: number;
  direction: Direction;
  anim: AnimState;
  /** ثانية تشغيل مستمرة، تُستخدم لاختيار إطار الحركة */
  t: number;
  appearance: LPCAppearance;
  /** يُستدعى عند اكتمال تحميل طبقة كانت لا تزال قيد التحميل، لطلب إعادة رسم */
  requestRender?: () => void;
}

/** يرسم شخصية LPC مركّبة من طبقاتها (جسد + زيّ + شعر + إكسسوارات) بإعداد بكسل-آرت صحيح */
export function drawLPCCharacter(o: DrawCharacterOpts) {
  const { ctx, screenX, screenY, pxScale, direction, anim, t, appearance, requestRender } = o;
  const row = LPC_DIRECTION_ORDER.indexOf(direction);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const layer of appearance.layers) {
    const img = getLayerImage(layer, anim, requestRender);
    if (!img) continue;
    const def = layer.meta.anims[anim] ?? layer.meta.anims.idle;
    const frame = def.frames > 1 ? Math.floor(t * def.fps) % def.frames : 0;
    const sx = frame * layer.meta.frameW;
    const sy = (def.rowOffset + row) * layer.meta.frameH;
    const dw = layer.meta.frameW * pxScale;
    const dh = layer.meta.frameH * pxScale;
    const dx = Math.round(screenX - dw / 2);
    const dy = Math.round(screenY - dh);
    ctx.drawImage(img, sx, sy, layer.meta.frameW, layer.meta.frameH, dx, dy, dw, dh);
  }
  ctx.restore();
}

/** يحوّل زاوية اتجاه حرة (راديان) إلى أحد اتجاهات LPC الأربعة الأقرب */
export function quantizeDirection(rot: number): Direction {
  const a = Math.atan2(Math.sin(rot), Math.cos(rot));
  const q = Math.round(a / (Math.PI / 2)) & 3;
  return (['down', 'right', 'up', 'left'] as const)[q];
}

/** لوحة اسم فوق الشخصية: خلفية داكنة شبه شفافة، حواف مذهّبة اختيارية (للعريس/العروس) */
export function drawNameplate(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, opts: { gold?: boolean; scale?: number } = {}) {
  const scale = opts.scale ?? 1;
  ctx.save();
  ctx.font = `700 ${Math.round(13 * scale)}px Tajawal, Tahoma, sans-serif`;
  const padX = 10 * scale;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 22 * scale;
  const rx = 10 * scale;
  ctx.fillStyle = 'rgba(10,14,30,.72)';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x - w / 2, y - h, w, h, rx);
  else ctx.rect(x - w / 2, y - h, w, h);
  ctx.fill();
  if (opts.gold) {
    ctx.strokeStyle = '#d8b55a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = opts.gold ? '#ffe9a8' : '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - h / 2 + 1);
  ctx.restore();
}
