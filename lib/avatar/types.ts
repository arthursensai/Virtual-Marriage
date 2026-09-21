/** مظهر الشخصية المبني على كتالوج LPC (يُحفظ داخل Look.lpc في participants.look) */
export type LpcBody = 'male' | 'female';

export interface LpcLook {
  body: LpcBody;
  skin: string;
  /** اسم لون العين: blue | brown | gray | green | orange */
  eyes: string;
  /** الفئة ← معرّف الصنف، مثل { hair: 'hair.bob', outfit: 'outfit.f_kimono' } */
  sel: Record<string, string>;
  /** فتحة اللون ← لون hex، مثل { hair: '#4a2f1d', top: '#ffffff' } */
  col: Record<string, string>;
  /** عناصر مرسومة برمجيًا: veil / bouquet / fez */
  proc: Record<string, boolean>;
}
