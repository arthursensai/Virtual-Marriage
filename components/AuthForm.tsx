'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/wedding';

/** نموذج دخول/تسجيل بالبريد وكلمة السر. لاحقًا نضيف أزرار Google وDiscord هنا عبر signInWithOAuth. */
export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') && sp.get('next')!.startsWith('/') ? sp.get('next')! : '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const signup = mode === 'signup';
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!getSupabase()) setMissing(true);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return setErr('مفاتيح Supabase غير مضبوطة.');
    setBusy(true);
    setErr('');
    setInfo('');
    try {
      if (signup) {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo('أرسلنا رسالة تأكيد إلى بريدك. اضغط الرابط فيها ثم سجّل الدخول.');
          return;
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      router.replace(next);
    } catch (x) {
      setErr(friendlyError(x));
    } finally {
      setBusy(false);
    }
  };

  const other = `${signup ? '/auth/login' : '/auth/signup'}?next=${encodeURIComponent(next)}`;

  return (
    <main className="home">
      <div className="box">
        <h1>{signup ? 'إنشاء حساب' : 'تسجيل الدخول'}</h1>
        <form className="card" onSubmit={submit}>
          {signup && (
            <label className="field">
              الاسم
              <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="اسمك كما سيظهر في الحفل" required />
            </label>
          )}
          <label className="field">
            البريد الإلكتروني
            <input type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" required />
          </label>
          <label className="field">
            كلمة السر
            <input type="password" dir="ltr" autoComplete={signup ? 'new-password' : 'current-password'} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {missing && <div className="warn">مفاتيح Supabase غير مضبوطة في البيئة، لن يعمل الدخول قبل إضافتها.</div>}
          {err && <div className="warn">{err}</div>}
          {info && <p className="hint">{info}</p>}
          <button className="primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? '…' : signup ? 'إنشاء الحساب' : 'دخول'}
          </button>
        </form>
        <small>
          {signup ? 'لديك حساب؟ ' : 'ليس لديك حساب؟ '}
          <Link href={other} style={{ color: '#f4ecd8' }}>{signup ? 'سجّل الدخول' : 'أنشئ حسابًا'}</Link>
        </small>
      </div>
    </main>
  );
}
