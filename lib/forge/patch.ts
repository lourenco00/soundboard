// lib/forge/patch.ts
// The "patch" is the shared contract between the LLM, the API route, and the
// audio renderer. An LLM reads the user's prompt and emits one of these; the
// renderer (lib/forge/render.ts) turns it into an AudioBuffer. Because the
// numbers come from the words in the prompt, every prompt yields a different
// sound — that's the whole point of the Forge.
import { z } from "zod";

const clamp01 = z.number().min(0).max(1);

/** ADSR envelope, seconds (except sustain which is a 0..1 level). */
export const EnvSchema = z.object({
  attack: z.number().min(0).max(4).default(0.005),
  decay: z.number().min(0).max(8).default(0.2),
  sustain: clamp01.default(0),
  release: z.number().min(0).max(8).default(0.1),
});

export const FilterSchema = z.object({
  type: z.enum(["lowpass", "highpass", "bandpass"]).default("lowpass"),
  freqStart: z.number().min(20).max(20000).default(20000),
  freqEnd: z.number().min(20).max(20000).default(20000),
  q: z.number().min(0.1).max(24).default(0.7),
});

export const LayerSchema = z.object({
  // "osc" = pitched oscillator, "noise" = noise source (drums/air/fx).
  source: z.enum(["osc", "noise"]).default("osc"),
  waveform: z.enum(["sine", "sawtooth", "square", "triangle"]).default("sine"),
  noiseType: z.enum(["white", "pink"]).default("white"),

  // Pitch. freqStart != freqEnd gives a pitch sweep (kicks, risers, zaps).
  freqStart: z.number().min(20).max(18000).default(220),
  freqEnd: z.number().min(20).max(18000).default(220),
  freqCurve: z.enum(["linear", "exp"]).default("exp"),

  detune: z.number().min(-1200).max(1200).default(0), // cents
  unison: z.number().int().min(1).max(3).default(1),   // stacked detuned voices

  gain: clamp01.default(0.7),
  pan: z.number().min(-1).max(1).default(0),

  amp: EnvSchema.default({ attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }),
  filter: FilterSchema.optional(),
});

export const PatchSchema = z.object({
  name: z.string().max(80).default("Forged sound"),
  durationMs: z.number().min(120).max(6000).default(1200),
  layers: z.array(LayerSchema).min(1).max(6),
  master: z
    .object({
      gain: clamp01.default(0.85),
      drive: clamp01.default(0), // waveshaper saturation amount
    })
    .default({ gain: 0.85, drive: 0 }),
});

export type Env = z.infer<typeof EnvSchema>;
export type Filter = z.infer<typeof FilterSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type ForgePatch = z.infer<typeof PatchSchema>;

export type ForgeRequest = {
  prompt: string;
  preset: string;
  bpm: number;
  keyRoot: string;
  durationMs: number;
  intensity: number;
};

export const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** MIDI-note frequency for a root name + semitone offset. Octave ~4. */
export function noteFreq(root: string, semitoneOffset = 0) {
  const idx = Math.max(0, KEYS.indexOf(root));
  const midi = 60 + idx + semitoneOffset;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Parse arbitrary JSON from an LLM into a validated patch, clamping every
 * value into range. Throws if the shape is unusable.
 */
export function parsePatch(raw: unknown): ForgePatch {
  return PatchSchema.parse(raw);
}

/**
 * A prompt-aware fallback used when no AI provider is configured or the model
 * call fails. It's deliberately keyword-driven so that — unlike the old fixed
 * synth — the words in the prompt still change the result.
 */
export function heuristicPatch(req: ForgeRequest): ForgePatch {
  const p = req.prompt.toLowerCase();
  const has = (...words: string[]) => words.some((w) => p.includes(w));
  const root = noteFreq(req.keyRoot, 0);
  const intensity = req.intensity;

  // Descriptor knobs mined from the prompt text.
  const dark = has("dark", "deep", "murky", "sub", "moody", "low");
  const bright = has("bright", "glassy", "shiny", "crisp", "airy", "sharp", "hyper");
  const dirty = has("dirty", "gritty", "distort", "saturat", "crunch", "aggress", "hard");
  const detuned = has("detune", "wide", "super", "unison", "chorus", "thick");
  const vinyl = has("vinyl", "lo-fi", "lofi", "dusty", "tape", "old", "warm");
  const drive = Math.min(1, (dirty ? 0.6 : 0.12) + intensity * 0.35);

  let cutoff = 20000;
  if (dark) cutoff = 900 + intensity * 1200;
  else if (bright) cutoff = 20000;
  else cutoff = 3000 + intensity * 6000;

  const layers: Layer[] = [];

  switch (req.preset) {
    case "kick":
      layers.push({
        source: "osc", waveform: "sine", noiseType: "white",
        freqStart: dark ? 160 : 130, freqEnd: 45, freqCurve: "exp",
        detune: 0, unison: 1, gain: 0.95, pan: 0,
        amp: { attack: 0.001, decay: 0.28 + intensity * 0.25, sustain: 0, release: 0.05 },
      });
      layers.push({
        source: "noise", waveform: "sine", noiseType: "white",
        freqStart: 200, freqEnd: 200, freqCurve: "linear",
        detune: 0, unison: 1, gain: 0.25 + intensity * 0.2, pan: 0,
        amp: { attack: 0.0005, decay: 0.02, sustain: 0, release: 0.01 },
        filter: { type: "lowpass", freqStart: 6000, freqEnd: 2000, q: 0.7 },
      });
      break;
    case "snare":
      layers.push({
        source: "noise", waveform: "sine", noiseType: vinyl ? "pink" : "white",
        freqStart: 400, freqEnd: 400, freqCurve: "linear",
        detune: 0, unison: 1, gain: 0.85, pan: 0,
        amp: { attack: 0.001, decay: 0.14 + intensity * 0.12, sustain: 0, release: 0.05 },
        filter: { type: "highpass", freqStart: dark ? 700 : 1400, freqEnd: 1200, q: 0.8 },
      });
      layers.push({
        source: "osc", waveform: "triangle", noiseType: "white",
        freqStart: 190, freqEnd: 150, freqCurve: "exp",
        detune: 0, unison: 1, gain: 0.4, pan: 0,
        amp: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 },
      });
      break;
    case "hat":
      layers.push({
        source: "noise", waveform: "sine", noiseType: "white",
        freqStart: 8000, freqEnd: 8000, freqCurve: "linear",
        detune: 0, unison: 1, gain: 0.7, pan: 0,
        amp: { attack: 0.0005, decay: 0.03 + intensity * 0.08, sustain: 0, release: 0.02 },
        filter: { type: "highpass", freqStart: 7000, freqEnd: 9000, q: 1.2 },
      });
      break;
    case "bass":
      layers.push({
        source: "osc", waveform: dirty ? "sawtooth" : "square",
        noiseType: "white",
        freqStart: root / 2, freqEnd: root / 2, freqCurve: "linear",
        detune: detuned ? 8 : 0, unison: detuned ? 2 : 1, gain: 0.9, pan: 0,
        amp: { attack: 0.005, decay: 0.3, sustain: 0.8, release: 0.2 },
        filter: { type: "lowpass", freqStart: cutoff, freqEnd: cutoff * 0.6, q: dirty ? 6 : 1 },
      });
      break;
    case "lead":
      layers.push({
        source: "osc", waveform: "sawtooth", noiseType: "white",
        freqStart: root * 2, freqEnd: root * 2, freqCurve: "linear",
        detune: detuned ? 14 : 4, unison: detuned ? 3 : 2, gain: 0.7, pan: 0,
        amp: { attack: 0.01, decay: 0.4, sustain: 0.7, release: 0.3 },
        filter: { type: "lowpass", freqStart: cutoff, freqEnd: cutoff, q: 2 },
      });
      break;
    case "pad":
      for (let i = 0; i < 3; i++) {
        const semis = [0, 7, 12][i];
        layers.push({
          source: "osc", waveform: "sawtooth", noiseType: "white",
          freqStart: noteFreq(req.keyRoot, semis - 12),
          freqEnd: noteFreq(req.keyRoot, semis - 12), freqCurve: "linear",
          detune: detuned ? 10 : 3, unison: 2, gain: 0.35, pan: i === 1 ? -0.3 : i === 2 ? 0.3 : 0,
          amp: { attack: 0.6 + intensity * 0.4, decay: 1.0, sustain: 0.6, release: 1.2 },
          filter: { type: "lowpass", freqStart: cutoff * 0.6, freqEnd: cutoff, q: 0.8 },
        });
      }
      break;
    case "vox":
      layers.push({
        source: "osc", waveform: "sawtooth", noiseType: "white",
        freqStart: root * 1.5, freqEnd: root * 1.5, freqCurve: "linear",
        detune: 6, unison: 2, gain: 0.6, pan: 0,
        amp: { attack: 0.02, decay: 0.5, sustain: 0.5, release: 0.3 },
        filter: { type: "bandpass", freqStart: 1200, freqEnd: 800, q: 4 },
      });
      break;
    case "fx":
    default:
      layers.push({
        source: "noise", waveform: "sine", noiseType: "white",
        freqStart: 200, freqEnd: 200, freqCurve: "linear",
        detune: 0, unison: 1, gain: 0.6, pan: 0,
        amp: { attack: req.durationMs / 2000, decay: 0.1, sustain: 0.4, release: req.durationMs / 2000 },
        filter: { type: "bandpass", freqStart: 200, freqEnd: 8000, q: 3 },
      });
      layers.push({
        source: "osc", waveform: "sawtooth", noiseType: "white",
        freqStart: 200, freqEnd: 4000, freqCurve: "exp",
        detune: 12, unison: 2, gain: 0.3, pan: 0,
        amp: { attack: req.durationMs / 2000, decay: 0.1, sustain: 0.5, release: 0.3 },
      });
      break;
  }

  return PatchSchema.parse({
    name: `${req.preset} · ${req.prompt.slice(0, 40)}`,
    durationMs: req.durationMs,
    layers,
    master: { gain: 0.85, drive },
  });
}
