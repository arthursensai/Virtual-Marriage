'use client';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

/** المستخدم الحالي: undefined = جارٍ التحميل، null = غير مسجّل */
export function useUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setUser(null);
      return;
    }
    void sb.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return user;
}

export async function signOut() {
  await getSupabase()?.auth.signOut();
}
