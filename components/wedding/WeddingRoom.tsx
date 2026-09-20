'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AvatarCustomizer from '@/components/avatar/AvatarCustomizer';
import Certificate from './Certificate';
import Joystick from './Joystick';
import WeddingChat from './WeddingChat';
import WeddingControls from './WeddingControls';
import WeddingHUD, { type HudPlayer } from './WeddingHUD';
import type { StageHandle } from './WeddingScene';
import { toRole, type Me } from './types';
import { DEFAULT_LOOKS, cloneLook } from '@/lib/characters';
import { derive } from '@/lib/derive';
import { WALK_MS, type ReactKind } from '@/lib/scene';
import { chime, ding, setSound, unlockAudio } from '@/lib/sound';
import type { BrideProxy, Ceremony, Gates, Look, Pos, Presence, Role } from '@/lib/types';
import { useRoom } from '@/lib/useRoom';
import { useChat } from '@/features/chat/useChat';
import { getSupabase } from '@/lib/supabase';
import { getWifeCode, setWeddingStatus, type WeddingStatus } from '@/lib/wedding';

const WeddingStage = dynamic(() => import('./WeddingScene'), { ssr: false });

interface Person {
  pid: string;
  userId: string;
  name: string;
  role: Role;
}

const DEF_VOW_G = 'أعدك بالضحك على نكتك حتى لو كانت مكرّرة.';
const DEF_VOW_B = 'أعدك بالصبر على ساعات البرمجة الطويلة.';
const TITLES = ['دخول العروسين', 'كلمة المأذون', 'الإيجاب والقبول', 'الوعود المرحة', 'التوقيع على العقد', 'الإعلان'];

export default function WeddingRoom({ code, me }: { code: string; me: Me }) {
  const role = me.role;
  const id = me.userId;
  const room = useRoom(code, id);
  const { update: roomUpdate, on: roomOn, send: roomSend } = room;
  const joinedAt = useRef(Date.now());
  const stageRef = useRef<StageHandle | null>(null);

  const [name, setName] = useState(me.name);
  const [look, setLook] = useState<Look>(me.look);
  const [vow, setVow] = useState(role === 'groom' ? DEF_VOW_G : role === 'bride' ? DEF_VOW_B : '');
  const [proxy, setProxy] = useState<BrideProxy>({
    name: '',
    look: cloneLook(DEFAULT_LOOKS.bride),
    vow: DEF_VOW_B,
    gates: { a: false, s: false, round: 0 },
  });
  const [cer, setCer] = useState<Ceremony>({ round: 1, step: -1, stepStartedAt: Date.now(), night: true });
  const [myGates, setMyGates] = useState<Gates>({ a: false, s: false, round: 0 });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'me' | 'bride' | 'party'>('me');
  const [panelOpen, setPanelOpen] = useState(false);
  const [myPos, setMyPos] = useState<Pos | undefined>(undefined);
  const [chatOpen, setChatOpen] = useState(false);
  const [sound, setSoundOn] = useState(true);
  const [showCert, setShowCert] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState('');
  const lastReact = useRef(0);

  /* ---- حفظ محلي لمظهر المستخدم ---- */
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('vw_me_' + role) || 'null');
      if (s) {
        if (typeof s.vow === 'string') setVow(s.vow);
        if (s.proxy) setProxy((p) => ({ ...p, name: s.proxy.name ?? p.name, look: s.proxy.look ?? p.look, vow: s.proxy.vow ?? p.vow }));
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [role]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem('vw_me_' + role, JSON.stringify({ vow, proxy: { name: proxy.name, look: proxy.look, vow: proxy.vow } }));
    } catch {
      /* ignore */
    }
  }, [loaded, role, vow, proxy]);

  /* ---- حفظ الاسم والمظهر في قاعدة البيانات (RLS يسمح بهذين الحقلين فقط) ---- */
  useEffect(() => {
    if (!loaded) return;
    const sb = getSupabase();
    if (!sb) return;
    const t = setTimeout(() => {
      void sb.from('participants').update({ display_name: name.trim().slice(0, 24), look }).eq('wedding_id', me.weddingId).eq('user_id', id);
    }, 800);
    return () => clearTimeout(t);
  }, [loaded, name, look, me.weddingId, id]);

  /* ---- بثّ حالتي للغرفة ---- */
  const mine = useMemo<Presence>(
    () => ({
      id,
      role,
      name,
      look,
      vow,
      joinedAt: joinedAt.current,
      ...(role === 'groom' ? { ceremony: cer, gates: myGates, proxy } : {}),
      ...(role === 'bride' ? { gates: myGates } : {}),
      ...(myPos ? { pos: myPos } : {}),
    }),
    [id, role, name, look, vow, cer, myGates, proxy, myPos],
  );
  useEffect(() => {
    if (loaded) roomUpdate(mine);
  }, [loaded, mine, roomUpdate]);

  /* ---- الدور الحقيقي لكل مشارك من قاعدة البيانات؛ نتجاهل الدور القادم عبر Presence ---- */
  const [people, setPeople] = useState<Person[]>([{ pid: me.participantId, userId: id, name: me.name, role }]);
  const roster = useMemo(() => Object.fromEntries(people.map((p) => [p.userId, p.role])) as Record<string, Role>, [people]);
  const loadRoster = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('participants').select('id,user_id,role,display_name').eq('wedding_id', me.weddingId);
    if (data) {
      setPeople(data.map((r) => ({ pid: r.id as string, userId: r.user_id as string, name: (r.display_name as string) ?? '', role: toRole(r.role as string) })));
    }
  }, [me.weddingId]);
  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);
  const unknownKey = room.peers
    .filter((p) => p.id !== id && !roster[p.id])
    .map((p) => p.id)
    .sort()
    .join(',');
  useEffect(() => {
    if (unknownKey) void loadRoster();
  }, [unknownKey, loadRoster]);

  const all = useMemo(
    () => [...room.peers.filter((p) => p.id !== id && roster[p.id]).map((p) => ({ ...p, role: roster[p.id] })), mine],
    [room.peers, id, mine, roster],
  );
  const view = useMemo(() => derive(all), [all]);

  /* ---- قائمة اللاعبين (متصل/غير متصل) وأسماء المرسلين ---- */
  const players = useMemo<HudPlayer[]>(() => {
    const live = new Map(all.map((p) => [p.id, p]));
    const rank = (r: Role) => (r === 'groom' ? 0 : r === 'bride' ? 1 : 2);
    return people
      .map((p) => {
        const l = live.get(p.userId);
        const fallback = p.role === 'groom' ? 'العريس' : p.role === 'bride' ? 'العروس' : 'ضيف';
        return { id: p.userId, name: (l?.name || p.name || fallback).trim(), role: p.role, online: !!l };
      })
      .sort((a, b) => Number(b.online) - Number(a.online) || rank(a.role) - rank(b.role) || a.name.localeCompare(b.name));
  }, [all, people]);
  const names = useMemo(() => {
    const byUser = new Map(players.map((p) => [p.id, p.name]));
    return Object.fromEntries(people.map((p) => [p.pid, byUser.get(p.userId) ?? p.name]));
  }, [players, people]);

  /* ---- الدردشة الدائمة (جدول messages + Realtime) ---- */
  const chat = useChat({ weddingId: me.weddingId, participantId: me.participantId, open: chatOpen });
  const unknownPid = chat.rows.some((r) => !names[r.participant_id]);
  useEffect(() => {
    if (unknownPid) void loadRoster();
  }, [unknownPid, loadRoster]);

  /* ---- الحركة: من أتحكم به، وإرسال موضعي واستقبال مواضع الآخرين (مؤقتة عبر Broadcast) ---- */
  const localId = role === 'guest' ? id : role;
  const onMove = useCallback(
    (x: number, z: number, r: number, m: boolean) => {
      roomSend('pos', { id, x, z, r, m });
      if (!m) setMyPos({ x, z, r });
    },
    [roomSend, id],
  );
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  useEffect(() => {
    roomOn('pos', (pl) => {
      const q = pl as { id: string; x: number; z: number; r: number; m: boolean };
      if (!q || q.id === id || typeof q.x !== 'number' || typeof q.z !== 'number') return;
      const r = rosterRef.current[q.id];
      if (!r) return;
      stageRef.current?.remotePos(r === 'guest' ? q.id : r, q.x, q.z, q.r, !!q.m);
    });
  }, [roomOn, id]);
  const ceremony = view.ceremony;
  const step = ceremony?.step ?? -1;
  const round = ceremony?.round ?? 0;
  const night = ceremony?.night ?? true;
  const elapsed = ceremony ? Math.max(0, now - ceremony.stepStartedAt) : 0;

  /* ---- مؤقّت خفيف + معالجات الأحداث ---- */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setSound(sound), [sound]);
  useEffect(() => {
    roomOn('react', (pl) => {
      const p = pl as { who: string; kind: ReactKind };
      stageRef.current?.react(p.who, p.kind);
    });
  }, [roomOn]);

  /* ---- فتح/إغلاق اللوحة تلقائيًا مع تغيّر المرحلة ---- */
  const prevStep = useRef(step);
  useEffect(() => {
    if (prevStep.current < 0 && step >= 0) setPanelOpen(false);
    if (prevStep.current >= 0 && step < 0) setPanelOpen(true);
    if (step === 6 && prevStep.current !== 6) setShowCert(true);
    prevStep.current = step;
  }, [step]);

  const onStep = useCallback((s: number, late: boolean) => {
    if (late) return;
    if (s === 5) chime();
    else if (s >= 0) ding();
  }, []);

  /* ---- أفعال العريس ---- */
  const isGroom = role === 'groom';
  const startCeremony = () => {
    unlockAudio();
    const r = cer.round + 1;
    setMyGates({ a: false, s: false, round: r });
    setProxy((p) => ({ ...p, gates: { a: false, s: false, round: r } }));
    setShowCert(true);
    setCer({ round: r, step: 0, stepStartedAt: Date.now(), night: cer.night });
  };
  /* حالة الحفل الدائمة في قاعدة البيانات (يغيّرها العريس فقط عبر دالة الخادم) */
  const lastStatus = useRef<WeddingStatus>('lobby');
  useEffect(() => {
    if (!isGroom) return;
    const st: WeddingStatus = step >= 0 && step <= 5 ? 'ceremony' : step === 6 ? 'celebration' : 'lobby';
    if (st === lastStatus.current) return;
    lastStatus.current = st;
    void setWeddingStatus(me.weddingId, st).catch(() => {});
  }, [step, isGroom, me.weddingId]);
  const goStep = (s: number) => setCer((c) => ({ ...c, step: s, stepStartedAt: Date.now() }));
  const toggleNight = () => setCer((c) => ({ ...c, night: !c.night }));

  const mark = (who: 'me' | 'proxy', key: 'a' | 's') => {
    ding();
    if (who === 'me') {
      setMyGates((g) => {
        const base = g.round === round ? g : { a: false, s: false, round };
        return { ...base, [key]: true } as Gates;
      });
    } else {
      setProxy((p) => {
        const base = p.gates.round === round ? p.gates : { a: false, s: false, round };
        return { ...p, gates: { ...base, [key]: true } as Gates };
      });
    }
  };
  const canClickG = isGroom;
  const canClickB = role === 'bride' || (isGroom && !view.brideOnline);
  const clickG = (k: 'a' | 's') => mark('me', k);
  const clickB = (k: 'a' | 's') => mark(role === 'bride' ? 'me' : 'proxy', k);

  const canNext =
    step === 0 ? elapsed >= WALK_MS :
    step === 2 ? view.groom.gates.a && view.bride.gates.a :
    step === 4 ? view.groom.gates.s && view.bride.gates.s : true;

  /* ---- تفاعلات ---- */
  const react = (kind: ReactKind) => {
    const t = Date.now();
    if (t - lastReact.current < 600) return;
    lastReact.current = t;
    unlockAudio();
    roomSend('react', { who: role === 'guest' ? id : role, kind });
  };

  const copy = async (kind: 'guest' | 'bride') => {
    let target = code;
    if (kind === 'bride') {
      try {
        target = (await getWifeCode(me.weddingId)) ?? code;
      } catch {
        target = code;
      }
    }
    const url = `${window.location.origin}/join?code=${target}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind === 'bride' ? 'نُسخ رابط العروس ✓' : 'نُسخ رابط الضيوف ✓');
    } catch {
      window.prompt('انسخ الرابط:', url);
    }
    setTimeout(() => setCopied(''), 2500);
  };

  /* ---- عرض ---- */
  const g = view.groom.name;
  const b = view.bride.name;
  const tabs: [string, string][] =
    role === 'groom' ? [['me', 'العريس'], ['bride', 'العروس'], ['party', 'الحفل']] :
    role === 'bride' ? [['me', 'العروس'], ['party', 'وعدي']] : [['me', 'مظهري']];
  const activeTab = tabs.some((t) => t[0] === tab) ? tab : 'me';
  const inCeremony = step >= 0 && step <= 5;
  const viewShift = panelOpen || inCeremony ? 0.16 : 0;

  if (room.status === 'nokeys') {
    return (
      <div className="center-msg">
        <div>
          <h2>الغرف الحيّة غير مفعّلة بعد</h2>
          <p>
            أضف <code>NEXT_PUBLIC_SUPABASE_URL</code> و <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> في ملف <code>.env.local</code> ثم أعد تشغيل الخادم. الخطوات كاملة في README.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app" onPointerDown={unlockAudio}>
      <WeddingStage
        groom={{ name: `${view.groom.name} 🤵`, look: view.groom.look, pos: view.groom.pos }}
        bride={{ name: `${view.bride.name} 👰`, look: view.bride.look, pos: view.bride.pos }}
        localId={localId}
        onMove={onMove}
        guests={view.guests}
        ceremony={ceremony}
        night={night}
        viewShift={viewShift}
        onStep={onStep}
        handleRef={stageRef}
      />

      <WeddingHUD
        code={code}
        players={players}
        sound={sound}
        onSound={() => setSoundOn((s) => !s)}
        night={night}
        canToggleNight={isGroom}
        onNight={toggleNight}
        chatOpen={chatOpen}
        unread={chat.unread}
        onChat={() => setChatOpen((o) => !o)}
        panelOpen={panelOpen}
        onCustomize={() => setPanelOpen((o) => !o)}
      />
      <WeddingControls show={isGroom && room.status === 'online' && step < 0 && !panelOpen && !chatOpen} onStart={startCeremony} />

      {room.status === 'connecting' && <div className="notice">جارٍ الاتصال بالغرفة…</div>}
      {room.status === 'error' && <div className="notice">تعذّر الاتصال بالغرفة. تحقّق من الإنترنت ومن إعدادات Realtime في Supabase.</div>}
      {room.status === 'online' && !view.hasGroom && !isGroom && <div className="notice">بانتظار وصول العريس…</div>}

      {panelOpen && (
        <aside className="panel">
          <div className="tabs" role="tablist">
            {tabs.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={activeTab === k} className={activeTab === k ? 'on' : ''} onClick={() => setTab(k as 'me' | 'bride' | 'party')}>
                {l}
              </button>
            ))}
          </div>
          <div className="pbody">
            {activeTab === 'me' && (
              <>
                <label className="field">
                  {role === 'guest' ? 'اسمك' : role === 'groom' ? 'اسم العريس' : 'اسم العروس'}
                  <input value={name} maxLength={24} placeholder={role === 'guest' ? 'اكتب اسمك ليظهر فوق شخصيتك' : 'اكتب الاسم'} onChange={(e) => setName(e.target.value)} />
                </label>
                <AvatarCustomizer
                  look={look}
                  onChange={setLook}
                  defaults={role === 'groom' ? DEFAULT_LOOKS.groom : role === 'bride' ? DEFAULT_LOOKS.bride : undefined}
                  allowGender={role === 'guest'}
                />
              </>
            )}
            {activeTab === 'bride' && isGroom && (
              view.brideOnline ? (
                <p className="hint">العروس متصلة الآن وتخصّص مظهرها واسمها بنفسها ✓</p>
              ) : (
                <>
                  <label className="field">
                    اسم العروس
                    <input value={proxy.name} maxLength={24} placeholder="اكتب اسمها هنا" onChange={(e) => setProxy((p) => ({ ...p, name: e.target.value }))} />
                  </label>
                  <AvatarCustomizer look={proxy.look} onChange={(l) => setProxy((p) => ({ ...p, look: l }))} defaults={DEFAULT_LOOKS.bride} />
                  <p className="hint">تستطيع إرسال رابط العروس لتخصّص مظهرها وتوقّع من هاتفها بنفسها.</p>
                </>
              )
            )}
            {activeTab === 'party' && (
              <>
                <label className="field">
                  {isGroom ? 'وعد العريس' : 'وعد العروس'}
                  <textarea rows={2} maxLength={140} value={vow} onChange={(e) => setVow(e.target.value)} />
                </label>
                {isGroom && !view.brideOnline && (
                  <label className="field">
                    وعد العروس (تكتبه أنت إلى أن تنضم)
                    <textarea rows={2} maxLength={140} value={proxy.vow} onChange={(e) => setProxy((p) => ({ ...p, vow: e.target.value }))} />
                  </label>
                )}
                {isGroom && (
                  <>
                    <h3 style={{ margin: '14px 0 7px', fontSize: '.86rem', color: 'var(--muted)' }}>روابط الدعوة</h3>
                    <div className="row">
                      <button className="ghost" onClick={() => copy('guest')}>📋 رابط الضيوف</button>
                      <button className="ghost" onClick={() => copy('bride')}>💍 رابط العروس</button>
                    </div>
                    <p className="hint">رمز الغرفة: <b>{code}</b>. {copied}</p>
                  </>
                )}
              </>
            )}
            <p className="hint">اسحب على المشهد للدوران، وقرّب بإصبعين أو بعجلة الفأرة.</p>
          </div>
          <div className="pfoot">
            {isGroom ? (
              <button className="primary" onClick={startCeremony}>ابدأ الحفل ✨</button>
            ) : (
              <>
                <p className="wait">{view.hasGroom ? 'بانتظار العريس ليبدأ الحفل…' : 'بانتظار وصول العريس…'}</p>
                <button className="ghost" onClick={() => setPanelOpen(false)}>إغلاق</button>
              </>
            )}
          </div>
        </aside>
      )}

      {inCeremony && !panelOpen && (
        <section className="ceremony" aria-live="polite">
          <div className="dots">
            {TITLES.map((_, i) => (
              <i key={i} className={i <= step ? 'done' : ''} />
            ))}
          </div>
          <h2>{TITLES[step]}</h2>
          <div className="cbody">
            {step === 0 && <>الأنوار تلمع والضيوف يصفّقون، و{g} و{b} يمشيان معًا نحو المنصّة.</>}
            {step === 1 && (
              <div className="quote">
                بسم الله الرحمن الرحيم. نجتمع اليوم أمام هؤلاء الضيوف الكرام لنشهد ارتباط <b>{g}</b> و<b>{b}</b> ارتباطًا ودّيًا مليئًا بالضحك والحلويات.
              </div>
            )}
            {step === 2 && (
              <>
                هل يقبل كل منكما الآخر، بكل نكاته وعاداته؟
                <div className="gates">
                  <button className={'gate' + (view.groom.gates.a ? ' ok' : '')} disabled={!canClickG || view.groom.gates.a} onClick={() => clickG('a')}>
                    {view.groom.gates.a ? `✓ قبِل ${g}` : `قبلتُ يا ${g} ✅`}
                  </button>
                  <button className={'gate' + (view.bride.gates.a ? ' ok' : '')} disabled={!canClickB || view.bride.gates.a} onClick={() => clickB('a')}>
                    {view.bride.gates.a ? `✓ قبِلت ${b}` : `قبلتُ يا ${b} ✅`}
                  </button>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div className="quote"><b>{g}:</b> {view.groom.vow || '…'}</div>
                <div className="quote"><b>{b}:</b> {view.bride.vow || '…'}</div>
              </>
            )}
            {step === 4 && (
              <>
                ضعا توقيعكما على العقد الودّي أمام الجميع.
                <div className="gates">
                  <button className={'gate' + (view.groom.gates.s ? ' ok' : '')} disabled={!canClickG || view.groom.gates.s} onClick={() => clickG('s')}>
                    {view.groom.gates.s ? <><span className="sig">{g}</span> ✓</> : `توقيع ${g} ✍️`}
                  </button>
                  <button className={'gate' + (view.bride.gates.s ? ' ok' : '')} disabled={!canClickB || view.bride.gates.s} onClick={() => clickB('s')}>
                    {view.bride.gates.s ? <><span className="sig">{b}</span> ✓</> : `توقيع ${b} ✍️`}
                  </button>
                </div>
              </>
            )}
            {step === 5 && <div className="quote">أُعلنكما زوجين <b>ودّيّين</b>! بالرفاء والبنين، ومبروك للجميع 🎉</div>}
          </div>
          <div className="c-actions">
            {isGroom ? (
              <button className="primary" disabled={!canNext} onClick={() => goStep(step + 1)}>
                {step === 5 ? 'عرض الشهادة 📜' : 'التالي'}
              </button>
            ) : (
              <p className="leader">العريس يقود الحفل، وتستطيع التصفيق والتهنئة من الأزرار.</p>
            )}
          </div>
        </section>
      )}

      {inCeremony && room.status === 'online' && (
        <div className="reacts">
          <button onClick={() => react('clap')} aria-label="تصفيق">👏</button>
          <button onClick={() => react('heart')} aria-label="قلب">❤️</button>
          <button onClick={() => react('cheer')} aria-label="احتفال">🎉</button>
        </div>
      )}

      {room.status === 'online' && !panelOpen && !chatOpen && !inCeremony && <Joystick onChange={(x, y) => stageRef.current?.setInput(x, y)} />}

      {chatOpen && <WeddingChat rows={chat.rows} names={names} myPid={me.participantId} onSend={chat.send} onClose={() => setChatOpen(false)} />}

      {step === 6 && showCert && (
        <Certificate
          g={g}
          b={b}
          count={view.guests.length}
          isGroom={isGroom}
          onAgain={startCeremony}
          onLobby={() => goStep(-1)}
          onClose={() => setShowCert(false)}
        />
      )}
    </div>
  );
}
