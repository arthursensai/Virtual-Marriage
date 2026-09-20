import { BOUNDS } from './world';

export { BOUNDS };

export interface Obstacle2D {
  x: number;
  z: number;
  r: number;
}

/** نفس إحداثيات العوائق من lib/world.ts (buildWorld) — كراسي، كعكة، هدايا، نافورة، تصوير */
export const OBSTACLES_2D: Obstacle2D[] = (() => {
  const list: Obstacle2D[] = [];
  for (const side of [-1, 1]) {
    for (const col of [1.75, 2.6]) {
      for (let row = 0; row < 4; row++) {
        list.push({ x: side * col, z: 2.6 + row * 1.5, r: 0.3 });
      }
    }
  }
  list.push({ x: -6.2, z: 5.6, r: 0.95 }); // الكعكة
  list.push({ x: -6.2, z: 9.4, r: 1.0 }); // الهدايا
  list.push({ x: 6.4, z: 0.8, r: 1.55 }); // النافورة
  [-1, 0, 1].forEach((k) => list.push({ x: -6.2 + k * 1, z: -3.6, r: 0.5 })); // ركن التصوير
  return list;
})();

export const STATIONS = [
  { emoji: '💃', label: 'ساحة الرقص', x: 6.2, z: 6.6 },
  { emoji: '🎂', label: 'الكعكة', x: -6.2, z: 5.6 },
  { emoji: '🎁', label: 'الهدايا', x: -6.2, z: 9.4 },
  { emoji: '⛲', label: 'النافورة', x: 6.4, z: 0.8 },
  { emoji: '📸', label: 'ركن التصوير', x: -6.2, z: -3.6 },
  { emoji: '🚪', label: 'المدخل', x: 0, z: 14.05 },
];

export interface Cam2D {
  cx: number;
  cz: number;
  zoom: number;
}

/** يحوّل إحداثيات العالم (x,z) إلى بكسلات شاشة بحسب موضع/تقريب الكاميرا الحالي */
export function project(cam: Cam2D, w: number, h: number, x: number, z: number) {
  return { x: w / 2 + (x - cam.cx) * cam.zoom, y: h / 2 + (z - cam.cz) * cam.zoom };
}

/** يرسم الساحة كاملة من الأعلى: الأرضية، السياج، الممشى، المذبح، الكراسي، محطات الحفل */
export function drawVenue(ctx: CanvasRenderingContext2D, cam: Cam2D, w: number, h: number, night: boolean, t: number) {
  const P = (x: number, z: number) => project(cam, w, h, x, z);

  ctx.fillStyle = night ? '#132018' : '#3f7a45';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = night ? '#1f5a3a' : '#2e7d4f';
  ctx.lineWidth = Math.max(2, cam.zoom * 0.04);
  const a = P(BOUNDS.minX - 0.5, BOUNDS.minZ - 1);
  const b = P(BOUNDS.maxX + 0.5, BOUNDS.maxZ + 0.5);
  ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);

  ctx.fillStyle = '#8e1b2e';
  const aisleTop = P(-0.75, -1);
  const aisleBot = P(0.75, 11.5);
  ctx.fillRect(aisleTop.x, aisleTop.y, aisleBot.x - aisleTop.x, aisleBot.y - aisleTop.y);

  const altar = P(0, -0.5);
  ctx.fillStyle = '#8a6a45';
  ctx.beginPath();
  ctx.arc(altar.x, altar.y, 2.9 * cam.zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d8b55a';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (cam.zoom > 20) {
    ctx.font = `${Math.round(cam.zoom * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('💍', altar.x, altar.y - 3.4 * cam.zoom);
  }

  ctx.fillStyle = '#f7f1e4';
  OBSTACLES_2D.slice(0, 16).forEach((o) => {
    const p = P(o.x, o.z);
    const s = o.r * cam.zoom * 1.6;
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  });

  const dance = P(6.2, 6.6);
  const ds = 4.4 * cam.zoom;
  const cols = ['#ff5c9a', '#7a4dff', '#2f5fa8', '#ffb347'];
  const cell = ds / 6;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = cols[(i + j) % cols.length];
      ctx.fillRect(dance.x - ds / 2 + i * cell, dance.y - ds / 2 + j * cell, cell, cell);
    }
  }
  ctx.fillStyle = `hsl(${(t * 40) % 360} 70% 70%)`;
  ctx.beginPath();
  ctx.arc(dance.x, dance.y, Math.max(3, cam.zoom * 0.18), 0, Math.PI * 2);
  ctx.fill();

  const cake = P(-6.2, 5.6);
  ctx.fillStyle = '#fff7f0';
  ctx.beginPath();
  ctx.arc(cake.x, cake.y, 0.75 * cam.zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d8b55a';
  ctx.stroke();

  const gifts = P(-6.2, 9.4);
  const giftCols = ['#e63956', '#4cc9f0', '#ffd166', '#9b5de5'];
  giftCols.forEach((c, i) => {
    ctx.fillStyle = c;
    const s = 0.3 * cam.zoom;
    ctx.fillRect(gifts.x - s * 2 + i * s * 1.1, gifts.y - s / 2, s * 0.9, s * 0.9);
  });

  const fnt = P(6.4, 0.8);
  ctx.fillStyle = '#c9c2b4';
  ctx.beginPath();
  ctx.arc(fnt.x, fnt.y, 1.5 * cam.zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(200 70% ${55 + Math.sin(t * 2) * 5}%)`;
  ctx.beginPath();
  ctx.arc(fnt.x, fnt.y, 1.2 * cam.zoom, 0, Math.PI * 2);
  ctx.fill();

  const photo = P(-6.2, -3.6);
  ctx.fillStyle = '#8e1b2e';
  ctx.fillRect(photo.x - 1.5 * cam.zoom, photo.y - 1.3 * cam.zoom, 3 * cam.zoom, 0.3 * cam.zoom);

  const gate = P(0, 14.05);
  ctx.strokeStyle = '#d8b55a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(gate.x, gate.y, 1.6 * cam.zoom, Math.PI, Math.PI * 2);
  ctx.stroke();

  if (cam.zoom > 18) {
    ctx.font = `${Math.round(cam.zoom * 0.45)}px Tajawal, Tahoma, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    STATIONS.forEach((s) => {
      const p = P(s.x, s.z);
      ctx.fillText(`${s.emoji} ${s.label}`, p.x, p.y - 42 * (cam.zoom / 32));
    });
  }
}
