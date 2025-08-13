// lib/wave.ts
import { getAudioContext } from "@/lib/audio";

/** Decode an audio file and return AudioBuffer (URL-encoded for safety). */
export async function decodeBuffer(src: string): Promise<AudioBuffer> {
  const ac = getAudioContext();
  const res = await fetch(encodeURI(src), { cache: "force-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${src}`);
  const ab = await res.arrayBuffer();
  return await ac.decodeAudioData(ab);
}

/** Build simple min/max peaks per N samples (good enough for a timeline view). */
export function buildPeaks(
  buffer: AudioBuffer,
  samplesPerPeak = 1024
): { min: Float32Array; max: Float32Array } {
  const ch = buffer.numberOfChannels > 1 ? 2 : 1;
  const dataL = buffer.getChannelData(0);
  const dataR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : dataL;

  const total = Math.ceil(buffer.length / samplesPerPeak);
  const min = new Float32Array(total);
  const max = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, buffer.length);
    let mn = 1, mx = -1;
    for (let s = start; s < end; s++) {
      const v = (dataL[s] + dataR[s]) * 0.5;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    min[i] = mn;
    max[i] = mx;
  }
  return { min, max };
}
