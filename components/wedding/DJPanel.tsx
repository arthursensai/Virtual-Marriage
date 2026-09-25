'use client';
import { useSyncExternalStore } from 'react';
import { musicManager } from '@/lib/music/musicManager';
import { WEDDING_TRACKS } from '@/lib/music/tracks';
import type { MusicState } from '@/lib/types';

interface Props {
  onClose: () => void;
  canControl: boolean;
  musicState: MusicState;
  onPlayTrack: (id: string) => void;
  onResume: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function DJPanel({ onClose, canControl, musicState, onPlayTrack, onResume, onPause, onNext, onPrev }: Props) {
  const snap = useSyncExternalStore(
    (cb) => (musicManager ? musicManager.subscribe(cb) : () => {}),
    () => (musicManager ? musicManager.getSnapshot() : null),
    () => null,
  );

  const isPlaying = musicState.playing && !!musicState.trackId;
  const currentTitle = snap?.track?.title ?? 'لم يُحدَّد مقطع بعد';

  return (
    <aside className="panel dj-panel">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected className="on">🎧 الدي جي</button>
      </div>
      <div className="pbody">
        <p className="track-name">{currentTitle}</p>

        {snap?.needsUserGesture && (
          <button type="button" className="primary" style={{ marginBottom: 10 }} onClick={() => void musicManager?.play()}>
            🔊 فعّل الصوت
          </button>
        )}
        {snap?.errored && <p className="hint">تعذّر تشغيل هذا المقطع — تأكّد من وجود الملف في public/music.</p>}

        {canControl ? (
          <>
            <div className="dj-controls">
              <button type="button" aria-label="السابق" onClick={onPrev}>⏮</button>
              <button
                type="button"
                aria-label={isPlaying ? 'إيقاف' : 'تشغيل'}
                className="play"
                onClick={() => (isPlaying ? onPause() : musicState.trackId ? onResume() : onPlayTrack(WEDDING_TRACKS[0]?.id ?? ''))}
              >
                {isPlaying ? '⏸' : '▶️'}
              </button>
              <button type="button" aria-label="التالي" onClick={onNext}>⏭</button>
            </div>

            <h3 style={{ margin: '14px 0 7px', fontSize: '.86rem', color: 'var(--muted)' }}>اختر مقطعًا</h3>
            <div className="dj-list">
              {WEDDING_TRACKS.map((t) => (
                <button type="button" key={t.id} className={musicState.trackId === t.id ? 'on' : ''} onClick={() => onPlayTrack(t.id)}>
                  {t.title}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="hint">العريس أو العروس هما من يتحكّمان بالموسيقى، وأنت تستمع معهما 🎶</p>
        )}

        <div className="dj-vol">
          <span aria-hidden>🔈</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={snap?.volume ?? 0.7}
            onChange={(e) => musicManager?.setVolume(Number(e.target.value))}
            aria-label="مستوى الصوت"
          />
          <span aria-hidden>🔊</span>
        </div>
        <p className="hint">مستوى الصوت خاص بك فقط، ولا يؤثّر على غيرك.</p>
      </div>
      <div className="pfoot">
        <button type="button" className="ghost" onClick={onClose}>إغلاق</button>
      </div>
    </aside>
  );
}
