import type { Look } from '../types';
import { ANCHOR_X, ANCHOR_Y, getAvatarFrame, type Dir } from '../pixel/avatar';
import { LPC_ANCHOR, LPC_SCALE, getLpcFrame } from './lpc';

export interface AvatarSprite {
  cv: HTMLCanvasElement;
  /** نقطة القدمين داخل اللقطة */
  ax: number;
  ay: number;
  /** ارتفاع الرأس فوق القدمين (بكسل الرسم) لوضع لوحة الاسم */
  top: number;
  /** نسبة الحجم إلى وحدة الرسم الأساسية */
  scale: number;
  lpc: boolean;
}

/** يختار أفضل رسم متاح: LPC إن جهزت أصوله، وإلا الشخصية البكسلية المرسومة برمجيًا */
export function getAvatarSprite(look: Look, dir: Dir, moving: boolean, t: number): AvatarSprite {
  if (look.lpc) {
    const f = getLpcFrame(look.lpc, dir, moving, moving ? Math.floor(t * 10) : Math.floor(t * 1.6));
    if (f) return { cv: f, ax: LPC_ANCHOR.x, ay: LPC_ANCHOR.y, top: LPC_ANCHOR.top, scale: LPC_SCALE, lpc: true };
  }
  const cv = getAvatarFrame(look, dir, moving, moving ? Math.floor(t * 8) : Math.floor(t * 1.6));
  return { cv, ax: ANCHOR_X, ay: ANCHOR_Y, top: ANCHOR_Y - 3, scale: 1, lpc: false };
}
