// Explosion sound, decoded with Web Audio so rapid clicks play instantly.
// On/off is remembered between visits.

import boomUrl from "./assets/explosion.mp3";
import { AudioCtx, loadBuffer } from "./lib/audio";
import { load, save } from "./lib/storage";

const VOLUME = 0.19;
const MIN_GAP_MS = 100; // don't stack booms closer than this
const FALLBACK_SKIP_S = 0.39; // leading silence, skipped by the <audio> fallback
const SFX_KEY = "delete-discord-sfx";

let enabled = load(SFX_KEY) !== "off";
let boom: AudioBuffer | undefined, lead = 0, lastSound = 0;
let pool: HTMLAudioElement[] | undefined, poolIdx = 0;
const live = new Set<AudioBufferSourceNode>(); // explosion sounds still playing
const ctx = AudioCtx && new AudioCtx({ latencyHint: "interactive" });

/** The MP3 starts with ~0.4 s of silence; find where the boom begins. */
function findLead(b: AudioBuffer): number {
  let first = b.length;
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < first; i++) if (Math.abs(d[i]) > 0.01) { first = i; break; }
  }
  return Math.max(0, first / b.sampleRate - 0.003);
}

if (ctx) {
  loadBuffer(ctx, boomUrl).then(b => { lead = findLead(b); boom = b; }, () => {});
  const wake = () => { if (ctx.state === "suspended") ctx.resume(); };
  for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, wake, { passive: true });
}

function fallbackPlay(): void { // plain <audio> if Web Audio is unavailable or not decoded yet
  pool ??= Array.from({ length: 4 }, () => { const a = new Audio(boomUrl); a.volume = VOLUME; return a; });
  const a = pool[poolIdx++ % pool.length];
  a.currentTime = FALLBACK_SKIP_S; a.play().catch(() => {});
}

export function playBoom(): void {
  if (!enabled) return;
  const now = performance.now();
  if (now - lastSound < MIN_GAP_MS) return;
  lastSound = now;
  if (!ctx || !boom) return fallbackPlay();
  if (ctx.state !== "running") ctx.resume();
  const src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = boom; gain.gain.value = VOLUME;
  src.connect(gain); gain.connect(ctx.destination); src.start(0, lead);
  live.add(src); src.onended = () => live.delete(src);
}

export const sfxEnabled = () => enabled;

export function setSfx(on: boolean): void {
  enabled = on;
  save(SFX_KEY, on ? "on" : "off");
  if (on) return;
  // cut off anything already playing
  live.forEach(n => { try { n.stop(); } catch {} }); live.clear();
  pool?.forEach(a => a.pause());
}
