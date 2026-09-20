'use client';

export default function Certificate({
  g, b, count, isGroom, onAgain, onLobby, onClose,
}: {
  g: string; b: string; count: number; isGroom: boolean; onAgain: () => void; onLobby: () => void; onClose: () => void;
}) {
  let d: string;
  try {
    d = new Date().toLocaleDateString('ar-MA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    d = new Date().toLocaleDateString();
  }
  return (
    <div className="overlay">
      <div className="cert" role="dialog" aria-label="شهادة الزواج الودّي">
        <small>مكتب التوثيق الودّي</small>
        <h2>شهادة زواج ودّي</h2>
        <small>بتاريخ {d}</small>
        <div className="names">
          <span>{g}</span>
          <br />و<br />
          <span>{b}</span>
        </div>
        <p>تم الزفاف الافتراضي بحضور {count} من الضيوف الأعزاء، وبعد قراءة العقد والتوقيع عليه أمام الجميع.</p>
        <div className="stamp">مصادَق<br />عليه<br />بالضحك</div>
        <p className="warn">وثيقة للتسلية فقط، ولا تغني عن عقد الزواج الرسمي.</p>
        <p><small>التقط لقطة شاشة لتحتفظ بها.</small></p>
        <div className="c-actions">
          {isGroom && <button className="ghost" onClick={onAgain}>🔁 أعد الحفل</button>}
          {isGroom && <button className="ghost" onClick={onLobby}>✏️ عدّل المظهر</button>}
          <button className="ghost" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}
