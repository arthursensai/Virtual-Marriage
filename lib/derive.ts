import type { Ceremony, GuestInfo, Look, Presence, PersonView } from './types';
import { DEFAULT_LOOKS } from './characters';

export interface RoomView {
  ceremony: Ceremony | null;
  hasGroom: boolean;
  brideOnline: boolean;
  groom: PersonView;
  bride: PersonView;
  guests: GuestInfo[];
  count: number;
}

const byJoined = (a: Presence, b: Presence) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id);

function gatesOf(g: { a: boolean; s: boolean; round: number } | undefined, round: number) {
  return g && g.round === round ? { a: g.a, s: g.s } : { a: false, s: false };
}

/** يبني الحالة المشتركة من قائمة المشاركين (العريس هو مرجع حالة الحفل) */
export function derive(all: Presence[]): RoomView {
  const groomP = all.filter((p) => p.role === 'groom').sort(byJoined)[0];
  const brideP = all.filter((p) => p.role === 'bride').sort(byJoined)[0];
  const guestsP = all.filter((p) => p.role === 'guest').sort(byJoined);
  const ceremony = groomP?.ceremony ?? null;
  const round = ceremony?.round ?? 0;

  const groom: PersonView = groomP
    ? { name: groomP.name || 'العريس', look: groomP.look, vow: groomP.vow ?? '', gates: gatesOf(groomP.gates, round), pos: groomP.pos }
    : { name: 'العريس', look: DEFAULT_LOOKS.groom as Look, vow: '', gates: { a: false, s: false } };

  let bride: PersonView;
  if (brideP) {
    bride = { name: brideP.name || 'العروس', look: brideP.look, vow: brideP.vow ?? '', gates: gatesOf(brideP.gates, round), pos: brideP.pos };
  } else if (groomP?.proxy) {
    const px = groomP.proxy;
    bride = { name: px.name || 'العروس', look: px.look, vow: px.vow, gates: gatesOf(px.gates, round) };
  } else {
    bride = { name: 'العروس', look: DEFAULT_LOOKS.bride as Look, vow: '', gates: { a: false, s: false } };
  }

  return {
    ceremony,
    hasGroom: !!groomP,
    brideOnline: !!brideP,
    groom,
    bride,
    guests: guestsP.map((p) => ({ id: p.id, name: p.name || 'ضيف', look: p.look, pos: p.pos })),
    count: all.length,
  };
}
