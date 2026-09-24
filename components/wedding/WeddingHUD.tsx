'use client';
import { useState } from 'react';
import type { Role } from '@/lib/types';

export interface HudPlayer {
  id: string;
  name: string;
  role: Role;
  online: boolean;
}

interface Props {
  code: string;
  players: HudPlayer[];
  myId?: string;
  sound: boolean;
  onSound: () => void;
  night: boolean;
  canToggleNight: boolean;
  onNight: () => void;
  chatOpen: boolean;
  unread: number;
  onChat: () => void;
  panelOpen: boolean;
  onCustomize: () => void;
  overview: boolean;
  onOverview: () => void;
}

const BADGE: Record<Role, string> = { groom: '🤵', bride: '👰', guest: '' };

/** واجهة اللعبة العائمة: أزرار مستديرة شفافة داكنة بحدود ذهبية، تترك العالم ظاهرًا */
export default function WeddingHUD(p: Props) {
  const [list, setList] = useState(false);
  const online = p.players.filter((x) => x.online).length;
  const groom = p.players.find((x) => x.role === 'groom');
  const bride = p.players.find((x) => x.role === 'bride');

  return (
    <div className="hud" dir="ltr">
      <div className="hud-side">
        <button className={'hud-btn' + (p.panelOpen ? ' on' : '')} onClick={p.onCustomize} aria-label="المظهر والإعدادات">
          🎨
        </button>
        <button className={'hud-btn' + (p.chatOpen ? ' on' : '')} onClick={p.onChat} aria-label="الدردشة">
          💬
          {p.unread > 0 && <span className="hud-badge">{p.unread > 9 ? '9+' : p.unread}</span>}
        </button>
        <button className="hud-btn" disabled title="المحادثة الصوتية قريبًا" aria-label="المحادثة الصوتية (قريبًا)">
          🎤
        </button>
      </div>

      <button className="hud-pill" onClick={() => setList((o) => !o)} aria-expanded={list} aria-label="اللاعبون">
        <b>{p.code}</b>
        <span className="hud-couple" aria-hidden="true">
          <em className={groom?.online ? 'on' : ''}>🤵</em>
          <em className={bride?.online ? 'on' : ''}>👰</em>
        </span>
        <span>{online} 👥</span>
      </button>

      <div className="hud-side hud-end">
        <button className={'hud-btn' + (p.overview ? ' on' : '')} onClick={p.onOverview} aria-label="عرض الخريطة كاملة" aria-pressed={p.overview}>
          🗺️
        </button>
        {p.canToggleNight && (
          <button className="hud-btn" onClick={p.onNight} aria-label="تبديل الليل والنهار">
            {p.night ? '🌙' : '☀️'}
          </button>
        )}
        <button className="hud-btn" onClick={p.onSound} aria-label="الصوت">
          {p.sound ? '🔊' : '🔇'}
        </button>
      </div>

      {list && (
        <>
          <div className="hud-backdrop" onClick={() => setList(false)} />
          <div className="hud-list" dir="rtl" role="list">
            {p.players.map((x) => (
              <div key={x.id} className={'hud-row' + (x.online ? '' : ' off') + (x.id === p.myId ? ' me' : '')} role="listitem">
                <i className={'dot' + (x.online ? ' on' : '')} aria-label={x.online ? 'متصل' : 'غير متصل'} />
                <span dir="auto">{x.name}</span>
                {x.id === p.myId && <em className="you">أنت</em>}
                {BADGE[x.role] && <em>{BADGE[x.role]}</em>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
