'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { joinWedding, friendlyError } from '@/lib/wedding';
import { cloneLook, DEFAULT_LOOKS } from '@/lib/looks';

/**
 * شاشة دخول مخصّصة لملاك: اسمها + "كلمة السر" (وهي رمز العروس السرّي نفسه
 * الذي يحصل عليه محمد من لوحة التحكم). لا حاجة لبريد إلكتروني أو حساب Google —
 * الجلسة تُنشأ تلقائيًا (تسجيل دخول مجهول) خلف الكواليس، ودور "العروسة"
 * يُحسم في الخادم بنفس الطريقة المعتادة عند إرسال الرمز الصحيح.
 */
export default function BrideClient() {
  const router = useRouter();
  const presetCode = (useSearchParams().get('code') ?? '').toUpperCase();
  const [name, setName] = useState('');
  const [password, setPassword] = useState(presetCode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!getSupabase()) setMissing(true);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('missing-config');

      // تأكّدي من وجود جلسة؛ إن لم توجد أنشئي واحدة مجهولة (بلا بريد ولا كلمة سر حساب)
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session) {
        const { error } = await sb.auth.signInAnonymously();
        if (error) throw error;
      }

      const res = await joinWedding(password, name.trim() || 'العروسة', cloneLook(DEFAULT_LOOKS.bride));
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
            إعدادات Supabase غير موجودة. أضف <b dir="ltr">NEXT_PUBLIC_SUPABASE_URL</b> و <b dir="ltr">NEXT_PUBLIC_SUPABASE_ANON_KEY</b> ثم أعد النشر.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="home">
      <div className="box">
        <h1>👰 أهلًا ملاك</h1>
        <p className="lead">ادخلي بكلمة السر اللي أعطاك إياها محمد، وخصّصي شكلك بنفسك بكل حرية.</p>
        <form className="card" onSubmit={submit}>
          <label className="field">
            اسمك
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="ملاك" required />
          </label>
          <label className="field">
            كلمة السر
            <input
              dir="ltr"
              type="password"
              value={password}
              maxLength={10}
              onChange={(e) => setPassword(e.target.value.toUpperCase())}
              placeholder="ABC123"
              required
              style={{ letterSpacing: '.2em', textTransform: 'uppercase' }}
            />
          </label>
          {err && <div className="warn">{err}</div>}
          <button className="primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? '…' : 'ادخلي الحفل 💍'}
          </button>
        </form>
        <small>هذه الشاشة مخصّصة للعروسة فقط، ولا تحتاجين بريدًا إلكترونيًا أو حساب جوجل.</small>
      </div>
    </main>
  );
}
