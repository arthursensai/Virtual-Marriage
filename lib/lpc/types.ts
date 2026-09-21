/**
 * أنواع نظام شخصيات LPC (Universal LPC Spritesheet) للعرض العلوي (Top-Down) ثنائي الأبعاد.
 *
 * تعتمد هذه القيم على فحص فعلي لملفات حزمة LPC الحقيقية (وليس افتراضات):
 * - كل حركة (idle / walk / ...) هي ملف PNG منفصل، وليست جزءًا من صفيحة واحدة كبيرة.
 * - كل إطار 64×64 بكسل (مؤكَّد بقياس الصور فعليًا).
 * - كل ملف حركة يحتوي 4 صفوف اتجاه بهذا الترتيب: up, left, down, right
 *   (مؤكَّد بصريًا من body/bodies/male/walk.png).
 * - idle.png أبعاده 128×256 → عمودان (إطاران) × 4 صفوف. وليس إطارًا واحدًا كما كان مفترضًا.
 * - walk.png أبعاده 576×256 → 9 أعمدة (إطارات) × 4 صفوف.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';
export type AnimState = 'idle' | 'walk';

/**
 * طبقات التركيب الفعلية للشخصية. "outfit" تمثّل إما زيًّا نسائيًّا كاملًا (dress) أو
 * قطعة صدرية رجالية (torso) بحسب الجنس والاختيار — التفاصيل في manifest.ts.
 * "accessory" لا يقابلها أي ملف حقيقي في الحزمة المرفوعة حتى الآن (انظر الحدود في
 * أسفل manifest.ts)، فتبقى صفيحة وهمية (mock) تلقائيًا عبر assetLoader.ts.
 */
export type LPCLayerKey = 'body' | 'feet' | 'outfit' | 'hair' | 'accessory';
export type LPCRole = 'groom' | 'bride' | 'guest';

/** ترتيب صفوف الاتجاهات في ملف LPC القياسي — مؤكَّد بصريًا من الحزمة الحقيقية */
export const LPC_DIRECTION_ORDER: Direction[] = ['up', 'left', 'down', 'right'];

export interface LPCAnimDef {
  /** إزاحة صف هذه الحركة داخل الصفيحة. كل حركة هنا ملف مستقل فإزاحتها دائمًا 0. */
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

/**
 * إعداد قياسي مطابق لكل ملفات LPC الحقيقية المستخدمة هنا (body / hair / outfit / feet):
 * إطار 64×64، idle.png بإطارين (وقوف خفيف الحركة)، walk.png بتسعة إطارات مشي.
 * كل الطبقات في هذا المشروع تتشارك هذا الإعداد لأن جميعها من نفس مولّد LPC الموحّد.
 */
export const DEFAULT_LPC_SHEET_META: LPCSheetMeta = {
  frameW: 64,
  frameH: 64,
  anims: {
    idle: { rowOffset: 0, frames: 2, fps: 2 },
    walk: { rowOffset: 0, frames: 9, fps: 10 },
  },
};

/**
 * طبقة واحدة جاهزة للرسم. مهم: في LPC الحقيقي، كل حركة (idle/walk) ملف PNG منفصل تمامًا
 * — وليست صفوفًا داخل صفيحة واحدة كما كان مفترضًا سابقًا. لذلك تحمل الطبقة رابطين
 * منفصلين (urls.idle و urls.walk)، ويختار المُصيِّر (renderer.ts) أيهما يحمّل ويرسم
 * حسب حالة الحركة الحالية للشخصية عند كل إطار رسم.
 */
export interface LPCLayerSource {
  key: LPCLayerKey;
  urls: Record<AnimState, string>;
  meta: LPCSheetMeta;
  /**
   * لون يُدمج على الصفيحة عبر canvas (multiply). يُستخدم فقط للطبقات التي لا تملك
   * ملفات ألوان حقيقية جاهزة في الحزمة (حاليًا: الشعر فقط). طبقات الزيّ (outfit) تستخدم
   * بدل ذلك ملف اللون الحقيقي المطابق مباشرة (انظر nearestLPCColorName في manifest.ts)
   * فلا تحمل tint.
   */
  tint?: string;
  zIndex: number;
}

/** مظهر شخصية كامل: طبقاته بترتيب الرسم الصحيح (من الأسفل إلى الأعلى) */
export interface LPCAppearance {
  role: LPCRole;
  layers: LPCLayerSource[];
}
