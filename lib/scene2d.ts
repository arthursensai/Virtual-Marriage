'use client';
import type { Look } from './types';
import { clamp, hash } from './util';
import { directionOf } from './pixel/avatar';
import { getAvatarSprite } from './avatar/sprite';
import { BACKSTAGE_MAX_Z, BOUNDS, HU, OBSTACLES_2D, U, WU, X0, Z0, drawStationLabels, renderVenue, type DrawItem, type View } from './pixel/venue';
import { OFFICIANT_LOOK, OFFICIANT_NPC } from './npc/officiant';
// أنواع فقط من ملف three.js (تُحذف عند البناء، فلا يُحمَّل three في نسخة 2D)
import type { ReactKind, SceneActor, SceneCeremony, SceneGuest, SceneOptions } from './scene';

export const WALK_MS = 9500;
export const MAX_GUESTS = 20;
export type { ReactKind, SceneActor, SceneGuest, SceneCeremony, SceneOptions } from './scene';

const SPEED = 3.4;
const PLAYER_R = 0.28;
const SEND_MS = 120;
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

interface Ent {
  x: number;
  z: number;
  tx: number;
  tz: number;
  rot: number;
  trot: number;
  moving: boolean;
  seen: number;
}
interface ActorRec {
  name: string;
  look: Look;
}
interface Reaction {
  clapUntil: number;
  hearts: { x: number; y: number; life: number }[];
}
interface Cam {
  cx: number;
  cz: number;
  S: number;
}

/** لوحة اسم فوق الشخصية: داكنة شبه شفافة، وحواف ذهبية للعروسين */
function nameplate(g: CanvasRenderingContext2D, x: number, y: number, text: string, fontPx: number, gold: boolean) {
  const t = text.length > 18 ? text.slice(0, 17) + '…' : text;
  g.save();
  g.font = `700 ${fontPx}px Tajawal, Tahoma, sans-serif`;
  const w = g.measureText(t).width + fontPx * 1.3;
  const h = fontPx * 1.75;
  g.fillStyle = 'rgba(10,14,30,.78)';
  g.beginPath();
  if (typeof g.roundRect === 'function') g.roundRect(x - w / 2, y - h, w, h, h / 2);
  else g.rect(x - w / 2, y - h, w, h);
  g.fill();
  g.strokeStyle = gold ? '#d8b55a' : 'rgba(255,255,255,.18)';
  g.lineWidth = gold ? 1.5 : 1;
  g.stroke();
  g.fillStyle = gold ? '#ffe9a8' : '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(t, x, y - h / 2 + 1);
  g.restore();
}

export class WeddingScene {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private opts: SceneOptions;
  private dpr = 1;
  private w = 0;
  private h = 0;

  private actors: { groom: ActorRec | null; bride: ActorRec | null } = { groom: null, bride: null };
  private actorKey = { groom: '', bride: '' };
  private guests = new Map<string, { key: string; rec: ActorRec }>();
  private ents = new Map<string, Ent>();
  // Latest remote positions received before an entity has been created.
  private pendingRemote = new Map<string, { x: number; z: number; r: number; moving: boolean }>();
  private localId: string | null = null;
  private input = { x: 0, y: 0 };
  private keys = { u: 0, d: 0, l: 0, r: 0 };
  private lastSend = 0;
  private wasMoving = false;

  private ceremony: SceneCeremony | null = null;
  private consentYes = { groom: false, bride: false };
  private consentAt = { groom: 0, bride: 0 };
  private lastKey = '';
  private night = true;
  private viewShift = 0;

  private cam: Cam = { cx: 0, cz: 4, S: 40 };
  private overview = false;
  private zoomMul: number | null = null;
  private camInit = false;

  private reactions = new Map<string, Reaction>();
  /** ارتفاع لوحة الاسم فوق القدمين (بكسلات CSS) لكل لاعب، يحدَّث أثناء الرسم */
  private tops = new Map<string, number>();
  private officiantTop = 0;
  private confetti: { x: number; y: number; vx: number; vy: number; c: string; life: number }[] = [];

  private raf = 0;
  private lastT = 0;
  private startT = performance.now();
  private cleanup: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, opts: SceneOptions = {}) {
    this.canvas = canvas;
    this.opts = opts;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.bindControls();
    this.resize();
    this.raf = requestAnimationFrame(this.tick);
  }

  /* ---------- الحالة العامة ---------- */
  setNight(n: boolean) {
    this.night = n;
  }
  setOverview(b: boolean) {
    this.overview = b;
    this.zoomMul = null;
  }

  setActor(role: 'groom' | 'bride', a: SceneActor) {
    const key = JSON.stringify([a.look, a.name]);
    if (this.actorKey[role] === key) return;
    this.actorKey[role] = key;
    this.actors[role] = { name: a.name, look: a.look };
    if (!this.ents.has(role)) {
      const sp = a.pos ?? { x: role === 'groom' ? -0.7 : 0.7, z: 16, r: role === 'groom' ? Math.PI / 2 : Math.PI * 1.5 };
      this.ents.set(role, { x: sp.x, z: sp.z, tx: sp.x, tz: sp.z, rot: sp.r, trot: sp.r, moving: false, seen: 0 });
      this.applyPendingRemote(role);
    }
  }

  setGuests(list: SceneGuest[]) {
    const shown = list.slice(0, MAX_GUESTS);
    const ids = new Set(shown.map((g) => g.id));
    for (const id of Array.from(this.guests.keys())) if (!ids.has(id)) this.guests.delete(id);
    shown.forEach((g) => {
      const key = JSON.stringify([g.look, g.name]);
      const cur = this.guests.get(g.id);
      if (cur && cur.key === key) return;
      this.guests.set(g.id, { key, rec: { name: g.name, look: g.look } });
    });
    shown.forEach((g) => {
      if (this.ents.has(g.id)) return;
      const h = hash(g.id);
      const sp = g.pos ?? { x: ((h % 9) - 4) * 0.45, z: 11.6 + ((h >> 4) % 3) * 0.7, r: Math.PI };
      this.ents.set(g.id, { x: sp.x, z: sp.z, tx: sp.x, tz: sp.z, rot: sp.r, trot: sp.r, moving: false, seen: 0 });
      this.applyPendingRemote(g.id);
    });
    const keep = new Set<string>(['groom', 'bride', ...shown.map((g) => g.id)]);
    for (const id of Array.from(this.ents.keys())) if (!keep.has(id)) this.ents.delete(id);
    if (this.localId && !this.ents.has(this.localId)) this.localId = null;
  }

  /* ---------- الحركة ---------- */
  setLocal(id: string | null) {
    this.localId = id;
  }
  setInput(x: number, y: number) {
    this.input.x = x;
    this.input.y = y;
  }
  private applyPendingRemote(id: string) {
    const p = this.pendingRemote.get(id);
    if (!p) return;
    this.pendingRemote.delete(id);
    this.remotePos(id, p.x, p.z, p.r, p.moving);
  }

  remotePos(id: string, x: number, z: number, r: number, moving: boolean) {
    if (id === this.localId) return;
    const e = this.ents.get(id);
    if (!e) {
      // A stop event may be the last event for a movement. Do not discard it
      // just because the corresponding actor has not rendered yet.
      if (this.pendingRemote.size >= 64 && !this.pendingRemote.has(id)) {
        const oldest = this.pendingRemote.keys().next().value;
        if (oldest) this.pendingRemote.delete(oldest);
      }
      this.pendingRemote.set(id, { x, z, r, moving });
      return;
    }
    e.tx = clamp(x, BOUNDS.minX, BOUNDS.maxX);
    e.tz = clamp(z, BOUNDS.minZ, this.maxZFor(id));
    e.trot = r;
    e.moving = moving;
    e.seen = performance.now();
    if (Math.hypot(e.tx - e.x, e.tz - e.z) > 6) {
      e.x = e.tx;
      e.z = e.tz;
    }
  }
  setCeremony(c: SceneCeremony | null) {
    this.ceremony = c;
  }
  setViewShift(f: number) {
    this.viewShift = f;
  }
  /** خطوة "الإيجاب والقبول": من قال نعم ومتى، لتوجيه الكاميرا نحوه */
  setConsent(groomYes: boolean, brideYes: boolean) {
    const now = performance.now();
    if (groomYes && !this.consentYes.groom) this.consentAt.groom = now;
    if (brideYes && !this.consentYes.bride) this.consentAt.bride = now;
    this.consentYes = { groom: groomYes, bride: brideYes };
  }

  react(id: string, kind: ReactKind) {
    const now = performance.now();
    const r = this.reactions.get(id) ?? { clapUntil: 0, hearts: [] };
    if (kind === 'clap' || kind === 'cheer') r.clapUntil = now + 2600;
    if (kind === 'heart' || kind === 'cheer') {
      for (let i = 0; i < 3; i++) r.hearts.push({ x: (Math.random() - 0.5) * 22, y: 0, life: 1 });
    }
    this.reactions.set(id, r);
    if (kind === 'cheer') this.burstConfetti();
  }

  private burstConfetti() {
    const CAP = 240; // يمنع تراكم غير محدود لو صفّق/احتفل كذا ضيف بنفس الوقت
    const room = Math.min(80, Math.max(0, CAP - this.confetti.length));
    if (room === 0) return;
    const pal = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ffffff'];
    for (let i = 0; i < room; i++) {
      this.confetti.push({
        x: this.w / 2 + (Math.random() - 0.5) * this.w * 0.6,
        y: -20,
        vx: (Math.random() - 0.5) * 40,
        vy: 60 + Math.random() * 80,
        c: pal[i % pal.length],
        life: 1,
      });
    }
  }

  resize() {
    const par = this.canvas.parentElement;
    if (!par) return;
    this.w = Math.max(1, par.clientWidth);
    this.h = Math.max(1, par.clientHeight);
    const deviceDpr = window.devicePixelRatio || 1;
    this.dpr = Math.min(deviceDpr, this.w < 768 ? 1.5 : 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
  }

  /* ---------- الكاميرا ---------- */
  /** مقياس "بكسل-آرت صحيح": كل بكسل رسم = عدد صحيح من بكسلات الجهاز، فتبقى الصورة حادّة */
  private baseS() {
    const mCss = this.w >= 1000 ? 3 : 2;
    const pxm = Math.max(1, Math.round(mCss * this.dpr));
    return (U * pxm) / this.dpr;
  }
  private fitS() {
    return Math.min(this.w / 21.6, this.h / 22.2);
  }
  private crisp() {
    return !this.overview && this.zoomMul === null;
  }
  private targetS(step: number) {
    if (this.overview) return this.fitS();
    const base = this.baseS() * (this.zoomMul ?? 1);
    const focus = this.consentFocus(step);
    return focus ? base * focus.zoom : base;
  }

  /** أثناء "الإيجاب والقبول" فقط: مين تركّز عليه الكاميرا الآن، أو null = لقطة الاثنين معًا */
  private consentFocus(step: number): { id: 'groom' | 'bride'; zoom: number } | null {
    if (step !== 2) return null;
    const now = performance.now();
    const CELEBRATE = 1800;
    const gSince = this.consentYes.groom ? now - this.consentAt.groom : Infinity;
    const bSince = this.consentYes.bride ? now - this.consentAt.bride : Infinity;
    if (gSince < CELEBRATE) return { id: 'groom', zoom: 1.35 };
    if (bSince < CELEBRATE) return { id: 'bride', zoom: 1.35 };
    if (this.consentYes.groom && !this.consentYes.bride) return { id: 'bride', zoom: 1.22 };
    if (this.consentYes.bride && !this.consentYes.groom) return { id: 'groom', zoom: 1.22 };
    return null;
  }

  private camGoal(step: number, S: number): { cx: number; cz: number } {
    let cx = 0;
    let cz = 4.5;
    if (this.overview) return { cx: 0, cz: 4.5 };
    if (step === 0) {
      const g = this.ents.get('groom');
      cz = g ? g.z : 4;
    } else if (step === 2) {
      const focus = this.consentFocus(step);
      const e = focus ? this.ents.get(focus.id) : null;
      cx = e ? e.x : 0;
      cz = e ? e.z : -0.3;
    } else if (step >= 1) {
      cz = -0.3;
    } else {
      const me = this.localId ? this.ents.get(this.localId) : null;
      if (me) {
        cx = me.x;
        cz = me.z;
      }
    }
    // لا نخرج بالكاميرا خارج حدود الخريطة
    const vw = this.w / S;
    const vh = this.h / S;
    cx = vw >= WU ? X0 + WU / 2 : clamp(cx, X0 + vw / 2, X0 + WU - vw / 2);
    cz = vh >= HU ? Z0 + HU / 2 : clamp(cz, Z0 + vh / 2, Z0 + HU - vh / 2);
    return { cx, cz };
  }

  /* ---------- التصادم والحركة ---------- */
  private collide(x: number, z: number, maxZ: number) {
    let nx = clamp(x, BOUNDS.minX, BOUNDS.maxX);
    let nz = clamp(z, BOUNDS.minZ, maxZ);
    if (nz > 14.0) nx = clamp(nx, -3.3, 3.3); // داخل سياج الغرفة الخاصة
    for (const o of OBSTACLES_2D) {
      const dx = nx - o.x;
      const dz = nz - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + PLAYER_R;
      if (d < min && d > 1e-4) {
        nx = o.x + (dx / d) * min;
        nz = o.z + (dz / d) * min;
      }
    }
    return { x: nx, z: nz };
  }

  private scripted(id: string) {
    return (id === 'groom' || id === 'bride') && !!this.ceremony && this.ceremony.step >= 0;
  }

  /** العريس والعروسة فقط، وقبل بدء الحفل فقط، يقدرون يدخلون الغرفة الخاصة خلف البوابة */
  private maxZFor(id: string | null) {
    if ((id === 'groom' || id === 'bride') && (!this.ceremony || this.ceremony.step < 0)) return BACKSTAGE_MAX_Z;
    return BOUNDS.maxZ;
  }

  private stepLocal(dt: number, nowP: number) {
    const id = this.localId;
    const e = id ? this.ents.get(id) : null;
    if (!id || !e || this.scripted(id)) {
      this.wasMoving = false;
      return;
    }
    let ix = this.input.x + this.keys.r - this.keys.l;
    let iy = this.input.y + this.keys.u - this.keys.d;
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }
    const moving = len > 0.12;
    if (moving) {
      const vx = ix;
      const vz = -iy;
      const sp = SPEED * Math.min(1, len);
      const c = this.collide(e.x + vx * sp * dt, e.z + vz * sp * dt, this.maxZFor(id));
      e.x = c.x;
      e.z = c.z;
      e.trot = Math.atan2(vx, vz);
    }
    e.moving = moving;
    e.rot += angDiff(e.rot, e.trot) * (1 - Math.pow(0.0005, dt));
    if ((moving && nowP - this.lastSend > SEND_MS) || (!moving && this.wasMoving)) {
      this.lastSend = nowP;
      this.opts.onMove?.(Math.round(e.x * 100) / 100, Math.round(e.z * 100) / 100, Math.round(e.rot * 100) / 100, moving);
    }
    this.wasMoving = moving;
  }

  private updateEnts(dt: number, nowP: number) {
    const k = 1 - Math.pow(0.0008, dt);
    this.ents.forEach((e, id) => {
      if (id === this.localId) return;
      e.x += (e.tx - e.x) * k;
      e.z += (e.tz - e.z) * k;
      e.rot += angDiff(e.rot, e.trot) * k;
      if (e.moving && nowP - e.seen > 450) e.moving = false;
    });
  }

  /* ---------- مراحل الحفل ---------- */
  private enterStep(step: number, el: number) {
    const late = step === 5 ? el > 2500 : step === 0 ? el > 1500 : false;
    if (step === 5 && el < 10000) this.burstConfetti();
    this.opts.onStep?.(step, late);
  }

  private ceremonyPose() {
    const c = this.ceremony;
    const step = c ? c.step : -1;
    const el = c ? Math.max(0, Date.now() - c.stepStartedAt) : 0;
    const key = c ? `${c.round}:${step}:${c.stepStartedAt}` : 'lobby';
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.enterStep(step, el);
    }
    const g = this.ents.get('groom');
    const b = this.ents.get('bride');
    if (!g || !b || step < 0) return step;
    if (step === 0) {
      const tt = clamp(el / WALK_MS, 0, 1);
      g.x = -(0.5 + (0.7 - 0.5) * (1 - tt));
      g.z = 16 + (-0.5 - 16) * tt;
      b.x = 0.5 + (0.7 - 0.5) * (1 - tt);
      b.z = 16 + (-0.5 - 16) * tt;
      if (tt < 1) {
        g.rot = b.rot = Math.PI; // يمشيان للأمام نحو المذبح
      } else {
        g.rot = Math.PI / 2; // وصلا: يتقابلان
        b.rot = Math.PI * 1.5;
      }
      g.moving = b.moving = tt < 1;
      return step;
    }
    const k = step >= 5 ? clamp(step === 5 ? el / 1500 : 1, 0, 1) : 0;
    g.x = -(0.85 - (0.85 - 0.4) * k);
    g.z = -0.5;
    g.rot = Math.PI / 2;
    b.x = 0.85 - (0.85 - 0.4) * k;
    b.z = -0.5;
    b.rot = Math.PI * 1.5;
    g.moving = b.moving = false;
    return step;
  }

  private drawConfetti(dt: number) {
    this.confetti = this.confetti.filter((c) => c.life > 0);
    this.confetti.forEach((c) => {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 40 * dt;
      c.life -= dt * 0.35;
      this.ctx.save();
      this.ctx.globalAlpha = clamp(c.life, 0, 1);
      this.ctx.fillStyle = c.c;
      this.ctx.fillRect(c.x, c.y, 5, 8);
      this.ctx.restore();
    });
  }

  /* ---------- الحلقة الرئيسية ---------- */
  private tick = (nowMs: number) => {
    this.raf = requestAnimationFrame(this.tick);

    // Limit render work to ~30 FPS to reduce load on mobile devices.
    if (this.lastT && nowMs - this.lastT < 1000 / 30) return;

    const dt = Math.min((nowMs - (this.lastT || nowMs)) / 1000, 0.05);
    this.lastT = nowMs;
    const tSec = (nowMs - this.startT) / 1000;

    this.stepLocal(dt, nowMs);
    this.updateEnts(dt, nowMs);
    const step = this.ceremonyPose();

    /* الكاميرا: تتبّع اللاعب / العرض الشامل / لقطات الحفل */
    const S = this.targetS(step);
    const goal = this.camGoal(step, S);
    if (!this.camInit) {
      this.cam = { cx: goal.cx, cz: goal.cz, S };
      this.camInit = true;
    }
    const k = 1 - Math.pow(0.004, dt);
    this.cam.cx += (goal.cx - this.cam.cx) * k;
    this.cam.cz += (goal.cz - this.cam.cz) * k;
    this.cam.S += (S - this.cam.S) * (1 - Math.pow(0.01, dt));
    if (Math.abs(S - this.cam.S) < 0.05) this.cam.S = S;

    const ctx = this.ctx;
    const dpr = this.dpr;
    const Sc = this.cam.S;
    const step2 = 1 / (Sc * dpr);
    const view: View = {
      cx: Math.round(this.cam.cx / step2) * step2,
      cz: Math.round(this.cam.cz / step2) * step2,
      S: Sc,
      w: this.w,
      h: this.h,
      dpr,
      crisp: this.crisp() && Math.abs(Sc - this.baseS()) < 0.01,
      night: this.night,
      t: tSec,
    };
    const kArt = Sc / U;
    const P = (x: number, z: number) => ({ x: this.w / 2 + (x - view.cx) * Sc, y: this.h / 2 + (z - view.cz) * Sc });
    const snap = (n: number) => Math.round(n * dpr) / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    // إزاحة رأسية عند فتح اللوحة السفلية حتى لا تحجب المشهد
    ctx.translate(0, -this.viewShift * this.h * 0.28);

    /* اللاعبون كعناصر مرتّبة بالعمق مع المجسّمات */
    const list: { id: string; rec: ActorRec; gold: boolean }[] = [];
    this.guests.forEach((g, id) => list.push({ id, rec: g.rec, gold: false }));
    if (this.actors.groom) list.push({ id: 'groom', rec: this.actors.groom, gold: true });
    if (this.actors.bride) list.push({ id: 'bride', rec: this.actors.bride, gold: true });
    const shown = list.filter((o) => this.ents.has(o.id));

    const items: DrawItem[] = shown.map((o) => {
      const e = this.ents.get(o.id)!;
      return {
        x: e.x,
        z: e.z,
        draw: (g, sx, sy, kk) => {
          const dir = directionOf(e.rot);
          const sp = getAvatarSprite(o.rec.look, dir, e.moving, tSec);
          // مقياس الشخصية: عدد صحيح من بكسلات الجهاز عند العرض الحاد
          const f = sp.scale;
          const kUse = view.crisp ? Math.max(1, Math.round(kk * dpr * f)) / dpr : kk * f;
          if (!sp.lpc) {
            g.fillStyle = 'rgba(0,0,0,0.26)';
            g.beginPath();
            g.ellipse(sx, sy - kk, 7 * kk, 2.6 * kk, 0, 0, Math.PI * 2);
            g.fill();
          }
          if (o.id === this.localId) {
            g.strokeStyle = '#ffd166';
            g.lineWidth = Math.max(1, kk * 0.9);
            g.beginPath();
            g.ellipse(sx, sy - kk, 10 * kk, 4 * kk, 0, 0, Math.PI * 2);
            g.stroke();
          }
          g.drawImage(sp.cv, snap(sx - sp.ax * kUse), snap(sy - sp.ay * kUse), sp.cv.width * kUse, sp.cv.height * kUse);
          this.tops.set(o.id, sp.top * kUse);
        },
      };
    });
    items.push({
      x: OFFICIANT_NPC.x,
      z: OFFICIANT_NPC.z,
      draw: (g, sx, sy, kk) => {
        const sp = getAvatarSprite(OFFICIANT_LOOK, 'down', false, tSec);
        const f = sp.scale;
        const kUse = view.crisp ? Math.max(1, Math.round(kk * dpr * f)) / dpr : kk * f;
        g.drawImage(sp.cv, snap(sx - sp.ax * kUse), snap(sy - sp.ay * kUse), sp.cv.width * kUse, sp.cv.height * kUse);
        this.officiantTop = sp.top * kUse;
      },
    });
    renderVenue(ctx, view, items);

    /* لافتات المحطات، ثم أسماء اللاعبين والتفاعلات فوق كل شيء */
    const fontPx = clamp(kArt * 6.2, 10, 15);
    drawStationLabels(ctx, view, clamp(kArt * 5.2, 9, 13));
    shown
      .slice()
      .sort((a, b) => this.ents.get(a.id)!.z - this.ents.get(b.id)!.z)
      .forEach((o) => {
        const e = this.ents.get(o.id)!;
        const p = P(e.x, e.z);
        const top = p.y - (this.tops.get(o.id) ?? 32 * kArt);
        nameplate(ctx, p.x, top - 2, o.rec.name, fontPx, o.gold);
        const r = this.reactions.get(o.id);
        if (r) {
          const now = performance.now();
          if (r.clapUntil > now) {
            ctx.font = `${Math.round(fontPx * 1.5)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('👏', p.x, top - fontPx * 2.4);
          }
          r.hearts = r.hearts.filter((hh) => hh.life > 0);
          r.hearts.forEach((hh) => {
            hh.y -= 22 / 60;
            hh.life -= 1 / 90;
            ctx.save();
            ctx.globalAlpha = clamp(hh.life, 0, 1);
            ctx.font = `${Math.round(fontPx * 1.3)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('❤️', p.x + hh.x, top - fontPx * 2 + hh.y);
            ctx.restore();
          });
          if (r.hearts.length === 0 && r.clapUntil < now) this.reactions.delete(o.id);
        }
      });

    if (step === 1) {
      const op = P(OFFICIANT_NPC.x, OFFICIANT_NPC.z);
      const otop = op.y - (this.officiantTop || 32 * kArt);
      this.drawSpeech(ctx, op.x, otop - 4, this.officiantText(), fontPx);
    }

    this.drawConfetti(dt);
    ctx.restore();
  };

  /** نص كلمة المأذون، ثابت لكل الحاضرين (لا يعتمد على من يشاهد) */
  private officiantText() {
    const g = this.actors.groom?.name ?? 'العريس';
    const b = this.actors.bride?.name ?? 'العروسة';
    return `بسم الله، نجتمع اليوم لنشهد على عهدٍ بين ${g} و${b}. عهدٌ يبدأ بالحب، ويُكتب بالثقة، ويدوم بالوفاء. فليكن هذا اليوم بداية قصتكما معًا 💍`;
  }

  private speechCache = { key: '', lines: [] as string[] };

  /** فقاعة كلام تكتب حرفًا حرفًا فوق نقطة معيّنة، بتفاف تلقائي للسطور (محسوبة مرة واحدة فقط لكل تغيّر) */
  private drawSpeech(g: CanvasRenderingContext2D, x: number, bottomY: number, full: string, fontPx: number) {
    const el = this.ceremony ? Math.max(0, Date.now() - this.ceremony.stepStartedAt) : 0;
    const CHAR_MS = 42;
    const shown = full.slice(0, Math.floor(el / CHAR_MS));
    if (!shown) return;
    g.save();
    g.font = `600 ${Math.round(fontPx * 0.95)}px Tajawal, Tahoma, sans-serif`;
    const maxW = 230;
    if (this.speechCache.key !== shown) {
      const words = shown.split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (g.measureText(test).width > maxW && cur) {
          lines.push(cur);
          cur = w;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      this.speechCache = { key: shown, lines };
    }
    const lines = this.speechCache.lines;
    const lh = fontPx * 1.5;
    const boxW = Math.min(maxW + 28, Math.max(...lines.map((l) => g.measureText(l).width)) + 28);
    const boxH = lines.length * lh + 18;
    const boxY = bottomY - boxH;
    g.fillStyle = 'rgba(10,8,4,.88)';
    g.strokeStyle = '#d8b55a';
    g.lineWidth = 1.5;
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(x - boxW / 2, boxY, boxW, boxH, 12);
    else g.rect(x - boxW / 2, boxY, boxW, boxH);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffe9a8';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, x, boxY + 12 + lh * i + lh / 2));
    g.restore();
  }

  /* ---------- التحكم ---------- */
  private bindControls() {
    const keyMap: Record<string, 'u' | 'd' | 'l' | 'r'> = {
      KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
    };
    const key = (v: number) => (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = keyMap[e.code];
      if (!k) return;
      this.keys[k] = v;
      e.preventDefault();
    };
    const kd = key(1);
    const ku = key(0);
    const blur = () => {
      this.keys = { u: 0, d: 0, l: 0, r: 0 };
    };
    let pinch = 0;
    const pts = new Map<number, { x: number; y: number }>();
    const zoomBy = (f: number) => {
      const base = this.baseS();
      const cur = this.overview ? this.fitS() / base : this.zoomMul ?? 1;
      this.overview = false;
      this.zoomMul = clamp(cur * f, this.fitS() / base, 2.2);
      if (Math.abs(this.zoomMul - 1) < 0.06) this.zoomMul = null;
    };
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pinch = 0;
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size === 2) {
        const [a, b] = Array.from(pts.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) zoomBy(d / pinch);
        pinch = d;
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(1 - e.deltaY * 0.001);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    this.canvas.addEventListener('pointerdown', down);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('wheel', wheel, { passive: false });
    this.cleanup.push(() => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      this.canvas.removeEventListener('pointerdown', down);
      this.canvas.removeEventListener('pointermove', move);
      this.canvas.removeEventListener('pointerup', up);
      this.canvas.removeEventListener('pointercancel', up);
      this.canvas.removeEventListener('wheel', wheel);
    });
  }
}
