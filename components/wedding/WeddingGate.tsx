'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import WeddingRoom from './WeddingRoom';
import { toRole, type Me } from './types';
import { DEFAULT_LOOKS, cloneLook, guestLook } from '@/lib/characters';
import { useUser } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import type { Look } from '@/lib/types';
import { friendlyError } from '@/lib/wedding';

export default function WeddingGate({ code }: { code: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="app" />;
  return <Gate code={code} />;
}


/** بوّابة: تتحقق من الجلسة والعضوية من قاعدة البيانات، والدور يأتي من الخادم فقط */
function Gate({ code }: { code: string }) {
  const router = useRouter();
  const user = useUser();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user === undefined) return;
    if (user === null) {
      router.replace(`/auth/login?next=${encodeURIComponent('/wedding/' + code)}`);
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setErr('مفاتيح Supabase غير مضبوطة في البيئة.');
      return;
    }
    let dead = false;
    void (async () => {
      const w = await sb.from('weddings').select('id').eq('code', code).maybeSingle();
      if (dead) return;
      if (w.error) return setErr(friendlyError(w.error));
      if (!w.data) return router.replace(`/join?code=${code}`);
      const p = await sb.from('participants').select('id,role,display_name,look').eq('wedding_id', w.data.id).eq('user_id', user.id).maybeSingle();
      if (dead) return;
      if (p.error) return setErr(friendlyError(p.error));
      if (!p.data) return router.replace(`/join?code=${code}`);
      const role = toRole(p.data.role);
      const saved = p.data.look as Partial<Look> | null;
      const base = role === 'groom' ? DEFAULT_LOOKS.groom : role === 'bride' ? DEFAULT_LOOKS.bride : guestLook(user.id);
      setMe({
        userId: user.id,
        participantId: p.data.id as string,
        weddingId: w.data.id,
        role,
        name: p.data.display_name ?? '',
        look: saved && saved.skin ? (saved as Look) : cloneLook(base),
      });
    })();
    return () => {
      dead = true;
    };
  }, [user, code, router]);

  if (err) {
    return (
      <div className="center-msg">
        <div>
          <h2>تعذّر فتح الحفل</h2>
          <p>{err}</p>
        </div>
      </div>
    );
  }
  if (!me) {
    return (
      <div className="center-msg">
        <div>
          <h2>💍 جارٍ الدخول إلى القاعة…</h2>
        </div>
      </div>
    );
  }
  return <WeddingRoom code={code} me={me} />;
}
