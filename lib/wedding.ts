import { getSupabase } from './supabase';
import type { Look } from './types';

export type WeddingRole = 'husband' | 'wife' | 'guest';
export type WeddingStatus = 'lobby' | 'ceremony' | 'celebration' | 'ended';
export interface JoinResult {
  id: string;
  code: string;
  role: WeddingRole;
}

function sb() {
  const c = getSupabase();
  if (!c) throw new Error('Supabase غير مضبوط');
  return c;
}

/** الدور يحدّده الخادم (دالة SQL)، لا العميل */
export async function createWedding(displayName: string, look: Look): Promise<JoinResult> {
  const { data, error } = await sb().rpc('create_wedding', { p_display_name: displayName, p_look: look });
  if (error) throw error;
  return data as JoinResult;
}

export async function joinWedding(code: string, displayName: string, look: Look): Promise<JoinResult> {
  const { data, error } = await sb().rpc('join_wedding', { p_code: code, p_display_name: displayName, p_look: look });
  if (error) throw error;
  return data as JoinResult;
}

export async function getWifeCode(weddingId: string): Promise<string | null> {
  const { data, error } = await sb().rpc('get_wife_code', { p_wedding: weddingId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function setWeddingStatus(weddingId: string, status: WeddingStatus) {
  const { error } = await sb().rpc('set_wedding_status', { p_wedding: weddingId, p_status: status });
  if (error) throw error;
}

/** رسائل خطأ عربية مفهومة */
export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (m.includes('wedding not found')) return 'الرمز غير صحيح، تأكد منه وحاول مرة أخرى.';
  if (m.includes('wedding ended')) return 'انتهى هذا الحفل.';
  if (m.includes('wife already joined')) return 'انضمت العروس بالفعل بهذا الرمز.';
  if (m.includes('not authenticated')) return 'سجّل الدخول أولًا.';
  if (m.includes('Invalid login credentials')) return 'البريد أو كلمة السر غير صحيحة.';
  if (m.includes('already registered')) return 'هذا البريد مسجّل من قبل، جرّب تسجيل الدخول.';
  if (m.includes('Password should be')) return 'كلمة السر قصيرة، استخدم 6 أحرف على الأقل.';
  if (m.includes('Email not confirmed')) return 'أكّد بريدك من الرسالة التي وصلتك ثم سجّل الدخول.';
  return m || 'حدث خطأ غير متوقع.';
}
