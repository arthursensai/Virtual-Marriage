/**
 * تعريف عام لأي NPC ثابت داخل ساحة الحفل (دي جي، مصوّر، نادل، مأذون...).
 * لا يرتبط هذا الملف بأي NPC معيّن — كل NPC يُعرَّف في ملفه الخاص (مثل lib/npc/dj.ts)
 * ويصدّر قيمة من هذا النوع.
 */

export type NPCFacing = 'up' | 'down' | 'left' | 'right';

export interface NPCDefinition {
  /** معرّف فريد وثابت، مثل 'wedding-dj' */
  id: string;
  /** تسمية قصيرة تظهر في لافتة التفاعل، مثل '🎧 DJ' */
  label: string;
  /** الموضع الثابت داخل الخريطة (بوحدات lib/pixel/venue.ts) */
  x: number;
  z: number;
  /** اتجاه النظر الافتراضي، إن كان الرندرر يدعم اتجاهات */
  facing: NPCFacing;
  /** نصف قطر التصادم الفعلي (جسم الـ NPC) */
  collisionRadius: number;
  /** المسافة التي يصبح فيها اللاعب "قريبًا" ويظهر له خيار التفاعل */
  interactionRadius: number;
}

/** المسافة الأوكليدية بين نقطة (لاعب) وموضع الـ NPC */
export function distanceToNPC(npc: NPCDefinition, x: number, z: number): number {
  return Math.hypot(x - npc.x, z - npc.z);
}

/** هل اللاعب داخل نطاق التفاعل مع هذا الـ NPC؟ */
export function isNearNPC(npc: NPCDefinition, x: number, z: number): boolean {
  return distanceToNPC(npc, x, z) <= npc.interactionRadius;
}
