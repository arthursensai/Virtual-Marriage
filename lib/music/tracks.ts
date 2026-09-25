export type MusicCategory = 'ceremony' | 'first-dance' | 'party' | 'special';

export interface WeddingTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  category: MusicCategory;
}

export const WEDDING_TRACKS: WeddingTrack[] = [
  // ─────────────────────────────
  // Ceremony
  // ─────────────────────────────
  {
    id: 'ceremony-perfect',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    url: '/music/ceremony/perfect.mp3',
    category: 'ceremony',
  },
  {
    id: 'ceremony-all-of-me',
    title: 'All of Me',
    artist: 'John Legend',
    url: '/music/ceremony/all-of-me.mp3',
    category: 'ceremony',
  },
  {
    id: 'ceremony-a-thousand-years',
    title: 'A Thousand Years',
    artist: 'Christina Perri',
    url: '/music/ceremony/a-thousand-years.mp3',
    category: 'ceremony',
  },

  // ─────────────────────────────
  // First Dance
  // ─────────────────────────────
  {
    id: 'first-dance-thinking-out-loud',
    title: 'Thinking Out Loud',
    artist: 'Ed Sheeran',
    url: '/music/first-dance/thinking-out-loud.mp3',
    category: 'first-dance',
  },
  {
    id: 'first-dance-cant-help-falling-in-love',
    title: "Can't Help Falling in Love",
    artist: 'Elvis Presley',
    url: '/music/first-dance/cant-help-falling-in-love.mp3',
    category: 'first-dance',
  },
  {
    id: 'first-dance-just-the-way-you-are',
    title: 'Just The Way You Are',
    artist: 'Bruno Mars',
    url: '/music/first-dance/just-the-way-you-are.mp3',
    category: 'first-dance',
  },

  // ─────────────────────────────
  // Party
  // ─────────────────────────────
  {
    id: 'party-24k-magic',
    title: '24K Magic',
    artist: 'Bruno Mars',
    url: '/music/party/24k-magic.mp3',
    category: 'party',
  },
  {
    id: 'party-cant-stop-the-feeling',
    title: "Can't Stop the Feeling!",
    artist: 'Justin Timberlake',
    url: '/music/party/cant-stop-the-feeling.mp3',
    category: 'party',
  },
  {
    id: 'party-happy',
    title: 'Happy',
    artist: 'Pharrell Williams',
    url: '/music/party/happy.mp3',
    category: 'party',
  },
  {
    id: 'party-sugar',
    title: 'Sugar',
    artist: 'Maroon 5',
    url: '/music/party/sugar.mp3',
    category: 'party',
  },
  {
    id: 'party-blinding-lights',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    url: '/music/party/blinding-lights.mp3',
    category: 'party',
  },

  // ─────────────────────────────
  // Special
  // ─────────────────────────────
  {
    id: 'special-yellow',
    title: 'Yellow',
    artist: 'Coldplay',
    url: '/music/special/yellow.mp3',
    category: 'special',
  },
  {
    id: 'special-i-lived',
    title: 'I Lived',
    artist: 'OneRepublic',
    url: '/music/special/i-lived.mp3',
    category: 'special',
  },
  {
    id: 'special-im-yours',
    title: "I'm Yours",
    artist: 'Jason Mraz',
    url: '/music/special/im-yours.mp3',
    category: 'special',
  },
];

export function trackById(id: string | null): WeddingTrack | null {
  if (!id) return null;
  return WEDDING_TRACKS.find((t) => t.id === id) ?? null;
}

export function tracksByCategory(cat: MusicCategory): WeddingTrack[] {
  return WEDDING_TRACKS.filter((t) => t.category === cat);
}

export function firstTrackOf(cat: MusicCategory): WeddingTrack | null {
  return tracksByCategory(cat)[0] ?? null;
}
