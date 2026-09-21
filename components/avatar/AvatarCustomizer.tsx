'use client';
import { useEffect, useState } from 'react';
import { lpcAvailability, onLpcChange } from '@/lib/avatar/lpc';
import { CLOTHC, HAIRC, OPT, SKINS, randomLook } from '@/lib/looks';
import type { Look, Role } from '@/lib/types';
import LpcCustomizer from './LpcCustomizer';

interface Props {
  look: Look;
  onChange: (l: Look) => void;
  defaults?: Look;
  /** يسمح للضيف باختيار زيّ رجالي أو نسائي */
  allowGender?: boolean;
  /** دور صاحب المظهر (لتقييد القطع الخاصة بالعروسين) */
  role?: Role;
}

function Swatches({ list, cur, onPick }: { list: string[]; cur: string; onPick: (c: string) => void }) {
  return (
    <div className="row">
      {list.map((c) => (
        <button key={c} type="button" className={'sw' + (c === cur ? ' on' : '')} style={{ background: c }} aria-label={c} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}
function Chips({ list, cur, onPick }: { list: [string, string][]; cur: string; onPick: (v: string) => void }) {
  return (
    <div className="row">
      {list.map(([v, l]) => (
        <button key={v} type="button" className={'chip' + (v === cur ? ' on' : '')} onClick={() => onPick(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export default function AvatarCustomizer({ look, onChange, defaults, allowGender, role = 'guest' }: Props) {
  // نظام LPC الكامل يعمل عند توفر الأصول؛ وإلا تبقى الخيارات البسيطة القديمة
  const [avail, setAvail] = useState(lpcAvailability());
  useEffect(() => {
    setAvail(lpcAvailability());
    return onLpcChange(() => setAvail(lpcAvailability()));
  }, []);
  if (avail === 'yes' && look.lpc) {
    return <LpcCustomizer look={look} onChange={onChange} role={role} allowBody={allowGender} defaults={defaults} />;
  }
  return <SimpleCustomizer look={look} onChange={onChange} defaults={defaults} allowGender={allowGender} />;
}

function SimpleCustomizer({ look, onChange, defaults, allowGender }: Omit<Props, 'role'>) {
  const o = look.female ? OPT.female : OPT.male;
  const set = (patch: Partial<Look>) => onChange({ ...look, ...patch });
  const toggleAcc = (k: string) => set({ acc: { ...look.acc, [k]: !look.acc[k] } });
  const switchGender = (female: boolean) => {
    const n = female ? OPT.female : OPT.male;
    onChange({ ...look, female, hairStyle: n.hs[0][0], outfit: n.out[0][0], acc: {} });
  };

  return (
    <>
      {allowGender && (
        <>
          <h3>الزيّ</h3>
          <Chips
            list={[['m', 'رجالي'], ['f', 'نسائي']]}
            cur={look.female ? 'f' : 'm'}
            onPick={(v) => switchGender(v === 'f')}
          />
        </>
      )}
      <h3>لون البشرة</h3>
      <Swatches list={SKINS} cur={look.skin} onPick={(c) => set({ skin: c })} />
      <h3>الشعر</h3>
      <Chips list={o.hs} cur={look.hairStyle} onPick={(v) => set({ hairStyle: v })} />
      <h3>{look.female ? 'لون الشعر أو الحجاب' : 'لون الشعر'}</h3>
      <Swatches list={HAIRC} cur={look.hair} onPick={(c) => set({ hair: c })} />
      <h3>اللباس</h3>
      <Chips list={o.out} cur={look.outfit} onPick={(v) => set({ outfit: v })} />
      <h3>لون اللباس</h3>
      <Swatches list={CLOTHC} cur={look.color} onPick={(c) => set({ color: c })} />
      <h3>إكسسوارات</h3>
      <div className="row">
        {o.acc.map(([k, l]) => (
          <button key={k} type="button" className={'chip' + (look.acc[k] ? ' on' : '')} onClick={() => toggleAcc(k)}>
            {l}
          </button>
        ))}
      </div>
      <h3>&nbsp;</h3>
      <div className="row">
        <button type="button" className="ghost" onClick={() => onChange(randomLook(look.female))}>
          🎲 مظهر عشوائي
        </button>
        {defaults && (
          <button type="button" className="ghost" onClick={() => onChange({ ...defaults, acc: { ...defaults.acc } })}>
            ↩︎ الأصلي
          </button>
        )}
      </div>
    </>
  );
}
