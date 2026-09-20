/**
 * أنواع نظام شخصيات LPC (Universal LPC Spritesheet) للعرض العلوي (Top-Down) ثنائي الأبعاد.
 *
 * هذا الملف يصف "الشكل" الذي يتوقعه المُصيِّر (renderer) من كل طبقة (جسد/شعر/زيّ/إكسسوار):
 * شبكة من الصفوف (اتجاه) والأعمدة (إطار الحركة)، بأبعاد ثابتة لكل إطار.
 * بمجرد رفع ملفات LPC الحقيقية بنفس المسارات المعرّفة في manifest.ts، ستُستخدم تلقائيًا
 * بدل الصفائح المؤقتة (mock) دون أي تعديل على المُصيِّر أو منطق الحركة.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';
export type AnimState = 'idle' | 'walk';
export type LPCLayerKey = 'body' | 'hair' | 'outfit' | 'accessory';
export type LPCRole = 'groom' | 'bride' | 'guest';

/** ترتيب صفوف الاتجاهات في ملف LPC القياسي (Universal LPC Spritesheet) */
export const LPC_DIRECTION_ORDER: Direction[] = ['up', 'left', 'down', 'right'];

export interface LPCAnimDef {
  /** إزاحة صف هذه الحركة تحديدًا داخل الصفيحة (بعض ملفات LPC تخصّص صفوفًا مختلفة لكل حركة) */
  rowOffset: number;
  frames: number;
  fps: number;
}

/** بيانات وصفية لصفيحة سبرايت واحدة (طبقة واحدة، كالجسد أو الشعر) */
export interface LPCSheetMeta {
  frameW: number;
  frameH: number;
  anims: Record<AnimState, LPCAnimDef>;
}

/** إعداد افتراضي يطابق تخطيط LPC الشائع: إطار 64×64، مشي بـ9 إطارات، وقوف بإطار واحد (عمود 0) */
export const DEFAULT_LPC_SHEET_META: LPCSheetMeta = {
  frameW: 64,
  frameH: 64,
  anims: {
    idle: { rowOffset: 0, frames: 1, fps: 1 },
    walk: { rowOffset: 0, frames: 9, fps: 12 },
  },
};

/** طبقة واحدة جاهزة للرسم: رابط الصورة + بياناتها الوصفية + لون تلوين اختياري + ترتيب الرسم */
export interface LPCLayerSource {
  key: LPCLayerKey;
  url: string;
  meta: LPCSheetMeta;
  /** لون يُدمج على الصفيحة (لتلوين الشعر/الزيّ حسب اختيار المستخدم) */
  tint?: string;
  zIndex: number;
}

/** مظهر شخصية كامل: طبقاته بترتيب الرسم الصحيح (من الأسفل إلى الأعلى) */
export interface LPCAppearance {
  role: LPCRole;
  layers: LPCLayerSource[];
}
