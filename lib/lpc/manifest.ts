import type { Look } from '../types';
import { SKINS } from '../characters';
import { DEFAULT_LPC_SHEET_META, type LPCAppearance, type LPCLayerSource, type LPCRole } from './types';

/**
 * جذر ملفات LPC. ضع الحزمة المرفوعة هنا بهذه البنية:
 *
 * public/game/assets/characters/lpc/
 * ├── body/       m_light.png  m_tan.png  m_amber.png  m_brown.png  m_dark.png
 * │               f_light.png  f_tan.png  f_amber.png  f_brown.png  f_dark.png
 * ├── hair/       m_short.png  m_curly.png  m_bald.png
 * │               f_long.png   f_bun.png    f_short.png   f_hijab.png
 * ├── outfit/
 * │   ├── groom/  m_suit.png  m_jellaba.png  m_kaftan.png
 * │   ├── bride/  f_gown.png  f_mermaid.png  f_kaftan.png
 * │   └── guest/  m_suit.png m_jellaba.png m_kaftan.png f_gown.png f_mermaid.png f_kaftan.png
 * └── accessory/  bowtie.png tarbouche.png beard.png shades.png flower.png
 *                 veil.png tiara.png bouquet.png necklace.png
 *
 * كل ملف صفيحة LPC قياسية: 64×64 بكسل للإطار، 4 صفوف اتجاه (up/left/down/right)،
 * وحتى 9 أعمدة لحركة المشي (العمود 0 يُستخدم أيضًا للوقوف/idle).
 * إن اختلفت الأبعاد أو ترتيب الصفوف في الحزمة الفعلية، عدّل DEFAULT_LPC_SHEET_META
 * في lib/lpc/types.ts فقط — لا حاجة لمس المُصيِّر أو هذا الملف.
 *
 * إلى أن تُرفع الملفات الحقيقية، سيعرض المُصيِّر صفائح مؤقتة (mock) مولَّدة تلقائيًا
 * بنفس الشبكة، بحيث يعمل النظام بالكامل من الآن.
 */
const BASE = '/game/assets/characters/lpc';
export const ASSET_ROOT = BASE;

const SKIN_TONE_NAMES = ['light', 'tan', 'amber', 'brown', 'dark'] as const;

/** يحوّل لون بشرة (hex) من قائمة SKINS الحالية إلى اسم لهجة جسد LPC القياسية */
function skinToneName(skinHex: string): string {
  const i = SKINS.indexOf(skinHex);
  return SKIN_TONE_NAMES[i >= 0 ? i : 0];
}
const g = (female: boolean) => (female ? 'f' : 'm');

function bodyUrl(female: boolean, skinHex: string) {
  return `${BASE}/body/${g(female)}_${skinToneName(skinHex)}.png`;
}
function hairUrl(female: boolean, style: string) {
  return `${BASE}/hair/${g(female)}_${style}.png`;
}
function outfitUrl(role: LPCRole, female: boolean, outfit: string) {
  return `${BASE}/outfit/${role}/${g(female)}_${outfit}.png`;
}
function accessoryUrl(key: string) {
  return `${BASE}/accessory/${key}.png`;
}

/**
 * يحوّل تخصيص الشخصية الحالي (Look — نفس البيانات التي تنتجها شاشة AvatarCustomizer
 * دون أي تغيير) إلى مظهر LPC بطبقات مرتّبة جاهزة للتحميل والرسم.
 */
export function resolveAppearance(role: LPCRole, look: Look): LPCAppearance {
  const layers: LPCLayerSource[] = [
    { key: 'body', url: bodyUrl(look.female, look.skin), meta: DEFAULT_LPC_SHEET_META, zIndex: 0 },
    { key: 'outfit', url: outfitUrl(role, look.female, look.outfit), meta: DEFAULT_LPC_SHEET_META, tint: look.color, zIndex: 1 },
    { key: 'hair', url: hairUrl(look.female, look.hairStyle), meta: DEFAULT_LPC_SHEET_META, tint: look.hair, zIndex: 2 },
  ];
  Object.entries(look.acc)
    .filter(([, on]) => on)
    .forEach(([accKey], i) => {
      layers.push({ key: 'accessory', url: accessoryUrl(accKey), meta: DEFAULT_LPC_SHEET_META, zIndex: 3 + i });
    });
  return { role, layers };
}
