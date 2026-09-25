import { WEDDING_TRACKS, trackById, type WeddingTrack } from './tracks';

export interface MusicManagerSnapshot {
  track: WeddingTrack | null;
  playing: boolean;
  loading: boolean;
  volume: number;
  position: number;
  duration: number;
  /** صار خطأ في التشغيل (ملف مفقود مثلًا) */
  errored: boolean;
  /** المتصفح يحتاج تفاعل المستخدم قبل تشغيل الصوت */
  needsUserGesture: boolean;
}

type Listener = (s: MusicManagerSnapshot) => void;

/**
 * مدير تشغيل واحد لكل صفحة: عنصر <audio> واحد فقط، لا يُعاد إنشاؤه مع كل
 * تصيير React. المكوّنات تشترك في التغييرات عبر subscribe/unsubscribe.
 */
class MusicManager {
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<Listener>();
  private state: MusicManagerSnapshot = {
    track: null,
    playing: false,
    loading: false,
    volume: 0.7,
    position: 0,
    duration: 0,
    errored: false,
    needsUserGesture: false,
  };
  private posTimer: ReturnType<typeof setInterval> | null = null;

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.audio) {
      const el = new Audio();
      el.preload = 'auto';
      el.volume = this.state.volume;
      el.addEventListener('loadstart', () => this.patch({ loading: true, errored: false }));
      el.addEventListener('canplay', () => this.patch({ loading: false }));
      el.addEventListener('error', () => this.patch({ loading: false, errored: true, playing: false }));
      el.addEventListener('ended', () => this.next());
      el.addEventListener('durationchange', () => this.patch({ duration: el.duration || 0 }));
      this.audio = el;
      this.posTimer = setInterval(() => {
        if (!this.audio) return;
        this.patch({ position: this.audio.currentTime || 0 });
      }, 500);
    }
    return this.audio;
  }

  private patch(partial: Partial<MusicManagerSnapshot>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.state));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  getSnapshot(): MusicManagerSnapshot {
    return this.state;
  }

  setVolume(v: number) {
    const vol = Math.max(0, Math.min(1, v));
    const el = this.ensureAudio();
    if (el) el.volume = vol;
    this.patch({ volume: vol });
  }

  /** يحمّل مقطعًا جديدًا ويشغّله من موضع معيّن (بالثواني) */
  private loadTrack(track: WeddingTrack, atSeconds: number, autoplay: boolean) {
    const el = this.ensureAudio();
    if (!el) return;
    if (el.src !== window.location.origin + track.url && !el.src.endsWith(track.url)) {
      el.src = track.url;
    }
    this.patch({ track, position: atSeconds, errored: false });
    try {
      el.currentTime = atSeconds;
    } catch {
      /* قد يفشل قبل اكتمال التحميل، سنعيد الضبط عند canplay إذا لزم */
    }
    if (autoplay) void this.play();
    else this.patch({ playing: false });
  }

  async play(): Promise<void> {
    const el = this.ensureAudio();
    if (!el) return;
    if (!el.src && this.state.track) el.src = this.state.track.url;
    if (!el.src) return;
    try {
      await el.play();
      this.patch({ playing: true, needsUserGesture: false });
    } catch {
      // سياسات التشغيل التلقائي في المتصفح تمنع التشغيل قبل تفاعل المستخدم
      this.patch({ playing: false, needsUserGesture: true });
    }
  }

  pause() {
    this.audio?.pause();
    this.patch({ playing: false });
  }

  seekTo(seconds: number) {
    if (this.audio) {
      try {
        this.audio.currentTime = seconds;
      } catch {
        /* ignore */
      }
    }
    this.patch({ position: seconds });
  }

  next() {
    const list = WEDDING_TRACKS;
    const cur = this.state.track;
    const i = cur ? list.findIndex((t) => t.id === cur.id) : -1;
    const nextTrack = list[(i + 1 + list.length) % list.length];
    if (nextTrack) this.loadTrack(nextTrack, 0, this.state.playing);
  }

  prev() {
    const list = WEDDING_TRACKS;
    const cur = this.state.track;
    const i = cur ? list.findIndex((t) => t.id === cur.id) : 0;
    const prevTrack = list[(i - 1 + list.length) % list.length];
    if (prevTrack) this.loadTrack(prevTrack, 0, this.state.playing);
  }

  /** تُستخدم من طبقة المزامنة: طبّق حالة موسيقى مشتركة قادمة من الشبكة */
  applyRemote(trackId: string | null, playing: boolean, positionSeconds: number) {
    const track = trackById(trackId);
    if (!track) {
      this.pause();
      this.patch({ track: null });
      return;
    }
    const sameTrack = this.state.track?.id === track.id;
    if (!sameTrack) {
      this.loadTrack(track, positionSeconds, playing);
      return;
    }
    // نفس المقطع: صحّح الانحراف الزمني فقط إن كان واضحًا، لا نلمس التشغيل كل نبضة
    const drift = Math.abs((this.audio?.currentTime ?? 0) - positionSeconds);
    if (drift > 1.2) this.seekTo(positionSeconds);
    if (playing && !this.state.playing) void this.play();
    if (!playing && this.state.playing) this.pause();
  }

  dispose() {
    if (this.posTimer) clearInterval(this.posTimer);
    this.posTimer = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.listeners.clear();
  }
}

/** نسخة واحدة لكل تبويب متصفح — لا تُنشئ MusicManager آخر */
export const musicManager = typeof window !== 'undefined' ? new MusicManager() : (null as unknown as MusicManager);
