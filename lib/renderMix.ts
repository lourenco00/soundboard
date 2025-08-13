// lib/renderMix.ts
export type Clip = {
  id: string;
  name: string;
  src: string;
  start: number;      // seconds on timeline
  duration: number;   // seconds (buffer.duration by default)
  fadeIn: number;     // seconds
  fadeOut: number;    // seconds
  gain: number;       // 0..1
  lane: number;       // which lane/track
};

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}
function encodeWav(buffers: Float32Array[], sampleRate: number): Blob {
  const numChannels = buffers.length;
  const length = buffers[0].length;
  // interleave
  const interleaved = new Float32Array(length * numChannels);
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      interleaved[i * numChannels + ch] = buffers[ch][i] || 0;
    }
  }
  const bytes = 44 + interleaved.length * 2;
  const arr = new ArrayBuffer(bytes);
  const view = new DataView(arr);

  // RIFF/WAVE header
  let p = 0;
  const w = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
  w("RIFF"); view.setUint32(p, 36 + interleaved.length * 2, true); p += 4;
  w("WAVE"); w("fmt "); view.setUint32(p, 16, true); p += 4;
  view.setUint16(p, 1, true); p += 2; // PCM
  view.setUint16(p, numChannels, true); p += 2;
  view.setUint32(p, sampleRate, true); p += 4;
  view.setUint32(p, sampleRate * numChannels * 2, true); p += 4;
  view.setUint16(p, numChannels * 2, true); p += 2;
  view.setUint16(p, 16, true); p += 2;
  w("data"); view.setUint32(p, interleaved.length * 2, true); p += 4;

  floatTo16BitPCM(view, p, interleaved);
  return new Blob([view], { type: "audio/wav" });
}

/** Render the arrangement to WAV with an OfflineAudioContext and download. */
export async function renderMix(clips: Clip[], sampleRate = 44100) {
  // measure total length
  const end = clips.reduce((t, c) => Math.max(t, c.start + c.duration), 0) + 1;
  const ctx = new OfflineAudioContext(2, Math.ceil(end * sampleRate), sampleRate);

  // decode each unique src once
  const cache = new Map<string, AudioBuffer>();
  async function decode(src: string) {
    if (cache.has(src)) return cache.get(src)!;
    const res = await fetch(encodeURI(src), { cache: "force-cache" });
    const ab = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab);
    cache.set(src, buf); return buf;
  }

  for (const c of clips) {
    const buf = await decode(c.src);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const gain = ctx.createGain();
    gain.gain.value = c.gain;

    // basic fades
    const now = 0;
    const s = now + c.start;
    const e = s + c.duration;
    const g = gain.gain;
    g.setValueAtTime(0, s);
    g.linearRampToValueAtTime(c.gain, s + c.fadeIn);
    g.setValueAtTime(c.gain, e - c.fadeOut);
    g.linearRampToValueAtTime(0, e);

    src.connect(gain).connect(ctx.destination);
    src.start(s, 0, c.duration);
  }

  const rendered = await ctx.startRendering();
  // collect channels
  const L = rendered.getChannelData(0);
  const R = rendered.getChannelData(1);
  const blob = encodeWav([L, R], rendered.sampleRate);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "mix.wav"; a.click();
  URL.revokeObjectURL(url);
}
