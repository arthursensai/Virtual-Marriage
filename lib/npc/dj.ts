import type { NPCDefinition } from './npc';
import { DJ_BOOTH } from '../pixel/venue';

/**
 * الدي جي: NPC ثابت على حافة ساحة الرقص، يتحكم بموسيقى الحفل.
 * الموضع مأخوذ من DJ_BOOTH في lib/pixel/venue.ts (نفس مصدر رسم المنصّة
 * وعائق التصادم) حتى لا يفترق الاثنان أبدًا.
 */
export const DJ_NPC: NPCDefinition = {
  id: 'wedding-dj',
  label: '🎧 DJ',
  x: DJ_BOOTH.x,
  z: DJ_BOOTH.z,
  facing: 'left',
  collisionRadius: 0.9,
  interactionRadius: 2.4,
};
