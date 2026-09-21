import type { Look } from '../types';
import { DEFAULT_LPC_SHEET_META, type AnimState, type LPCAppearance, type LPCLayerSource, type LPCRole } from './types';

/**
 * جذر الأصول الحقيقية المرفوعة (عيّنة مختارة من Universal LPC Spritesheet — وليست الحزمة
 * كاملة 388MB). البنية والمسارات هنا مطابقة تمامًا لما تم فحصه فعليًا داخل الحزمة
 * (spritesheets/…)، وليست أسماء مُخترَعة.
 *
 * كل عنصر ملبس هنا هو ملفّا PNG منفصلان تمامًا لكل حركة (idle.png و walk.png) —
 * وليسا صفين داخل نفس الملف. بعضها له أيضًا مجلد فرعي بنفس اسم الحركة يحوي 24 نسخة
 * لونية جاهزة (black.png, white.png, ...) بدل الاعتماد على تلوين (tint) وقت التشغيل.
 * الشعر وحده ليس له نسخ لونية حقيقية في هذه العيّنة، فيبقى يُلوَّن عبر tint كالسابق.
 *
 * === الأصول المختارة فعليًا (108 ملف، 4.5MB، منسوخة إلى public/) ===
 * body/bodies/male/{idle,walk}.png
 * body/bodies/female/{idle,walk}.png
 * hair/{bangs,curly_short,balding,bangs_bun,bob}/adult/{idle,walk}.png
 * torso/aprons/suspenders/male/{idle,walk}/{9 ألوان}.png    → outfit: suit (رجالي)
 * torso/aprons/overalls/male/{idle,walk}/{9 ألوان}.png      → outfit: jellaba/kaftan (رجالي)
 * dress/kimono/normal/universal/female/{idle,walk}/{9 ألوان}.png           → outfit: gown
 * dress/kimono/sleeves_oversize/universal/female/{idle,walk}/{9 ألوان}.png → outfit: kaftan (نسائي)
 * dress/bodice/female/{idle,walk}/{9 ألوان}.png                            → outfit: mermaid
 * feet/boots/basic/male/{idle,walk}.png
 * feet/shoes/basic/thin/{idle,walk}.png
 *
 * الألوان التسعة المنسوخة: black, blue, maroon, navy, pink, purple, teal, white, yellow
 * (تغطي كل قيم CLOTHC الحالية في characters.ts عبر nearestLPCColorName أدناه).
 *
 * === حدود حقيقية يجب معرفتها (وليست مخفيّة) ===
 * 1) لا توجد في هذه العيّنة أي ملفات إكسسوار حقيقية (veil/tiara/bowtie/tarbouche/shades/
 *    flower/bouquet/necklace) — فقط تعريفات JSON في sheet_definitions/headwear بلا صور.
 *    طبقة accessory تُشير إلى مسارات LPC منطقية (لسهولة الإضافة لاحقًا عبر إسقاط ملفات
 *    idle.png/walk.png حقيقية في accessory/<key>/) لكنها ستعرض صفيحة وهمية (mock)
 *    تلقائيًا عبر assetLoader.ts حتى تُرفع تلك الملفات.
 * 2) لا توجد فئة legs/ (تنانير/سراويل) في هذه العيّنة. كل عناصر outfit هنا (kimono/bodice/
 *    apron variants) تغطي الجزء العلوي من الجسم فقط بحسب الفحص البصري المباشر للصور —
 *    الساقان ستظهران عاريتين تحت الزيّ. لتغطية كاملة يجب رفع sheet_definitions/legs +
 *    spritesheets/legs المطابقة (تنورة للعروس، بنطلون للعريس) وإضافة طبقة 'legs' جديدة.
 * 3) لا توجد نُسخ تفاوت في لون البشرة (SKINS) في هذه العيّنة — جسد واحد فقط لكل جنس.
 *    اختيار look.skin لا يغيّر شكل الجسد حاليًا؛ يحتاج ذلك مجلدات body/bodies إضافية
 *    (مثال: body/bodies/male/tanned، .../dark) من الحزمة الحقيقية.
 * 4) لا يوجد نمط شعر مخصص لـ"حجاب" في هذه العيّنة، فخيار hairStyle='hijab' يُستخدم فيه
 *    حاليًا bangs_bun كبديل محايد مؤقت إلى أن تُرفع أصول حجاب حقيقية.
 * 5) "kaftan" الرجالي و"jellaba" يستخدمان نفس ملف overalls (بألوان مختلفة فقط) لعدم وجود
 *    عنصرين رجاليين متمايزين بصريًا بدرجة كافية في هذه العيّنة.
 */
const BASE = '/game/assets/characters/lpc';
export const ASSET_ROOT = BASE;

const g = (female: boolean) => (female ? 'female' : 'male');

function bodyUrls(female: boolean): Record<AnimState, string> {
  return { idle: `${BASE}/body/bodies/${g(female)}/idle.png`, walk: `${BASE}/body/bodies/${g(female)}/walk.png` };
}

/**
 * أنماط الشعر الحقيقية المتوفرة في هذه العيّنة (لا نسخ لونية — تُلوَّن عبر tint).
 * مفتاح 'short' مشترك بين OPT.male وOPT.female بمعنيين مختلفين، لذا التمييز هنا حسب
 * الجنس أيضًا (short الرجالي → bangs، short النسائي → bob).
 * hijab: لا يوجد أصل حقيقي بعد → بديل مؤقت bangs_bun، انظر الحدود أعلاه.
 */
function hairAssetFor(female: boolean, hairStyle: string): string {
  if (hairStyle === 'short') return female ? 'bob' : 'bangs';
  if (hairStyle === 'curly') return 'curly_short';
  if (hairStyle === 'bald') return 'balding';
  if (hairStyle === 'long' || hairStyle === 'bun' || hairStyle === 'hijab') return 'bangs_bun';
  return 'bangs';
}

function hairUrls(female: boolean, hairStyle: string): Record<AnimState, string> {
  const asset = hairAssetFor(female, hairStyle);
  return { idle: `${BASE}/hair/${asset}/adult/idle.png`, walk: `${BASE}/hair/${asset}/adult/walk.png` };
}

function feetUrls(female: boolean): Record<AnimState, string> {
  return female
    ? { idle: `${BASE}/feet/shoes/basic/thin/idle.png`, walk: `${BASE}/feet/shoes/basic/thin/walk.png` }
    : { idle: `${BASE}/feet/boots/basic/male/idle.png`, walk: `${BASE}/feet/boots/basic/male/walk.png` };
}

/**
 * جدول تقريبي (استرشادي وليس مسحوبًا بكسليًا من الصور) لأقرب اسم لون LPC حقيقي من بين
 * الأسماء الـ24 المتوفرة في الحزمة، لأي لون hex عشوائي (كقيم CLOTHC في characters.ts).
 */
const LPC_COLOR_NAMES: Record<string, string> = {
  black: '#1a1a1a', white: '#f5f5f0', navy: '#1b2a49', blue: '#2f5fa8', sky: '#7ec8e3',
  teal: '#0f6b5c', forest: '#1e5b34', green: '#2e8b45', bluegray: '#5b7c8d', gray: '#8a8a8a',
  slate: '#475569', charcoal: '#33383d', brown: '#6b4226', walnut: '#5c4033', leather: '#8b5a2b',
  tan: '#d2b48c', red: '#c0392b', maroon: '#7f1d1d', rose: '#e11d48', orange: '#c2712f',
  yellow: '#d4af37', purple: '#6a2c91', lavender: '#c4b5fd', pink: '#e58fb0',
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** يحوّل أي لون hex إلى أقرب اسم لون LPC حقيقي (black/white/navy/...) */
export function nearestLPCColorName(hex: string): string {
  const target = hexToRgb(hex);
  let best = 'white';
  let bestDist = Infinity;
  for (const [name, sample] of Object.entries(LPC_COLOR_NAMES)) {
    const [r, gg, b] = hexToRgb(sample);
    const d = (target[0] - r) ** 2 + (target[1] - gg) ** 2 + (target[2] - b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

/**
 * الألوان المنسوخة فعليًا إلى public/. أي اسم لون خارج هذه القائمة يؤدي لفشل تحميل
 * الصورة (404) والانتقال التلقائي للصفيحة الوهمية عبر assetLoader.ts — سلوك آمن ومقصود
 * (احتياطي تطوير)، لكن الأفضل توسيع هذه القائمة لاحقًا بنسخ ملفات ألوان إضافية.
 */
const COPIED_COLORS = new Set(['black', 'blue', 'maroon', 'navy', 'pink', 'purple', 'teal', 'white', 'yellow']);

function safeColor(hex: string): string {
  const name = nearestLPCColorName(hex);
  return COPIED_COLORS.has(name) ? name : 'white';
}

/** خرائط outfit → مجلد المسار الحقيقي، منفصلة حسب الجنس (نفس اسم المفتاح قد يختلف معناه) */
const MALE_OUTFIT_DIR: Record<string, string> = {
  suit: `${BASE}/torso/aprons/suspenders/male`,
  jellaba: `${BASE}/torso/aprons/overalls/male`,
  kaftan: `${BASE}/torso/aprons/overalls/male`,
};
const FEMALE_OUTFIT_DIR: Record<string, string> = {
  gown: `${BASE}/dress/kimono/normal/universal/female`,
  kaftan: `${BASE}/dress/kimono/sleeves_oversize/universal/female`,
  mermaid: `${BASE}/dress/bodice/female`,
};

function outfitUrls(female: boolean, outfit: string, colorHex: string): Record<AnimState, string> {
  const table = female ? FEMALE_OUTFIT_DIR : MALE_OUTFIT_DIR;
  const dir = table[outfit] ?? (female ? table.gown : table.suit);
  const color = safeColor(colorHex);
  return { idle: `${dir}/idle/${color}.png`, walk: `${dir}/walk/${color}.png` };
}

/** لا يوجد أصل إكسسوار حقيقي بعد (انظر الحدّ 1 أعلاه) — يبقى بلا نسخة لونية أو تلوين */
function accessoryUrls(key: string): Record<AnimState, string> {
  return { idle: `${BASE}/accessory/${key}/idle.png`, walk: `${BASE}/accessory/${key}/walk.png` };
}

function layer(key: LPCLayerSource['key'], urls: Record<AnimState, string>, zIndex: number, tint?: string): LPCLayerSource {
  return { key, urls, meta: DEFAULT_LPC_SHEET_META, zIndex, ...(tint ? { tint } : {}) };
}

/**
 * يحوّل تخصيص الشخصية الحالي (Look — نفس البيانات التي تنتجها شاشة AvatarCustomizer دون
 * أي تغيير) إلى مظهر LPC بطبقات مرتّبة جاهزة للتحميل والرسم. كل طبقة تحمل رابطي idle/walk
 * معًا؛ يختار renderer.ts الرابط المناسب عند كل رسم حسب حالة حركة الشخصية الفعلية.
 * توقيع الدالة (role, look) والنوع Look لم يتغيّرا — فقط محتوى الطبقات الداخلي.
 */
export function resolveAppearance(role: LPCRole, look: Look): LPCAppearance {
  const layers: LPCLayerSource[] = [
    layer('body', bodyUrls(look.female), 0),
    layer('feet', feetUrls(look.female), 1),
    layer('outfit', outfitUrls(look.female, look.outfit, look.color), 2),
    layer('hair', hairUrls(look.female, look.hairStyle), 3, look.hair),
  ];
  Object.entries(look.acc)
    .filter(([, on]) => on)
    .forEach(([accKey], i) => {
      layers.push(layer('accessory', accessoryUrls(accKey), 4 + i));
    });
  return { role, layers };
}
