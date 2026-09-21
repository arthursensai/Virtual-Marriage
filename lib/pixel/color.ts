/** أدوات ألوان صغيرة للرسم بالبكسل */
export function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}
const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
export const rgb = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

/** f < 1 يُغمّق، f > 1 يفتّح باتجاه الأبيض */
export function shade(hex: string, f: number): string {
  const [r, g, b] = parseHex(hex);
  if (f <= 1) return rgb(r * f, g * f, b * f);
  const t = Math.min(1, f - 1);
  return rgb(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return rgb(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
export function luma(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
