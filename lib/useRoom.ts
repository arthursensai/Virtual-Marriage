'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { Presence } from './types';

export type RoomStatus = 'idle' | 'connecting' | 'online' | 'error' | 'nokeys';
type Handler = (payload: unknown) => void;

/**
 * غرفة الحفل: تعتمد على Supabase Realtime (Presence + Broadcast) فقط، بدون جداول.
 * - Presence: يحمل حالة كل مشارك (المظهر، الاسم، وحالة الحفل عند العريس).
 * - Broadcast: للتفاعلات السريعة (تصفيق، قلوب) والرسائل وحركة اللاعبين (pos) — مؤقتة ولا تُحفظ.
 */
export function useRoom(code: string, id: string) {
  const [peers, setPeers] = useState<Presence[]>([]);
  const [status, setStatus] = useState<RoomStatus>('idle');
  const chRef = useRef<RealtimeChannel | null>(null);
  const ready = useRef(false);
  const latest = useRef<Presence | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef<Record<string, Handler>>({});

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setStatus('nokeys');
      return;
    }
    setStatus('connecting');
    const ch = sb.channel('vw:' + code, { config: { presence: { key: id }, broadcast: { self: true } } });
    chRef.current = ch;

    const sync = () => {
      const st = ch.presenceState<Presence>();
      const list: Presence[] = [];
      Object.values(st).forEach((arr) => {
        const p = arr[arr.length - 1];
        if (p) list.push(p as Presence);
      });
      setPeers(list);
    };
    ch.on('presence', { event: 'sync' }, sync);
    ch.on('broadcast', { event: 'react' }, ({ payload }) => handlers.current.react?.(payload));
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => handlers.current.chat?.(payload));
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => handlers.current.pos?.(payload));
    ch.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        ready.current = true;
        setStatus('online');
        if (latest.current) await ch.track(latest.current);
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
        setStatus('error');
      }
    });
    return () => {
      ready.current = false;
      if (timer.current) clearTimeout(timer.current);
      void sb.removeChannel(ch);
      chRef.current = null;
    };
  }, [code, id]);

  const update = useCallback((p: Presence) => {
    latest.current = p;
    if (!ready.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void chRef.current?.track(latest.current as Presence);
    }, 120);
  }, []);

  const send = useCallback((event: 'react' | 'chat' | 'pos', payload: unknown) => {
    void chRef.current?.send({ type: 'broadcast', event, payload });
  }, []);

  const on = useCallback((event: 'react' | 'chat' | 'pos', fn: Handler) => {
    handlers.current[event] = fn;
  }, []);

  return { peers, status, update, send, on };
}
