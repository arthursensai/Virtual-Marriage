'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG, EYE_HEX, EYE_LABEL, ITEM_BY_ID, cloneLpc, defaultLpc, itemsOf, procOf, sanitizeLpc, type CatItem } from '@/lib/avatar/catalog';
import { getLpcFrame, onLpcChange, type Dir } from '@/lib/avatar/lpc';
import type { LpcLook } from '@/lib/avatar/types';
import { HAIRC, OPT } from '@/lib/looks';
import type { Look, Role } from '@/lib/types';

interface Props {
  look: Look;
  onChange: (l: Look) => void;
  role: Role;
  /** الضيف فقط يختار الجسم (ذكر/أنثى) */
  allowBody?: boolean;
  defaults?: Look;
}

const TABS: { id: string; label: string; cats: string[] }[] = [
  { id: 'face', label: '🙂 الوجه', cats: ['brows'] },
  { id: 'hair', label: '💇 الشعر', cats: ['hair'] },
  { id: 'outfit', label: '👗 اللباس', cats: ['outfit'] },
  { id: 'shoes', label: '👟 الأحذية', cats: ['shoes'] },
  { id: 'acc', label: '✨ إكسسوارات', cats: ['hat', 'neck', 'glasses', 'earrings', 'necklace', 'beard', 'mustache'] },
];
const HEAD_CATS = new Set(['hair', 'hat', 'glasses', 'beard', 'mustache', 'earrings', 'brows']);

/** يعيد رسم عنصر canvas كلما جهزت صور جديدة */
function useLpcTick() {
  const [, setN] = useState(0);
  useEffect(() => onLpcChange(() => setN((n) => n + 1)), []);
}

function Frame({ lpc, dir = 'down', size = 64, crop, scale = 1 }: { lpc: LpcLook; dir?: Dir; size?: number; crop?: boolean; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLpcTick();
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, cv.width, cv.height);
    const f = getLpcFrame(lpc, dir, false, 0);
    if (!f) return;
    if (crop) g.drawImage(f, 14, 4, 36, 36, 0, 0, cv.width, cv.height);
    else g.drawImage(f, 0, 0, 64, 64, 0, 0, cv.width, cv.height);
  });
  return <canvas ref={ref} width={size} height={size} style={{ width: size * scale, height: size * scale, imageRendering: 'pixelated' }} />;
}

function Swatches({ list, cur, onPick, label }: { list: string[]; cur?: string; onPick: (c: string) => void; label?: string }) {
  return (
    <>
      {label && <h3>{label}</h3>}
      <div className="row">
        {list.map((c) => (
          <button key={c} type="button" className={'sw' + (c.toLowerCase() === (cur ?? '').toLowerCase() ? ' on' : '')} style={{ background: c }} aria-label={c} onClick={() => onPick(c)} />
        ))}
      </div>
    </>
  );
}

export default function LpcCustomizer({ look, onChange, role, allowBody, defaults }: Props) {
  const lpc = look.lpc!;
  const [tab, setTab] = useState('hair');
  const [dir, setDir] = useState<Dir>('down');
  const cats = CATALOG.categories;

  /** يحفظ مظهر LPC ويعكس الألوان الأساسية على الحقول القديمة (لاحتياط الرسم البكسلي) */
  const commit = (next: LpcLook, extra: Partial<Look> = {}) => {
    const clean = sanitizeLpc(next, role);
    onChange({ ...look, ...extra, lpc: clean, skin: clean.skin, hair: clean.col.hair ?? look.hair, color: clean.col.top ?? look.color, female: clean.body === 'female' });
  };
  const setSel = (cat: string, id: string | null) => {
    const n = cloneLpc(lpc);
    if (id) n.sel[cat] = id;
    else delete n.sel[cat];
    commit(n);
  };
  const setCol = (slot: string, hex: string) => {
    const n = cloneLpc(lpc);
    n.col[slot] = hex;
    // القطعة العلوية والسفلية في الفستان تشترك في لون واحد
    commit(n);
  };
  const switchBody = (b: 'male' | 'female') => {
    if (b === lpc.body) return;
    const n = defaultLpc(b === 'female' ? 'guest_female' : 'guest_male');
    n.skin = lpc.skin;
    n.eyes = lpc.eyes;
    if (lpc.col.hair) n.col.hair = lpc.col.hair;
    const o = b === 'female' ? OPT.female : OPT.male;
    commit(n, { hairStyle: o.hs[0][0], outfit: o.out[0][0], acc: {} });
  };

  const tabDef = TABS.find((t) => t.id === tab)!;
  const procs = procOf(lpc.body, role);

  const renderCat = (catId: string) => {
    const cat = cats.find((c) => c.id === catId)!;
    const items = itemsOf(catId, lpc.body, role);
    if (!items.length) return null;
    const cur = lpc.sel[catId] ? ITEM_BY_ID[lpc.sel[catId]] : undefined;
    const optional = catId !== 'outfit';
    return (
      <div key={catId}>
        <h3>{cat.label}</h3>
        <div className="item-grid">
          {optional && (
            <button type="button" className={'item' + (!cur ? ' on' : '')} onClick={() => setSel(catId, null)}>
              <span className="none">∅</span>
              <small>بدون</small>
            </button>
          )}
          {items.map((it) => (
            <ItemBtn key={it.id} it={it} lpc={lpc} on={cur?.id === it.id} onPick={() => setSel(catId, it.id)} />
          ))}
        </div>
        {cur && catId !== 'hair' && <ItemColors it={cur} lpc={lpc} onCol={setCol} />}
      </div>
    );
  };

  const hairItem = lpc.sel.hair ? ITEM_BY_ID[lpc.sel.hair] : undefined;
  void hairItem;

  return (
    <>
      <div className="lpc-prev">
        <button type="button" className="lpc-turn" onClick={() => setDir((d) => (d === 'down' ? 'right' : d === 'right' ? 'up' : d === 'up' ? 'left' : 'down'))} aria-label="تدوير الشخصية">
          <Frame lpc={lpc} dir={dir} size={64} scale={3} />
        </button>
        <small>اضغط على الشخصية لتدويرها</small>
      </div>

      {allowBody && (
        <>
          <h3>الشخصية</h3>
          <div className="row">
            <button type="button" className={'chip' + (lpc.body === 'male' ? ' on' : '')} onClick={() => switchBody('male')}>رجل</button>
            <button type="button" className={'chip' + (lpc.body === 'female' ? ' on' : '')} onClick={() => switchBody('female')}>امرأة</button>
          </div>
        </>
      )}

      <div className="tabs2" role="tablist">
        {TABS.concat(procs.length ? [{ id: 'special', label: '💍 الزفاف', cats: [] }] : []).map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={'chip' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'face' && (
        <>
          <Swatches label="لون البشرة" list={CATALOG.palettes.skin} cur={lpc.skin} onPick={(c) => commit({ ...cloneLpc(lpc), skin: c })} />
          <h3>لون العينين</h3>
          <div className="row">
            {Object.keys(CATALOG.eyes.files[lpc.body] ?? {}).map((k) => (
              <button key={k} type="button" className={'chip' + (lpc.eyes === k ? ' on' : '')} onClick={() => commit({ ...cloneLpc(lpc), eyes: k })}>
                <i className="dot" style={{ background: EYE_HEX[k] ?? '#888' }} /> {EYE_LABEL[k] ?? k}
              </button>
            ))}
          </div>
          {tabDef.cats.map(renderCat)}
        </>
      )}

      {tab === 'hair' && (
        <>
          {renderCat('hair')}
          <Swatches label="لون الشعر" list={CATALOG.palettes.hair} cur={lpc.col.hair} onPick={(c) => setCol('hair', c)} />
          <p className="hint">لون الشعر يطبَّق أيضًا على الحواجب واللحية والشارب.</p>
        </>
      )}

      {tab !== 'face' && tab !== 'hair' && tab !== 'special' && tabDef.cats.map(renderCat)}

      {tab === 'special' && (
        <>
          <h3>خاص بالحفل</h3>
          <div className="row">
            {procs.map((p) => (
              <button
                key={p.id}
                type="button"
                className={'chip' + (lpc.proc[p.id] ? ' on' : '')}
                onClick={() => {
                  const n = cloneLpc(lpc);
                  n.proc[p.id] = !n.proc[p.id];
                  commit(n);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}

      <h3>&nbsp;</h3>
      <div className="row">
        <button type="button" className="ghost" onClick={() => randomize(lpc, role, commit)}>
          🎲 مظهر عشوائي
        </button>
        {defaults?.lpc && (
          <button type="button" className="ghost" onClick={() => commit(cloneLpc(defaults.lpc!))}>
            ↩︎ الأصلي
          </button>
        )}
      </div>
    </>
  );
}

function ItemBtn({ it, lpc, on, onPick }: { it: CatItem; lpc: LpcLook; on: boolean; onPick: () => void }) {
  // صورة مصغّرة: المظهر الحالي مع هذا الصنف
  const preview = useMemo(() => {
    const n = cloneLpc(lpc);
    n.sel[it.cat] = it.id;
    return n;
  }, [lpc, it]);
  return (
    <button type="button" className={'item' + (on ? ' on' : '')} onClick={onPick}>
      <Frame lpc={preview} size={HEAD_CATS.has(it.cat) ? 36 : 64} crop={HEAD_CATS.has(it.cat)} scale={HEAD_CATS.has(it.cat) ? 1.5 : 0.9} />
      <small>{it.label}</small>
    </button>
  );
}

function ItemColors({ it, lpc, onCol }: { it: CatItem; lpc: LpcLook; onCol: (slot: string, hex: string) => void }) {
  return (
    <>
      {it.slots.map((slot) => {
        const def = CATALOG.slots[slot];
        if (!def) return null;
        return <Swatches key={slot} label={def.label} list={CATALOG.palettes[def.palette]} cur={lpc.col[slot]} onPick={(c) => onCol(slot, c)} />;
      })}
    </>
  );
}

function randomize(lpc: LpcLook, role: Role, commit: (l: LpcLook) => void) {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const n = cloneLpc(lpc);
  n.skin = pick(CATALOG.palettes.skin);
  n.eyes = pick(Object.keys(CATALOG.eyes.files[n.body] ?? { brown: 1 }));
  n.col.hair = pick(HAIRC);
  for (const cat of ['hair', 'outfit', 'shoes']) {
    const items: CatItem[] = itemsOf(cat, n.body, role);
    if (items.length) n.sel[cat] = pick<CatItem>(items).id;
  }
  const outfit = ITEM_BY_ID[n.sel.outfit];
  (outfit?.slots ?? []).forEach((s) => {
    const def = CATALOG.slots[s];
    if (def) n.col[s] = pick(CATALOG.palettes[def.palette]);
  });
  n.col.shoes = pick(CATALOG.palettes.shoes);
  commit(n);
}
