'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useUser } from '@/lib/auth';
import { guestLook, cloneLook, DEFAULT_LOOKS } from '@/lib/looks';
import { createWedding, joinWedding, friendlyError } from '@/lib/wedding';
import { clientId } from '@/lib/util';

/** إنشاء حفل (العريس) أو الانضمام برمز (عروس/ضيف). الدور يُحسم في الخادم. */
export default function EntryForm({ mode, presetCode = '' }: { mode: 'create' | 'join'; presetCode?: string }) {
  const router = useRouter();
  const user = useUser();
  const [name, setName] = useState('');
  const [code, setCode] = useState(presetCode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [missing, setMissing] = useState(false);
  const [slow, setSlow] = useState(false);
  const here = mode === 'create' ? '/create' : `/join${presetCode ? '?code=' + presetCode : ''}`;

  useEffect(() => {
    if (!getSupabase()) setMissing(true);
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (user === null) router.replace(`/auth/login?next=${encodeURIComponent(here)}`);
  }, [user, router, here]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const n = name.trim() || (mode === 'create' ? 'العريس' : 'ضيف');
      const res =
        mode === 'create'
          ? await createWedding(n, cloneLook(DEFAULT_LOOKS.groom))
          : await joinWedding(code, n, guestLook(user?.id ?? clientId()));
      router.push(`/wedding/${res.code}`);
    } catch (x) {
      setErr(friendlyError(x));
      setBusy(false);
    }
  };

  if (missing) {
    return (
      <main className="home">
        <div className="box">
          <div className="warn">
            إعدادات Supabase غير موجودة. أضف <b dir="ltr">NEXT_PUBLIC_SUPABASE_URL</b> و <b dir="ltr">NEXT_PUBLIC_SUPABASE_ANON_KEY</b> في متغيرات البيئة (Vercel ← Settings ← Environment Variables) ثم أعد النشر.
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="home">
        <div className="box">
          <p className="lead">{user === null ? 'جارٍ تحويلك إلى تسجيل الدخول…' : 'جارٍ التحقق من حسابك…'}</p>
          {slow && (
            <Link className="primary" href={`/auth/login?next=${encodeURIComponent(here)}`} style={{ display: 'inline-block', padding: '.7rem 1.4rem', borderRadius: 14 }}>
              تسجيل الدخول
            </Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="home">
      <div className="box">
        <h1>{mode === 'create' ? 'أنشئ حفلك' : 'انضم إلى حفل'}</h1>
        <form className="card" onSubmit={submit}>
          <label className="field">
            اسمك في الحفل
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="سيظهر فوق شخصيتك" />
          </label>
          {mode === 'join' && (
            <label className="field">
              رمز الحفل
              <input dir="ltr" value={code} maxLength={10} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" required />
            </label>
          )}
          {err && <div className="warn">{err}</div>}
          <button className="primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? '…' : mode === 'create' ? 'إنشاء الحفل ✨' : 'دخول الحفل'}
          </button>
        </form>
      </div>
    </main>
  );
}
