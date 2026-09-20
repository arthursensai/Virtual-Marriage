import type { Look, Role } from '@/lib/types';

/** المستخدم الحالي داخل حفل معيّن، كما حدّدته قاعدة البيانات */
export interface Me {
  userId: string;
  participantId: string;
  weddingId: string;
  role: Role;
  name: string;
  look: Look;
}

/** أدوار قاعدة البيانات (husband/wife/guest) إلى أدوار الواجهة (groom/bride/guest) */
export const toRole = (r: string): Role => (r === 'husband' ? 'groom' : r === 'wife' ? 'bride' : 'guest');
