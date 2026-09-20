'use client';
import type { Look } from './types';
import { clamp, hash } from './util';
import { BOUNDS, OBSTACLES_2D, drawVenue, project, type Cam2D } from './world2d';
import { resolveAppearance } from './lpc/manifest';
import { drawLPCCharacter, drawNameplate, quantizeDirection } from './lpc/renderer';
import { preload } from './lpc/assetLoader';
import type { LPCAppearance } from './lpc/types';
// نعيد استخدام الأنواع والثوابت غير المرتبطة بالمُحرِّك من النسخة ثلاثية الأبعاد، لتفادي أي
// انحراف بينهما. lib/scene.ts (three.js) يبقى كما هو، ولم يُمس أو يُستبدل.
import type { ReactKind, SceneActor, SceneCeremony, SceneGuest, SceneOptions } from './scene';

export { WALK_MS, MAX_GUESTS } from './scene';
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
  appearance: LPCAppearance;
}
interface Reaction {
  clapUntil: number;
  hearts: { x: number; y: number; life: number }[];
}

function goalFor2D(step: number): Cam2D {
  if (step < 0) return { cx: 0, cz: 5.4, zoom: 30 };
  if (step === 0) return { cx: 0, cz: 3, zoom: 32 };
  return { cx: 0, cz: -0.5, zoom: 46 };
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
  private localId: string | null = null;
  private input = { x: 0, y: 0 };
  private keys = { u: 0, d: 0, l: 0, r: 0 };
  private lastSend = 0;
  private wasMoving = false;

  private ceremony: SceneCeremony | null = null;
  private lastKey = '';
  private night = true;
  private viewShift = 0;

  private cam: Cam2D = { cx: 0, cz: 5.4, zoom: 30 };
  private camGoal: Cam2D = { cx: 0, cz: 5.4, zoom: 30 };
  private userZoom = false;

  private reactions = new Map<string, Reaction>();
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

  setActor(role: 'groom' | 'bride', a: SceneActor) {
    const key = JSON.stringify([a.look, a.name]);
    if (this.actorKey[role] === key) return;
    this.actorKey[role] = key;
    const appearance = resolveAppearance(role, a.look);
    preload(appearance.layers);
    this.actors[role] = { name: a.name, look: a.look, appearance };
    if (!this.ents.has(role)) {
      const sp = a.pos ?? { x: role === 'groom' ? -0.85 : 0.85, z: -0.5, r: role === 'groom' ? Math.PI / 2 : Math.PI * 1.5 };
      this.ents.set(role, { x: sp.x, z: sp.z, tx: sp.x, tz: sp.z, rot: sp.r, trot: sp.r, moving: false, seen: 0 });
    }
  }

  setGuests(list: SceneGuest[]) {
    const shown = list.slice(0, 20);
    const ids = new Set(shown.map((g) => g.id));
    for (const id of Array.from(this.guests.keys())) if (!ids.has(id)) this.guests.delete(id);
    shown.forEach((g) => {
      const key = JSON.stringify([g.look, g.name]);
      const cur = this.guests.get(g.id);
      if (cur && cur.key === key) return;
      const appearance = resolveAppearance('guest', g.look);
      preload(appearance.layers);
      this.guests.set(g.id, { key, rec: { name: g.name, look: g.look, appearance } });
    });
    shown.forEach((g) => {
      if (this.ents.has(g.id)) return;
      const h = hash(g.id);
      const sp = g.pos ?? { x: ((h % 9) - 4) * 0.45, z: 11.6 + ((h >> 4) % 3) * 0.7, r: Math.PI };
      this.ents.set(g.id, { x: sp.x, z: sp.z, tx: sp.x, tz: sp.z, rot: sp.r, trot: sp.r, moving: false, seen: 0 });
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
  remotePos(id: string, x: number, z: number, r: number, moving: boolean) {
    const e = this.ents.get(id);
    if (!e || id === this.localId) return;
    e.tx = clamp(x, BOUNDS.minX, BOUNDS.maxX);
    e.tz = clamp(z, BOUNDS.minZ, BOUNDS.maxZ);
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
    const pal = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ffffff'];
    for (let i = 0; i < 80; i++) {
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
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
  }

  /* ---------- التصادم ---------- */
  private collide(x: number, z: number) {
    let nx = clamp(x, BOUNDS.minX, BOUNDS.maxX);
    let nz = clamp(z, BOUNDS.minZ, BOUNDS.maxZ);
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
      const c = this.collide(e.x + vx * sp * dt, e.z + vz * sp * dt);
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
    if (!this.userZoom) this.camGoal = goalFor2D(step);
    const late = step === 5 ? el > 2500 : step === 0 ? el > 1500 : false;
    if (step === 5 && el < 10000) this.burstConfetti();
    this.opts.onStep?.(step, late);
  }

  private ceremonyPose(): boolean {
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
    if (!g || !b) return false;
    if (step < 0) return g.moving || b.moving;
    if (step === 0) {
      const tt = clamp(el / 7000, 0, 1);
      g.x = -(0.5 + (0.85 - 0.5) * (1 - tt));
      g.z = 9.5 + (-0.5 - 9.5) * tt;
      g.rot = Math.PI / 2;
      b.x = 0.5 + (0.85 - 0.5) * (1 - tt);
      b.z = 9.5 + (-0.5 - 9.5) * tt;
      b.rot = Math.PI * 1.5;
      return tt < 1;
    }
    const k = step >= 5 ? clamp(step === 5 ? el / 1500 : 1, 0, 1) : 0;
    g.x = -(0.85 - (0.85 - 0.4) * k);
    g.z = -0.5;
    g.rot = Math.PI / 2;
    b.x = 0.85 - (0.85 - 0.4) * k;
    b.z = -0.5;
    b.rot = Math.PI * 1.5;
    return false;
  }

  /* ---------- رسم ---------- */
  private drawFigure(id: string, rec: ActorRec, tSec: number, gold: boolean) {
    const e = this.ents.get(id);
    if (!e) return;
    const p = project(this.cam, this.w, this.h, e.x, e.z);
    const dir = quantizeDirection(e.rot);
    const anim = e.moving ? 'walk' : 'idle';
    const px = clamp(this.cam.zoom / 48, 0.55, 1.4);
    drawLPCCharacter({
      ctx: this.ctx,
      screenX: p.x,
      screenY: p.y + 6 * px,
      pxScale: px,
      direction: dir,
      anim,
      t: tSec,
      appearance: rec.appearance,
      requestRender: () => {},
    });
    drawNameplate(this.ctx, p.x, p.y - 64 * px - 4, rec.name, { gold, scale: px });

    const r = this.reactions.get(id);
    if (r) {
      const now = performance.now();
      if (r.clapUntil > now) {
        this.ctx.font = `${18 * px}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('👏', p.x, p.y - 74 * px);
      }
      r.hearts = r.hearts.filter((hh) => hh.life > 0);
      r.hearts.forEach((hh) => {
        hh.y -= 22 / 60;
        hh.life -= 1 / 90;
        this.ctx.save();
        this.ctx.globalAlpha = clamp(hh.life, 0, 1);
        this.ctx.font = '16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('❤️', p.x + hh.x, p.y - 40 + hh.y);
        this.ctx.restore();
      });
      if (r.hearts.length === 0 && r.clapUntil < now) this.reactions.delete(id);
    }

    if (id === this.localId) {
      this.ctx.save();
      this.ctx.strokeStyle = '#ffd166';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.ellipse(p.x, p.y + 4, 16 * px, 6 * px, 0, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
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

  private tick = (nowMs: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min((nowMs - (this.lastT || nowMs)) / 1000, 0.05);
    this.lastT = nowMs;
    const tSec = (nowMs - this.startT) / 1000;

    this.stepLocal(dt, nowMs);
    this.updateEnts(dt, nowMs);
    this.ceremonyPose();

    const k = 1 - Math.pow(0.02, dt);
    (['cx', 'cz', 'zoom'] as const).forEach((key) => {
      this.cam[key] += (this.camGoal[key] - this.cam[key]) * k;
    });

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.w, this.h);
    // إزاحة رأسية بسيطة للجوال حتى لا يحجب لوحة التحكم السفلية المشهد (يقابل viewShift ثلاثي الأبعاد)
    ctx.translate(0, -this.viewShift * this.h * 0.28);
    drawVenue(ctx, this.cam, this.w, this.h, this.night, tSec);

    const order: { id: string; rec: ActorRec; gold: boolean }[] = [];
    this.guests.forEach((g, id) => order.push({ id, rec: g.rec, gold: false }));
    if (this.actors.groom) order.push({ id: 'groom', rec: this.actors.groom, gold: true });
    if (this.actors.bride) order.push({ id: 'bride', rec: this.actors.bride, gold: true });
    order
      .filter((o) => this.ents.has(o.id))
      .sort((a, b) => this.ents.get(a.id)!.z - this.ents.get(b.id)!.z)
      .forEach((o) => this.drawFigure(o.id, o.rec, tSec, o.gold));

    this.drawConfetti(dt);
    ctx.restore();
  };

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
        if (pinch) {
          this.userZoom = true;
          this.camGoal.zoom = clamp(this.camGoal.zoom * (d / pinch), 16, 90);
        }
        pinch = d;
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.userZoom = true;
      this.camGoal.zoom = clamp(this.camGoal.zoom * (1 - e.deltaY * 0.001), 16, 90);
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
