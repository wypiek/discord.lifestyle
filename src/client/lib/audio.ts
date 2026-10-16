declare global {
  interface Window { webkitAudioContext?: typeof AudioContext }
}

/** Web Audio constructor, or undefined where the browser has none. */
export const AudioCtx: typeof AudioContext | undefined = window.AudioContext ?? window.webkitAudioContext;

/** Fetches and decodes an audio file. */
export async function loadBuffer(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bytes = await res.arrayBuffer();
  // Callback form: older Safari has no promise-returning decodeAudioData.
  return new Promise((resolve, reject) => ctx.decodeAudioData(bytes, resolve, reject));
}
