export const COLORS = [
  "#86efac", "#93c5fd", "#fca5a5", "#fcd34d",
  "#c4b5fd", "#fdba74", "#67e8f9", "#a5b4fc",
];

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function secondsToTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

/** quick peak extraction for drawing */
export function getPeaks(buffer: AudioBuffer, targetWidth: number) {
  const ch0 = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(ch0.length / targetWidth));
  const out: number[] = [];
  for (let i = 0; i < targetWidth; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block && start + j < ch0.length; j++) {
      const v = Math.abs(ch0[start + j]);
      if (v > max) max = v;
    }
    out.push(max);
  }
  return out;
}
