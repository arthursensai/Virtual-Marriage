import type { Look } from '../types';
import { defaultLpc } from '../avatar/catalog';
import type { NPCDefinition } from './npc';

/** يقف عند القوس خلف العروسين مباشرة، ثابت طوال الوقت (زي منصّة الدي جي) */
export const OFFICIANT_NPC: NPCDefinition = {
  id: 'wedding-officiant',
  label: '📖 المأذون',
  x: 0,
  z: -2.6,
  facing: 'down',
  collisionRadius: 0.3,
  interactionRadius: 0,
};

/** مظهر افتراضي آمن (نفس الأساس المستخدم لأي ضيف ذكر) — يمكن تخصيصه لاحقًا */
export const OFFICIANT_LOOK: Look = {
  female: false,
  skin: '#c68a5b',
  hair: '#d9d9d9',
  hairStyle: 'short',
  outfit: 'jellaba',
  color: '#1b2a49',
  acc: {},
  lpc: defaultLpc('guest_male'),
};
