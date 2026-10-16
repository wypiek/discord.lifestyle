// Background music: muted by default, loops while unmuted.

import musicUrl from "./assets/music.mp3";
import { AudioCtx, loadBuffer } from "./lib/audio";

const VOLUME = 0.3;

let ctx: AudioContext | undefined, gain: GainNode | undefined;
let buf: AudioBuffer | undefined, src: AudioBufferSourceNode | undefined;
let on = false, loading = false;

function start(): void {
  if (!on || src || !buf || !ctx || !gain) return;
  src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  src.connect(gain); src.start();
}

/** Downloads and decodes the track. Safe to call often; only the first call does work. */
export function preloadMusic(): void {
  if (!AudioCtx) return;
  if (!ctx) {
    ctx = new AudioCtx();
    gain = ctx.createGain(); gain.gain.value = VOLUME; gain.connect(ctx.destination);
  }
  if (buf || loading) return;
  loading = true;
  loadBuffer(ctx, musicUrl).then(
    b => { buf = b; loading = false; start(); },
    () => { loading = false; },
  );
}

export function setMusic(play: boolean): void {
  on = play;
  if (play) { preloadMusic(); ctx?.resume(); start(); }
  else ctx?.suspend();
}
