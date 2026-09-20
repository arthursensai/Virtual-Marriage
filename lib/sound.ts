let ctx: AudioContext | null = null;
let enabled = true;

export function setSound(on: boolean) {
  enabled = on;
}
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* ignore */
  }
}
function tone(f: number, t0: number, d: number, type: OscillatorType = 'sine', v = 0.07) {
  if (!enabled || !ctx) return;
  try {
    const n = ctx.currentTime;
    const os = ctx.createOscillator();
    const g = ctx.createGain();
    os.type = type;
    os.frequency.value = f;
    g.gain.setValueAtTime(0, n + t0);
    g.gain.linearRampToValueAtTime(v, n + t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, n + t0 + d);
    os.connect(g);
    g.connect(ctx.destination);
    os.start(n + t0);
    os.stop(n + t0 + d + 0.05);
  } catch {
    /* ignore */
  }
}
export const ding = () => tone(880, 0, 0.5, 'sine', 0.05);
export const chime = () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.14, 1, 'triangle', 0.07));
