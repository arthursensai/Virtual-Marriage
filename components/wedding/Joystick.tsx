'use client';
import { useRef, useState } from 'react';

const R = 44; // نصف قطر المسار بالبكسل

/** عصا تحكم باللمس: تُخرج (x, y) بين -1 و1، حيث y موجب = للأمام (أعلى الشاشة) */
export default function Joystick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const [k, setK] = useState({ x: 0, y: 0 });

  const set = (clientX: number, clientY: number) => {
    const b = base.current?.getBoundingClientRect();
    if (!b) return;
    let dx = clientX - (b.left + b.width / 2);
    let dy = clientY - (b.top + b.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setK({ x: dx, y: dy });
    onChange(dx / R, -dy / R);
  };
  const end = () => {
    active.current = null;
    setK({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      className="joy"
      ref={base}
      role="group"
      aria-label="عصا الحركة"
      onPointerDown={(e) => {
        if (active.current !== null) return;
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        set(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) set(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (active.current === e.pointerId) end();
      }}
      onPointerCancel={(e) => {
        if (active.current === e.pointerId) end();
      }}
    >
      <div className="joy-knob" style={{ transform: `translate(${k.x}px, ${k.y}px)` }} />
    </div>
  );
}
