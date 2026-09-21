'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      const sb = getSupabase();

      if (!sb) {
        setError('مفاتيح Supabase غير مضبوطة.');
        return;
      }

      const code = searchParams.get('code');
      const nextParam = searchParams.get('next');

      const next =
        nextParam && nextParam.startsWith('/')
          ? nextParam
          : '/';

      if (!code) {
        setError('لم يتم استلام رمز تسجيل الدخول من Google.');
        return;
      }

      const { error } = await sb.auth.exchangeCodeForSession(code);

      if (cancelled) return;

      if (error) {
        setError(error.message);
        return;
      }

      router.replace(next);
    }

    completeAuth();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="home">
      <div className="box">
        {error ? (
          <>
            <h1>تعذر تسجيل الدخول</h1>
            <div className="warn">{error}</div>
          </>
        ) : (
          <>
            <h1>جارٍ تسجيل الدخول…</h1>
            <p className="hint">
              نتحقق من حساب Google الخاص بك.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
