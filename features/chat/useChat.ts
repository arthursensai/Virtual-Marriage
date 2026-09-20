'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

export interface ChatRow {
  id: string;
  participant_id: string;
  content: string;
  created_at: string;
}

const KEEP = 100;
const COLS = 'id,participant_id,content,created_at';

function merge(cur: ChatRow[], add: ChatRow[]): ChatRow[] {
  const map = new Map(cur.map((r) => [r.id, r]));
  add.forEach((r) => map.set(r.id, r));
  return Array.from(map.values())
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
    .slice(-KEEP);
}

/**
 * دردشة الحفل: الرسائل محفوظة في جدول messages (RLS يمنع الانتحال)،
 * وتصل للجميع فورًا عبر Realtime postgres_changes.
 */
export function useChat({ weddingId, participantId, open }: { weddingId: string; participantId: string; open: boolean }) {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(open);
  openRef.current = open;
  const lastSend = useRef(0);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let dead = false;
    void sb
      .from('messages')
      .select(COLS)
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!dead && data) setRows((cur) => merge(cur, data as ChatRow[]));
      });
    const ch = sb
      .channel('msgs:' + weddingId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `wedding_id=eq.${weddingId}` }, (p) => {
        const r = p.new as ChatRow;
        setRows((cur) => merge(cur, [r]));
        if (!openRef.current && r.participant_id !== participantId) setUnread((u) => u + 1);
      })
      .subscribe();
    return () => {
      dead = true;
      void sb.removeChannel(ch);
    };
  }, [weddingId, participantId]);

  /** يعيد null عند النجاح أو رسالة خطأ للعرض */
  const send = useCallback(
    async (text: string): Promise<string | null> => {
      const content = text.trim().slice(0, 300);
      if (!content) return null;
      const now = Date.now();
      if (now - lastSend.current < 700) return 'أرسلت بسرعة، انتظر لحظة.';
      lastSend.current = now;
      const sb = getSupabase();
      if (!sb) return 'الاتصال غير متاح.';
      const { data, error } = await sb.from('messages').insert({ wedding_id: weddingId, participant_id: participantId, content }).select(COLS).single();
      if (error) return 'تعذّر إرسال الرسالة.';
      if (data) setRows((cur) => merge(cur, [data as ChatRow]));
      return null;
    },
    [weddingId, participantId],
  );

  return { rows, unread, send };
}
