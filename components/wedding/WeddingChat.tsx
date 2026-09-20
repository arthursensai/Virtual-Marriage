'use client';
import { useEffect, useRef, useState } from 'react';
import type { ChatRow } from '@/features/chat/useChat';

interface Props {
  rows: ChatRow[];
  names: Record<string, string>;
  myPid: string;
  onSend: (text: string) => Promise<string | null>;
  onClose: () => void;
}

/** دردشة الحفل: لوحة جانبية على الحاسوب وورقة سفلية على الجوال (CSS) */
export default function WeddingChat({ rows, names, myPid, onSend, onClose }: Props) {
  const [t, setT] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: 1e6 });
  }, [rows]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = t.trim();
    if (!v || busy) return;
    setBusy(true);
    const problem = await onSend(v);
    setBusy(false);
    if (problem) setErr(problem);
    else {
      setErr('');
      setT('');
    }
  };

  return (
    <section className="chat" aria-label="دردشة الحفل">
      <header className="chat-head">
        <span>💬 دردشة الحفل</span>
        <button type="button" className="chat-x" onClick={onClose} aria-label="إغلاق">
          ×
        </button>
      </header>
      <div className="list" ref={ref} role="log" aria-live="polite">
        {rows.length === 0 && <p className="chat-empty">اكتب أول رسالة تهنئة 🎊</p>}
        {rows.map((m) => (
          <div key={m.id} className={'msg' + (m.participant_id === myPid ? ' mine' : '')}>
            <b dir="auto">{names[m.participant_id] || '…'}</b>
            <p dir="auto">{m.content}</p>
          </div>
        ))}
      </div>
      {err && <div className="chat-err">{err}</div>}
      <form onSubmit={submit}>
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="اكتب رسالة…" maxLength={300} aria-label="رسالة" dir="auto" />
        <button className="chat-send" type="submit" disabled={busy || !t.trim()} aria-label="إرسال">
          ➤
        </button>
      </form>
    </section>
  );
}
