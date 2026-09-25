export type MusicCategory = 'ceremony' | 'first-dance' | 'party' | 'special';

export interface WeddingTrack {
  id: string;
  title: string;
  /** مسار داخل public/music/... — الملف الفعلي غير موجود حتى تضيفه بنفسك */
  url: string;
  category: MusicCategory;
}

/**
 * كتالوج تجريبي (metadata فقط، بدون ملفات صوت حقيقية).
 * أضف ملفاتك المرخّصة (mp3/ogg) داخل public/music/<category>/ بهذه الأسماء،
 * أو عدّل url لتطابق أسماء ملفاتك.
 */
export const WEDDING_TRACKS: WeddingTrack[] = [
  { id: 'ceremony-01', title: 'دخول العروسين', url: '/music/ceremony/entrance.mp3', category: 'ceremony' },
  { id: 'ceremony-02', title: 'خلفية العقد', url: '/music/ceremony/vows.mp3', category: 'ceremony' },
  { id: 'first-dance-01', title: 'الرقصة الأولى', url: '/music/first-dance/first-dance.mp3', category: 'first-dance' },
  { id: 'party-01', title: 'سهرة 1', url: '/music/party/party-01.mp3', category: 'party' },
  { id: 'party-02', title: 'سهرة 2', url: '/music/party/party-02.mp3', category: 'party' },
  { id: 'party-03', title: 'سهرة 3', url: '/music/party/party-03.mp3', category: 'party' },
  { id: 'special-01', title: 'قطع الكعكة', url: '/music/special/cake-cutting.mp3', category: 'special' },
];

export function trackById(id: string | null): WeddingTrack | null {
  if (!id) return null;
  return WEDDING_TRACKS.find((t) => t.id === id) ?? null;
}

export function tracksByCategory(cat: MusicCategory): WeddingTrack[] {
  return WEDDING_TRACKS.filter((t) => t.category === cat);
}

/** أول مقطع في تصنيف معيّن، تُستخدم كافتراض عند دخول مرحلة حفل جديدة */
export function firstTrackOf(cat: MusicCategory): WeddingTrack | null {
  return tracksByCategory(cat)[0] ?? null;
}
