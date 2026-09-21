import type { Look } from './types';
import { hash, rng } from './util';
import { cloneLpc, defaultLpc, sanitizeLpc } from './avatar/catalog';
import type { Role } from './types';

/* ---------- خيارات التخصيص ---------- */
export const SKINS = ['#f6d5b8', '#e8b48a', '#c68a5b', '#8d5a3b', '#5a3825'];
export const HAIRC = ['#1a1410', '#4a2f1d', '#8a5a2b', '#c9a24a', '#b53a2a', '#d9d9d9', '#e58fb0', '#2f5fa8'];
export const CLOTHC = ['#ffffff', '#f4e9d3', '#1b2a49', '#111111', '#9b1c1c', '#0f6b5c', '#6a2c91', '#c9a24a', '#e58fb0', '#2f5fa8'];

type Pair = [string, string];
export interface OptSet {
  hs: Pair[];
  out: Pair[];
  acc: Pair[];
}
export const OPT: { male: OptSet; female: OptSet } = {
  male: {
    hs: [['short', 'قصير'], ['curly', 'مجعّد'], ['bald', 'بدون شعر']],
    out: [['suit', 'بدلة'], ['jellaba', 'جلّابة'], ['kaftan', 'قفطان']],
    acc: [['bowtie', 'ببيون'], ['tarbouche', 'طربوش'], ['beard', 'لحية'], ['shades', 'نظارة'], ['flower', 'وردة']],
  },
  female: {
    hs: [['long', 'طويل'], ['bun', 'كعكة'], ['short', 'قصير'], ['hijab', 'حجاب']],
    out: [['gown', 'فستان أميري'], ['mermaid', 'فستان ضيّق'], ['kaftan', 'قفطان']],
    acc: [['veil', 'طرحة'], ['tiara', 'تاج'], ['bouquet', 'باقة'], ['necklace', 'عقد']],
  },
};

export const DEFAULT_LOOKS: { groom: Look; bride: Look } = {
  groom: { female: false, skin: SKINS[1], hair: HAIRC[0], hairStyle: 'short', outfit: 'suit', color: '#1b2a49', acc: { bowtie: true }, lpc: defaultLpc('groom') },
  bride: { female: true, skin: SKINS[1], hair: HAIRC[1], hairStyle: 'long', outfit: 'gown', color: '#ffffff', acc: { veil: true, tiara: true, bouquet: true }, lpc: defaultLpc('bride') },
};

export function cloneLook(l: Look): Look {
  return { ...l, acc: { ...l.acc }, ...(l.lpc ? { lpc: cloneLpc(l.lpc) } : {}) };
}

export function randomLook(female: boolean): Look {
  const o = female ? OPT.female : OPT.male;
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const acc: Record<string, boolean> = {};
  o.acc.forEach((p) => {
    if (Math.random() < 0.4) acc[p[0]] = true;
  });
  return {
    female,
    skin: pick(SKINS),
    hair: pick(HAIRC),
    hairStyle: pick(o.hs)[0],
    outfit: pick(o.out)[0],
    color: pick(CLOTHC),
    acc,
    lpc: defaultLpc(female ? 'guest_female' : 'guest_male'),
  };
}

/** مظهر مبدئي ثابت للضيف بناءً على معرّفه */
export function guestLook(seed: string): Look {
  const r = rng(hash(seed));
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const female = r() < 0.5;
  const o = female ? OPT.female : OPT.male;
  return {
    female,
    skin: pick(SKINS),
    hair: pick(HAIRC),
    hairStyle: pick(o.hs)[0],
    outfit: pick(o.out)[0],
    color: pick(CLOTHC),
    acc: female ? {} : { tarbouche: r() < 0.2, beard: r() < 0.3 },
    lpc: randomizeLpc(defaultLpc(female ? 'guest_female' : 'guest_male'), r),
  };
}


/** يبدّل ألوان مظهر LPC الافتراضي عشوائيًا (ثابت لنفس البذرة) ليختلف الضيوف عن بعضهم */
function randomizeLpc(base: ReturnType<typeof defaultLpc>, r: () => number) {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const out = cloneLpc(base);
  out.skin = pick(SKINS);
  out.col.hair = pick(HAIRC);
  out.col.top = pick(CLOTHC);
  return out;
}

/** يضمن وجود مظهر LPC صالح للدور (للمظاهر القديمة المحفوظة قبل إضافة LPC) */
export function ensureLpc(look: Look, role: Role): Look {
  const kind = role === 'groom' ? 'groom' : role === 'bride' ? 'bride' : look.female ? 'guest_female' : 'guest_male';
  let lpc;
  if (look.lpc) lpc = sanitizeLpc(look.lpc, role);
  else {
    lpc = defaultLpc(kind);
    if (look.skin) lpc.skin = look.skin;
    if (look.hair) lpc.col.hair = look.hair;
    if (look.color) lpc.col.top = look.color;
  }
  return { ...look, lpc };
}
