'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/auth';
import { guestLook, cloneLook, DEFAULT_LOOKS } from '@/lib/characters';
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
  const here = mode === 'create' ? '/create' : `/join${presetCode ? '?code=' + presetCode : ''}`;

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
      router.push(`/room/${res.code}`);
    } catch (x) {
      setErr(friendlyError(x));
      setBusy(false);
    }
  };

  if (!user) return <main className="home" />;

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
