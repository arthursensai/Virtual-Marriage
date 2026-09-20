'use client';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { WeddingScene, type ReactKind } from '@/lib/scene';
import type { Ceremony, GuestInfo, Look } from '@/lib/types';

export interface StageHandle {
  react: (id: string, kind: ReactKind) => void;
}
interface Props {
  groom: { name: string; look: Look };
  bride: { name: string; look: Look };
  guests: GuestInfo[];
  ceremony: Ceremony | null;
  night: boolean;
  viewShift: number;
  onStep: (step: number, late: boolean) => void;
  handleRef: MutableRefObject<StageHandle | null>;
}

export default function Stage(p: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<WeddingScene | null>(null);
  const onStepRef = useRef(p.onStep);
  onStepRef.current = p.onStep;
  const [failed, setFailed] = useState(false);
  const { handleRef } = p;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    let sc: WeddingScene;
    try {
      sc = new WeddingScene(cv, { onStep: (s, l) => onStepRef.current(s, l) });
    } catch {
      setFailed(true);
      return;
    }
    sceneRef.current = sc;
    handleRef.current = { react: (id, k) => sc.react(id, k) };
    const ro = new ResizeObserver(() => sc.resize());
    if (cv.parentElement) ro.observe(cv.parentElement);
    return () => {
      ro.disconnect();
      sc.dispose();
      sceneRef.current = null;
      handleRef.current = null;
    };
  }, [handleRef]);

  const gk = JSON.stringify(p.groom);
  const bk = JSON.stringify(p.bride);
  const gsk = JSON.stringify(p.guests);
  const ck = p.ceremony ? `${p.ceremony.round}:${p.ceremony.step}:${p.ceremony.stepStartedAt}` : 'none';

  useEffect(() => {
    sceneRef.current?.setActor('groom', p.groom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gk]);
  useEffect(() => {
    sceneRef.current?.setActor('bride', p.bride);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bk]);
  useEffect(() => {
    sceneRef.current?.setGuests(p.guests);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gsk]);
  useEffect(() => {
    sceneRef.current?.setCeremony(p.ceremony);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ck]);
  useEffect(() => {
    sceneRef.current?.setNight(p.night);
  }, [p.night]);
  useEffect(() => {
    sceneRef.current?.setViewShift(p.viewShift);
  }, [p.viewShift]);

  if (failed) {
    return (
      <div className="center-msg">
        <div>
          <h2>المتصفح لا يدعم العرض ثلاثي الأبعاد</h2>
          <p>جرّب متصفحًا حديثًا أو فعّل تسريع الرسوميات (WebGL).</p>
        </div>
      </div>
    );
  }
  return (
    <div className="stage">
      <canvas ref={canvasRef} aria-label="مشهد ثلاثي الأبعاد لحفل الزفاف" />
    </div>
  );
}
