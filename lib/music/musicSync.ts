'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WEDDING_TRACKS, type WeddingTrack } from './tracks';
import { musicManager } from './musicManager';
import type { MusicState } from '../types';

export type { MusicState };

export const DEFAULT_MUSIC_STATE: MusicState = {
  trackId: null,
  playing: false,
  startedAt: null,
  positionAtStart: 0,
  updatedAt: 0,
};

/** الموضع الحالي المُحسَّب من الحالة المشتركة ولحظة الآن، بدل الاعتماد على نبضات متكرّرة */
export function computePosition(state: MusicState, nowMs: number): number {
  if (!state.trackId) return 0;
  if (!state.playing || state.startedAt == null) return Math.max(0, state.positionAtStart);
  return Math.max(0, state.positionAtStart + (nowMs - state.startedAt) / 1000);
}

function adjacentTrack(id: string | null, dir: 1 | -1): WeddingTrack | null {
  const list = WEDDING_TRACKS;
  if (!list.length) return null;
  const i = id ? list.findIndex((t) => t.id === id) : -1;
  return list[(i + dir + list.length) % list.length] ?? null;
}

interface UseMusicSyncOpts {
  /** حالة القناة: نتصرّف فقط عند 'online' */
  roomOnline: boolean;
  /** يبثّ حدثًا على قناة الحفل الموجودة (نفس قناة pos/react/chat) */
  roomSend: (event: 'music', payload: unknown) => void;
  /** يسجّل معالجًا لحدث بثّ قادم */
  roomOn: (event: 'music', fn: (payload: unknown) => void) => void;
  /** آخر حالة موسيقى معروفة من Presence العريس — تُستخدم فقط للانضمام المتأخر */
  presenceBaseline: MusicState | null;
  /** هل هذا العميل مخوَّل بالتحكّم (عريس/عروس) */
  canControl: boolean;
}

export function useMusicSync(opts: UseMusicSyncOpts) {
  const [state, setState] = useState<MusicState>(DEFAULT_MUSIC_STATE);
  const seededRef = useRef(false);
  const { roomOn, roomSend, roomOnline, presenceBaseline, canControl } = opts;

  /* التقاط أول حالة معروفة من Presence عند الانضمام (قبل أي بثّ مباشر) */
  useEffect(() => {
    if (seededRef.current) return;
    if (!presenceBaseline || !presenceBaseline.trackId) return;
    seededRef.current = true;
    setState(presenceBaseline);
  }, [presenceBaseline]);

  /* الاستماع لبثّ التحكّم اللحظي — يطبَّق فورًا لدى كل المتصلين */
  useEffect(() => {
    roomOn('music', (payload) => {
      seededRef.current = true;
      setState(payload as MusicState);
    });
  }, [roomOn]);

  /* دفع الحالة الحالية إلى مدير التشغيل الفعلي في كل مرة تتغيّر */
  useEffect(() => {
    if (!musicManager) return;
    const pos = computePosition(state, Date.now());
    musicManager.applyRemote(state.trackId, state.playing, pos);
  }, [state]);

  /* إعادة مزامنة دورية من الجهاز المتحكّم فقط: تصحّح انحراف الساعة بين الجوالين
     وأي انجراف تراكمي بالتشغيل، بدل ما تعتمد فقط على لحظات التشغيل/الإيقاف/التبديل */
  useEffect(() => {
    if (!canControl || !roomOnline || !state.playing || !state.trackId) return;
    const iv = setInterval(() => {
      setState((s) => {
        if (!s.playing || !s.trackId) return s;
        const pos = computePosition(s, Date.now());
        const next = { ...s, startedAt: Date.now(), positionAtStart: pos, updatedAt: Date.now() };
        roomSend('music', next);
        return next;
      });
    }, 12000);
    return () => clearInterval(iv);
  }, [canControl, roomOnline, state.playing, state.trackId, roomSend]);

  const broadcast = useCallback(
    (next: MusicState) => {
      setState(next);
      if (roomOnline) roomSend('music', next);
    },
    [roomOnline, roomSend],
  );

  const playTrack = useCallback(
    (trackId: string) => {
      if (!canControl) return;
      broadcast({ trackId, playing: true, startedAt: Date.now(), positionAtStart: 0, updatedAt: Date.now() });
    },
    [broadcast, canControl],
  );

  const resume = useCallback(() => {
    if (!canControl || !state.trackId) return;
    broadcast({ ...state, playing: true, startedAt: Date.now(), positionAtStart: computePosition(state, Date.now()), updatedAt: Date.now() });
  }, [broadcast, canControl, state]);

  const pause = useCallback(() => {
    if (!canControl || !state.trackId) return;
    broadcast({ ...state, playing: false, startedAt: null, positionAtStart: computePosition(state, Date.now()), updatedAt: Date.now() });
  }, [broadcast, canControl, state]);

  const next = useCallback(() => {
    if (!canControl) return;
    const t = adjacentTrack(state.trackId, 1);
    if (t) broadcast({ trackId: t.id, playing: true, startedAt: Date.now(), positionAtStart: 0, updatedAt: Date.now() });
  }, [broadcast, canControl, state.trackId]);

  const prev = useCallback(() => {
    if (!canControl) return;
    const t = adjacentTrack(state.trackId, -1);
    if (t) broadcast({ trackId: t.id, playing: true, startedAt: Date.now(), positionAtStart: 0, updatedAt: Date.now() });
  }, [broadcast, canControl, state.trackId]);

  return { musicState: state, playTrack, resume, pause, next, prev };
}
