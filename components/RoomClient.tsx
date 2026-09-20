'use client';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LookPanel from './LookPanel';
import type { StageHandle } from './Stage';
import { DEFAULT_LOOKS, cloneLook, guestLook } from '@/lib/characters';
import { derive } from '@/lib/derive';
import { WALK_MS, type ReactKind } from '@/lib/scene';
import { chime, ding, setSound, unlockAudio } from '@/lib/sound';
import type { BrideProxy, ChatMsg, Ceremony, Gates, Look, Presence, Role } from '@/lib/types';
import { useRoom } from '@/lib/useRoom';
import { clientId, makeCode } from '@/lib/util';

const Stage = dynamic(() => import('./Stage'), { ssr: false });

const DEF_VOW_G = 'أعدك بالضحك على نكتك حتى لو كانت مكرّرة.';
const DEF_VOW_B = 'أعدك بالصبر على ساعات البرمجة الطويلة.';
const TITLES = ['دخول العروسين', 'كلمة المأذون', 'الإيجاب والقبول', 'الوعود المرحة', 'التوقيع على العقد', 'الإعلان'];

export default function RoomClient({ code }: { code: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="app" />;
  return <Room code={code} />;
}

function Room({ code }: { code: string }) {
  const sp = useSearchParams();
  const as = sp.get('as');
  const role: Role = as === 'groom' ? 'groom' : as === 'bride' ? 'bride' : 'guest';
  const id = useMemo(() => clientId(), []);
  const room = useRoom(code, id);
  const { update: roomUpdate, on: roomOn, send: roomSend } = room;
  const joinedAt = useRef(Date.now());
  const stageRef = useRef<StageHandle | null>(null);

  const [name, setName] = useState('');
  const [look, setLook] = useState<Look>(() =>
    role === 'groom' ? cloneLook(DEFAULT_LOOKS.groom) : role === 'bride' ? cloneLook(DEFAULT_LOOKS.bride) : guestLook(id),
  );
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
  const [panelOpen, setPanelOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const chatOpenRef = useRef(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);
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
        if (typeof s.name === 'string') setName(s.name);
        if (s.look) setLook(s.look);
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
      localStorage.setItem('vw_me_' + role, JSON.stringify({ name, look, vow, proxy: { name: proxy.name, look: proxy.look, vow: proxy.vow } }));
    } catch {
      /* ignore */
    }
  }, [loaded, role, name, look, vow, proxy]);

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
    }),
    [id, role, name, look, vow, cer, myGates, proxy],
  );
  useEffect(() => {
    if (loaded) roomUpdate(mine);
  }, [loaded, mine, roomUpdate]);

  const all = useMemo(() => [...room.peers.filter((p) => p.id !== id), mine], [room.peers, id, mine]);
  const view = useMemo(() => derive(all), [all]);
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
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnread(0);
  }, [chatOpen]);
  useEffect(() => {
    roomOn('react', (pl) => {
      const p = pl as { who: string; kind: ReactKind };
      stageRef.current?.react(p.who, p.kind);
    });
    roomOn('chat', (pl) => {
      const m = pl as ChatMsg;
      setMsgs((a) => [...a.slice(-39), m]);
      if (!chatOpenRef.current) setUnread((u) => u + 1);
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

  /* ---- تفاعلات ودردشة ---- */
  const myName = name.trim() || (role === 'groom' ? 'العريس' : role === 'bride' ? 'العروس' : 'ضيف');
  const react = (kind: ReactKind) => {
    const t = Date.now();
    if (t - lastReact.current < 600) return;
    lastReact.current = t;
    unlockAudio();
    roomSend('react', { who: role === 'guest' ? id : role, kind });
  };
  const sendChat = (text: string) => roomSend('chat', { id: makeCode(6), name: myName, text: text.slice(0, 160), ts: Date.now() } satisfies ChatMsg);

  const copy = async (kind: 'guest' | 'bride') => {
    const url = `${window.location.origin}/room/${code}${kind === 'bride' ? '?as=bride' : ''}`;
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
      <Stage
        groom={{ name: view.groom.name, look: view.groom.look }}
        bride={{ name: view.bride.name, look: view.bride.look }}
        guests={view.guests}
        ceremony={ceremony}
        night={night}
        viewShift={viewShift}
        onStep={onStep}
        handleRef={stageRef}
      />

      <div className="topbar">
        <div className="pill">
          <span>غرفة</span>
          <b>{code}</b>
          <span>· {view.count} متصل</span>
        </div>
        <div className="tools">
          {isGroom && (
            <button className="btn" onClick={toggleNight} aria-label="تبديل الليل والنهار">
              {night ? '🌙 ليل' : '☀️ نهار'}
            </button>
          )}
          <button className="btn" onClick={() => setSoundOn((s) => !s)} aria-label="الصوت">
            {sound ? '🔊' : '🔇'}
          </button>
          <button className="btn" onClick={() => setChatOpen((o) => !o)} aria-label="الدردشة">
            💬{unread > 0 && <span className="badge">{unread}</span>}
          </button>
          <button className="btn" onClick={() => setPanelOpen((o) => !o)} aria-label="المظهر والإعدادات">
            🎨
          </button>
        </div>
      </div>

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
                <LookPanel
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
                  <LookPanel look={proxy.look} onChange={(l) => setProxy((p) => ({ ...p, look: l }))} defaults={DEFAULT_LOOKS.bride} />
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

      {chatOpen && <Chat msgs={msgs} onSend={sendChat} onClose={() => setChatOpen(false)} />}

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

function Chat({ msgs, onSend, onClose }: { msgs: ChatMsg[]; onSend: (t: string) => void; onClose: () => void }) {
  const [t, setT] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: 1e6 });
  }, [msgs]);
  return (
    <div className="chat" role="log" aria-label="التهاني">
      <div className="list" ref={ref}>
        {msgs.length === 0 && <p style={{ color: 'var(--muted)' }}>اكتب تهنئة لتظهر للجميع 🎊</p>}
        {msgs.map((m) => (
          <p key={m.id}><b>{m.name}:</b> {m.text}</p>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = t.trim();
          if (v) onSend(v);
          setT('');
        }}
      >
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="اكتب تهنئتك" maxLength={160} aria-label="رسالة" />
        <button className="ghost" type="submit">إرسال</button>
        <button className="ghost" type="button" onClick={onClose} aria-label="إغلاق">✕</button>
      </form>
    </div>
  );
}

function Certificate({
  g, b, count, isGroom, onAgain, onLobby, onClose,
}: {
  g: string; b: string; count: number; isGroom: boolean; onAgain: () => void; onLobby: () => void; onClose: () => void;
}) {
  let d: string;
  try {
    d = new Date().toLocaleDateString('ar-MA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    d = new Date().toLocaleDateString();
  }
  return (
    <div className="overlay">
      <div className="cert" role="dialog" aria-label="شهادة الزواج الودّي">
        <small>مكتب التوثيق الودّي</small>
        <h2>شهادة زواج ودّي</h2>
        <small>بتاريخ {d}</small>
        <div className="names">
          <span>{g}</span>
          <br />و<br />
          <span>{b}</span>
        </div>
        <p>تم الزفاف الافتراضي بحضور {count} من الضيوف الأعزاء، وبعد قراءة العقد والتوقيع عليه أمام الجميع.</p>
        <div className="stamp">مصادَق<br />عليه<br />بالضحك</div>
        <p className="warn">وثيقة للتسلية فقط، ولا تغني عن عقد الزواج الرسمي.</p>
        <p><small>التقط لقطة شاشة لتحتفظ بها.</small></p>
        <div className="c-actions">
          {isGroom && <button className="ghost" onClick={onAgain}>🔁 أعد الحفل</button>}
          {isGroom && <button className="ghost" onClick={onLobby}>✏️ عدّل المظهر</button>}
          <button className="ghost" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}
