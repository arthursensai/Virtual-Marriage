import raw from './catalog.json';
import type { LpcBody, LpcLook } from './types';

/** كتالوج الأصناف (مُولَّد بواسطة tools/gen_lpc_catalog.py) */
export interface CatFile {
  walk: string | null;
  idle: string | null;
}
export interface CatLayer {
  z: number;
  recolor: string | null;
  files: Partial<Record<LpcBody, CatFile>>;
}
export interface CatItem {
  id: string;
  cat: string;
  label: string;
  roles: string[] | null;
  bodies: LpcBody[];
  slots: string[];
  hides: string[];
  layers: CatLayer[];
}
export interface ProcItem {
  id: string;
  label: string;
  roles?: string[];
  bodies?: LpcBody[];
  hides?: string[];
}
export interface Catalog {
  base: string;
  frame: number;
  categories: { id: string; label: string; slot: string }[];
  baseLayers: CatLayer[];
  eyes: { z: number; files: Record<string, Record<string, CatFile>> };
  items: CatItem[];
  proc: ProcItem[];
  palettes: Record<string, string[]>;
  slots: Record<string, { label: string; palette: string }>;
  defaults: Record<'groom' | 'bride' | 'guest_male' | 'guest_female', LpcLook>;
}

export const CATALOG = raw as unknown as Catalog;
export const ITEM_BY_ID: Record<string, CatItem> = Object.fromEntries(CATALOG.items.map((i) => [i.id, i]));

export const EYE_HEX: Record<string, string> = { blue: '#4a86d9', brown: '#6b4423', gray: '#8a929c', green: '#3f9c5a', orange: '#d98a2b' };
export const EYE_LABEL: Record<string, string> = { blue: 'أزرق', brown: 'بني', gray: 'رمادي', green: 'أخضر', orange: 'عسلي' };

/** هل يحقّ لهذا الدور استخدام الصنف؟ (allowed_roles) */
export function allowedFor(roles: string[] | null | undefined, role: string): boolean {
  return !roles || roles.includes(role);
}

export function itemsOf(cat: string, body: LpcBody, role: string): CatItem[] {
  return CATALOG.items.filter((i) => i.cat === cat && i.bodies.includes(body) && allowedFor(i.roles, role));
}

export function procOf(body: LpcBody, role: string): ProcItem[] {
  return CATALOG.proc.filter((p) => (!p.bodies || p.bodies.includes(body)) && allowedFor(p.roles, role));
}

export function cloneLpc(l: LpcLook): LpcLook {
  return { ...l, sel: { ...l.sel }, col: { ...l.col }, proc: { ...l.proc } };
}

export function defaultLpc(kind: 'groom' | 'bride' | 'guest_male' | 'guest_female'): LpcLook {
  return cloneLpc(CATALOG.defaults[kind]);
}

/**
 * يُصلح مظهرًا (مثلًا قادمًا من قاعدة البيانات أو من دور آخر): يزيل ما لا يناسب الجسم أو الدور،
 * ويضمن وجود القيم الأساسية.
 */
export function sanitizeLpc(l: LpcLook, role: string): LpcLook {
  const out = cloneLpc(l);
  for (const [cat, id] of Object.entries(out.sel)) {
    const it = ITEM_BY_ID[id];
    if (!it || !it.bodies.includes(out.body) || !allowedFor(it.roles, role)) delete out.sel[cat];
  }
  for (const [k, on] of Object.entries(out.proc)) {
    const p = CATALOG.proc.find((x) => x.id === k);
    if (!on || !p || (p.bodies && !p.bodies.includes(out.body)) || !allowedFor(p.roles, role)) delete out.proc[k];
  }
  if (!out.eyes || !CATALOG.eyes.files[out.body]?.[out.eyes]) out.eyes = 'brown';
  return out;
}
