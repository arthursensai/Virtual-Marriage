'use client';

/** أزرار التحكم العائمة بالحفل (حاليًا: بدء الحفل للعريس). تُوسَّع لاحقًا مع الأحداث. */
export default function WeddingControls({ show, onStart }: { show: boolean; onStart: () => void }) {
  if (!show) return null;
  return (
    <div className="start-wrap">
      <button className="start-btn" onClick={onStart}>
        💍 ابدأ الحفل
      </button>
    </div>
  );
}
