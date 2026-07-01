// lib/forge/render.ts
// Renders a ForgePatch into an AudioBuffer using OfflineAudioContext. Real
// Web-Audio nodes (oscillators, biquad filters, gain envelopes, waveshaper
// drive) give far richer results than hand-rolled sample math, and let an
// arbitrary AI-authored patch map straight onto audio. Browser-only.
import type { ForgePatch, Layer } from "./patch";

function makeNoiseBuffer(ctx: BaseAudioContext, seconds: number, type: "white" | "pink") {
  const len = Math.max(1, Math.floor(seconds * ctx.sampleRate));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (type === "pink") {
    // Paul Kellet's economical pink-noise approximation.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** Soft-clip curve for the master waveshaper; amount 0..1. */
function driveCurve(amount: number) {
  const k = amount * 100;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function applyAmpEnv(param: AudioParam, env: Layer["amp"], gain: number, t0: number, dur: number) {
  const peak = Math.max(0.0001, gain);
  const sustainLvl = Math.max(0.0001, peak * env.sustain);
  const attackEnd = t0 + env.attack;
  const decayEnd = attackEnd + env.decay;

  param.setValueAtTime(0.0001, t0);
  param.linearRampToValueAtTime(peak, attackEnd);
  param.exponentialRampToValueAtTime(sustainLvl, decayEnd);

  // Release begins so it lands right at the end of the buffer.
  const releaseStart = Math.max(decayEnd, t0 + dur - env.release);
  param.setValueAtTime(Math.max(0.0001, param.value || sustainLvl), releaseStart);
  param.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function renderLayer(ctx: OfflineAudioContext, layer: Layer, out: AudioNode, dur: number) {
  const t0 = 0;

  // Envelope + panning chain shared by all voices in this layer.
  const ampGain = ctx.createGain();
  ampGain.gain.value = 0.0001;
  applyAmpEnv(ampGain.gain, layer.amp, layer.gain, t0, dur);

  let tail: AudioNode = ampGain;
  if (layer.filter) {
    const biquad = ctx.createBiquadFilter();
    biquad.type = layer.filter.type;
    biquad.Q.value = layer.filter.q;
    biquad.frequency.setValueAtTime(layer.filter.freqStart, t0);
    biquad.frequency.linearRampToValueAtTime(layer.filter.freqEnd, t0 + dur);
    ampGain.connect(biquad);
    tail = biquad;
  }

  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, layer.pan));
  tail.connect(panner);
  panner.connect(out);

  if (layer.source === "noise") {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, dur, layer.noiseType);
    src.connect(ampGain);
    src.start(t0);
    src.stop(t0 + dur);
    return;
  }

  // Oscillator layer, optionally with detuned unison voices.
  const voices = Math.max(1, layer.unison);
  for (let v = 0; v < voices; v++) {
    const osc = ctx.createOscillator();
    osc.type = layer.waveform;
    // Spread unison voices symmetrically around the base detune.
    const spread = voices > 1 ? (v - (voices - 1) / 2) * layer.detune : 0;
    osc.detune.value = layer.detune + spread;
    osc.frequency.setValueAtTime(Math.max(20, layer.freqStart), t0);
    if (layer.freqEnd !== layer.freqStart) {
      const target = Math.max(20, layer.freqEnd);
      if (layer.freqCurve === "exp") osc.frequency.exponentialRampToValueAtTime(target, t0 + dur);
      else osc.frequency.linearRampToValueAtTime(target, t0 + dur);
    }
    const vGain = ctx.createGain();
    vGain.gain.value = 1 / voices;
    osc.connect(vGain).connect(ampGain);
    osc.start(t0);
    osc.stop(t0 + dur);
  }
}

/** Render a patch to a stereo AudioBuffer. `ctx` supplies the sample rate. */
export async function renderPatch(ctx: AudioContext, patch: ForgePatch): Promise<AudioBuffer> {
  const dur = patch.durationMs / 1000;
  const length = Math.max(1, Math.ceil(dur * ctx.sampleRate));
  const offline = new OfflineAudioContext(2, length, ctx.sampleRate);

  const master = offline.createGain();
  master.gain.value = patch.master.gain;

  let masterTail: AudioNode = master;
  if (patch.master.drive > 0.01) {
    const shaper = offline.createWaveShaper();
    shaper.curve = driveCurve(patch.master.drive);
    shaper.oversample = "2x";
    master.connect(shaper);
    masterTail = shaper;
  }
  masterTail.connect(offline.destination);

  for (const layer of patch.layers) renderLayer(offline, layer, master, dur);

  const rendered = await offline.startRendering();

  // Tiny fade to kill any edge clicks.
  const fade = Math.min(rendered.length, 512);
  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    const d = rendered.getChannelData(ch);
    for (let i = 0; i < fade; i++) {
      d[i] *= i / fade;
      d[rendered.length - 1 - i] *= i / fade;
    }
  }
  return rendered;
}

/** Encode an AudioBuffer to a 16-bit PCM WAV ArrayBuffer. */
export function bufferToWav(buf: AudioBuffer): ArrayBuffer {
  const numCh = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const len = buf.length;
  const data = new Float32Array(len * numCh);
  for (let ch = 0; ch < numCh; ch++) {
    const src = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i * numCh + ch] = src[i];
  }

  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = data.length * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  let p = 0;
  const ws = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
  const w32 = (n: number) => { view.setUint32(p, n, true); p += 4; };
  const w16 = (n: number) => { view.setUint16(p, n, true); p += 2; };

  ws("RIFF"); w32(36 + dataSize); ws("WAVE");
  ws("fmt "); w32(16); w16(1); w16(numCh); w32(sr); w32(byteRate); w16(blockAlign); w16(16);
  ws("data"); w32(dataSize);

  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    p += 2;
  }
  return ab;
}
