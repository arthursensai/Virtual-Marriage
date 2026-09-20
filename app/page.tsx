'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(!!getSupabase());
  }, []);

  const create = () => {
    router.push('/create');
  };
  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length >= 4) router.push(`/join?code=${encodeURIComponent(c)}`);
  };

  return (
    <main className="home">
      <div className="box">
        <h1>حفل زفاف ودّي</h1>
        <p className="lead">
          أنشئ حفلًا ثلاثي الأبعاد، خصّص أزياء العروسين، وادعُ أصدقاءك برابط ليحضروا من هواتفهم ويصفّقوا ويهنّئوا في نفس اللحظة.
        </p>
        {!ok && (
          <div className="warn">
            لم تُضبط مفاتيح Supabase بعد، ولن تعمل الغرف الحيّة. انسخ الملف <code>.env.example</code> إلى <code>.env.local</code> وضع فيه الرابط والمفتاح، ثم أعد تشغيل الخادم.
          </div>
        )}
        <div className="card">
          <h2>أنا العريس وأريد إنشاء حفل</h2>
          <button className="primary" style={{ width: '100%' }} onClick={create}>
            أنشئ غرفة الحفل ✨
          </button>
        </div>
        <form className="card" onSubmit={join}>
          <h2>لديّ رمز غرفة</h2>
          <div className="row2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" maxLength={10} aria-label="رمز الغرفة" />
            <button className="ghost" type="submit" style={{ color: '#f4ecd8' }}>
              انضم
            </button>
          </div>
        </form>
        <small>الحفل ترفيهي فقط ولا يُعدّ عقد زواج رسميًا.</small>
      </div>
    </main>
  );
}
