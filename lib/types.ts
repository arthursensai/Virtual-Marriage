import type { LpcLook } from './avatar/types';

export type Role = 'groom' | 'bride' | 'guest';

export interface Look {
  female: boolean;
  skin: string;
  hair: string;
  hairStyle: string;
  outfit: string;
  color: string;
  acc: Record<string, boolean>;
  /** مظهر LPC التفصيلي (اختياري). إن غاب أو لم تتوفر الأصول تُرسم الشخصية البكسلية البسيطة */
  lpc?: LpcLook;
}

/** a = الإيجاب/القبول ، s = التوقيع ، round = رقم جولة الحفل */
export interface Gates {
  a: boolean;
  s: boolean;
  round: number;
}

/** حالة الحفل يملكها العريس ويبثّها للجميع (step: -1 = قاعة الانتظار، 0..5 مراحل الحفل، 6 = الشهادة) */
export interface Ceremony {
  round: number;
  step: number;
  stepStartedAt: number;
  night: boolean;
}

export interface BrideProxy {
  name: string;
  look: Look;
  vow: string;
  gates: Gates;
}

/** موضع اللاعب على الخريطة (يُحفظ في Presence عند التوقف فقط، لا في قاعدة البيانات) */
export interface Pos {
  x: number;
  z: number;
  r: number;
}

export interface Presence {
  id: string;
  role: Role;
  name: string;
  look: Look;
  vow?: string;
  joinedAt: number;
  ceremony?: Ceremony;
  gates?: Gates;
  proxy?: BrideProxy;
  pos?: Pos;
}

export interface PersonView {
  name: string;
  look: Look;
  pos?: Pos;
  vow: string;
  gates: { a: boolean; s: boolean };
}

export interface GuestInfo {
  id: string;
  name: string;
  look: Look;
  pos?: Pos;
}

export interface ChatMsg {
  id: string;
  name: string;
  text: string;
  ts: number;
}
