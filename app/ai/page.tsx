"use client";
import { useEffect, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import { getAudioContext, getMaster } from "@/lib/audio";

type Gen = {
  id: string;
  prompt: string;
  preset: string;
  bpm: number;
  key: string;
  durationMs: number;
  buffer: AudioBuffer;
  createdAt: number;
};

const PRESETS = [
  { id: "kick", name: "Kick", icon: "💥", desc: "Punchy 808-style kick" },
  { id: "snare", name: "Snare", icon: "🥁", desc: "Crisp layered snare" },
  { id: "hat", name: "Hi-Hat", icon: "🎩", desc: "Tight closed/open hat" },
  { id: "bass", name: "Bass", icon: "🎸", desc: "Sub-rumbling bass tone" },
  { id: "lead", name: "Lead", icon: "⚡", desc: "Bright lead synth" },
  { id: "pad", name: "Pad", icon: "🌫", desc: "Lush evolving pad" },
  { id: "vox", name: "Vox FX", icon: "🎤", desc: "Vowel/vox texture" },
  { id: "fx", name: "FX Riser", icon: "🚀", desc: "Cinematic riser sweep" },
];

const PROMPT_IDEAS = [
  "Dark trap kick with deep sub tail",
  "Lo-fi snare with a vinyl crackle aftertaste",
  "Hyperpop saw lead, glassy and detuned",
  "Cinematic riser with reverse cymbal",
  "Warm bedroom-pop synth pad in C minor",
  "Snappy hip-hop hat pattern",
];

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALE_MAJOR = [0, 2, 4, 5, 7, 9, 11];

export default function AIForgePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState("Dark trap kick with deep sub tail");
  const [preset, setPreset] = useState("kick");
  const [bpm, setBpm] = useState(124);
  const [keyRoot, setKeyRoot] = useState("C");
  const [duration, setDuration] = useState(1200);
  const [intensity, setIntensity] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const [gens, setGens] = useState<Gen[]>([]);
  const [remaining, setRemaining] = useState<number>(200);

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => setAuthed(!!d?.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  async function generate() {
    if (busy) return;
    setBusy(true);
    try {
      const ac = getAudioContext();
      await getMaster();
      const buffer = await synthesizeSample({
        ac,
        preset,
        durationMs: duration,
        bpm,
        keyRoot,
        intensity,
        promptHash: hash(prompt),
      });
      const id = Math.random().toString(36).slice(2, 9);
      setGens(prev => [
        { id, prompt, preset, bpm, key: keyRoot, durationMs: duration, buffer, createdAt: Date.now() },
        ...prev,
      ]);
      setRemaining(r => Math.max(0, r - 1));
    } finally {
      // small UI breathing room
      setTimeout(() => setBusy(false), 300);
    }
  }

  function playBuffer(buf: AudioBuffer) {
    const ac = getAudioContext();
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.value = 0.9;
    src.connect(g).connect(ac.destination);
    src.start();
  }

  function downloadBuffer(g: Gen) {
    const wav = bufferToWav(g.buffer);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge-${g.preset}-${g.id}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function sendToPads(g: Gen) {
    // encode WAV to a data URL and drop it into a localStorage queue the studio page can pick up
    const wav = bufferToWav(g.buffer);
    const blob = new Blob([wav], { type: "audio/wav" });
    const reader = new FileReader();
    reader.onload = () => {
      const queue = JSON.parse(localStorage.getItem("sb_forge_queue") || "[]");
      queue.unshift({ name: `Forge · ${g.preset} · ${g.prompt.slice(0, 28)}`, src: reader.result });
      localStorage.setItem("sb_forge_queue", JSON.stringify(queue.slice(0, 24)));
      window.location.href = "/";
    };
    reader.readAsDataURL(blob);
  }

  return (
    <main className="min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-violet-300 mb-1">AI Sample Forge</div>
            <h1 className="text-3xl md:text-4xl font-bold">Type a vibe. <span className="gradient-text">Get a stem.</span></h1>
            <p className="text-gray-400 mt-2 max-w-2xl">
              Describe what you want — Soundboard Lab synthesizes a sample on-device. Bounce to WAV, or drop into the pads.
            </p>
          </div>
          <div className="glass rounded-xl px-4 py-3 text-sm">
            <div className="text-[10px] uppercase tracking-widest text-gray-400">Quota this month</div>
            <div className="font-semibold text-lg">{remaining} <span className="text-gray-500 text-sm font-normal">/ 200</span></div>
          </div>
        </div>

        {authed === false && (
          <div className="glass rounded-2xl p-6 mb-6 border border-amber-300/20">
            <div className="font-semibold mb-1">Heads up — you're not logged in.</div>
            <p className="text-sm text-gray-400">
              You can preview the Forge here. <a href="/signup" className="text-violet-300 underline">Sign up free</a> to save and reuse generations.
            </p>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Prompt panel */}
          <section className="col-span-12 lg:col-span-7 glass-strong rounded-2xl p-6">
            <label className="text-xs uppercase tracking-widest text-gray-400">Prompt</label>
            <textarea
              className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base outline-none focus:border-violet-400/60"
              rows={3}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. 'Dark trap kick with a deep sub tail'"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {PROMPT_IDEAS.map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(i)}
                  className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                >
                  {i}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <label className="text-xs uppercase tracking-widest text-gray-400">Sound type</label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={`text-left rounded-xl p-3 transition ${
                      preset === p.id
                        ? "glass-strong gradient-border glow-violet"
                        : "glass hover:bg-white/[.07]"
                    }`}
                  >
                    <div className="text-xl">{p.icon}</div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-[10px] text-gray-400">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-12 gap-4 text-sm">
              <div className="col-span-12 sm:col-span-4">
                <label className="text-xs uppercase tracking-widest text-gray-400">BPM</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="range" min={60} max={200} value={bpm} onChange={e => setBpm(parseInt(e.target.value))} className="flex-1 accent-violet-500" />
                  <span className="font-mono w-10 text-right">{bpm}</span>
                </div>
              </div>
              <div className="col-span-6 sm:col-span-3">
                <label className="text-xs uppercase tracking-widest text-gray-400">Key</label>
                <select
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5"
                  value={keyRoot}
                  onChange={e => setKeyRoot(e.target.value)}
                >
                  {KEYS.map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div className="col-span-6 sm:col-span-2">
                <label className="text-xs uppercase tracking-widest text-gray-400">Length</label>
                <select
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5"
                  value={duration}
                  onChange={e => setDuration(parseInt(e.target.value))}
                >
                  <option value={500}>0.5s</option>
                  <option value={1200}>1.2s</option>
                  <option value={2500}>2.5s</option>
                  <option value={4000}>4.0s</option>
                </select>
              </div>
              <div className="col-span-12 sm:col-span-3">
                <label className="text-xs uppercase tracking-widest text-gray-400">Intensity</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="range" min={0} max={1} step={0.01} value={intensity} onChange={e => setIntensity(parseFloat(e.target.value))} className="flex-1 accent-pink-500" />
                  <span className="font-mono w-10 text-right">{Math.round(intensity * 100)}</span>
                </div>
              </div>
            </div>

            <button
              disabled={busy}
              onClick={generate}
              className="mt-6 btn-primary rounded-xl px-6 py-3 w-full text-base disabled:opacity-60"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Forging your sound...
                </span>
              ) : (
                <>✨ Generate sample</>
              )}
            </button>
          </section>

          {/* Generation reel */}
          <aside className="col-span-12 lg:col-span-5 glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Generations</div>
              <div className="text-xs text-gray-400">{gens.length} this session</div>
            </div>

            {gens.length === 0 && (
              <div className="text-sm text-gray-400 border border-dashed border-white/15 rounded-xl p-6 text-center">
                Your generations will show up here.
                <br />
                Hit <span className="font-semibold text-gray-200">Generate</span> to make one.
              </div>
            )}

            <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {gens.map(g => (
                <li key={g.id} className="rounded-xl glass p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-400 uppercase tracking-widest truncate">
                        {g.preset} · {g.key} · {g.bpm}bpm · {(g.durationMs / 1000).toFixed(1)}s
                      </div>
                      <div className="text-sm font-medium truncate">{g.prompt}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => playBuffer(g.buffer)} className="btn-ghost rounded-md px-2 py-1 text-sm" title="Play">▶</button>
                      <button onClick={() => sendToPads(g)} className="btn-ghost rounded-md px-2 py-1 text-xs" title="Send to Pads">→ Pads</button>
                      <button onClick={() => downloadBuffer(g)} className="btn-ghost rounded-md px-2 py-1 text-xs" title="Download WAV">⬇</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <p className="text-xs text-gray-500 text-center mt-8">
          Forge synthesizes audio fully on-device — no audio leaves your browser.
        </p>
      </div>
    </main>
  );
}

/* ------------------ procedural synthesis ------------------ */

type SynthOpts = {
  ac: AudioContext;
  preset: string;
  durationMs: number;
  bpm: number;
  keyRoot: string;
  intensity: number;
  promptHash: number;
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function noteFreq(root: string, semitoneOffset: number) {
  const idx = KEYS.indexOf(root);
  const midi = 60 + idx + semitoneOffset;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

async function synthesizeSample(opts: SynthOpts): Promise<AudioBuffer> {
  const { ac, preset, durationMs, intensity, promptHash, keyRoot } = opts;
  const sampleRate = ac.sampleRate;
  const length = Math.floor((durationMs / 1000) * sampleRate);
  const buf = ac.createBuffer(2, length, sampleRate);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  const seed = promptHash;
  const rand = mulberry32(seed);

  const rootFreq = noteFreq(keyRoot, 0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const tn = i / length;
    let v = 0;

    switch (preset) {
      case "kick": {
        const pitch = 120 * Math.exp(-tn * 35) + 50;
        const env = Math.exp(-tn * 6);
        v = Math.sin(2 * Math.PI * pitch * t) * env;
        v += (rand() * 2 - 1) * 0.2 * Math.exp(-tn * 60);
        break;
      }
      case "snare": {
        const noise = rand() * 2 - 1;
        const env = Math.exp(-tn * 9);
        const tone = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-tn * 18) * 0.5;
        v = (noise * 0.8 + tone) * env;
        break;
      }
      case "hat": {
        const noise = rand() * 2 - 1;
        const env = Math.exp(-tn * (12 + intensity * 18));
        v = noise * env * 0.8;
        // band emphasis around 8k via fake comb
        v += Math.sin(2 * Math.PI * 7800 * t) * 0.05 * env;
        break;
      }
      case "bass": {
        const f = rootFreq / 2;
        const env = Math.exp(-tn * 1.6);
        v = (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 2 * t) * 0.3) * env;
        v += Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.15 * env;
        break;
      }
      case "lead": {
        const f = rootFreq * 2;
        const detune = 1 + Math.sin(t * 6) * 0.005;
        const env = Math.exp(-tn * 1.2);
        v = (saw(f * t) * 0.4 + saw(f * detune * t) * 0.4 + Math.sin(2 * Math.PI * f * t) * 0.2) * env;
        break;
      }
      case "pad": {
        const env = Math.sin(Math.min(1, tn * 4) * Math.PI / 2) * Math.exp(-tn * 0.6);
        let sum = 0;
        for (let n = 0; n < 5; n++) {
          const semi = SCALE_MAJOR[n % SCALE_MAJOR.length];
          const f = noteFreq(keyRoot, semi - 12);
          sum += Math.sin(2 * Math.PI * f * t) * 0.18;
        }
        v = sum * env;
        break;
      }
      case "vox": {
        const f = rootFreq * 1.5;
        const wob = 1 + Math.sin(t * 4) * 0.02;
        const env = Math.exp(-tn * 2);
        v = (Math.sin(2 * Math.PI * f * wob * t) * 0.6 + Math.sin(2 * Math.PI * f * 2 * t) * 0.3) * env;
        v += (rand() * 2 - 1) * 0.05 * env;
        break;
      }
      case "fx": {
        const f = 200 + (1 - Math.exp(-tn * 2)) * 4000;
        const env = Math.sin(tn * Math.PI);
        v = saw(f * t) * 0.3 * env + (rand() * 2 - 1) * 0.2 * env;
        break;
      }
      default:
        v = (rand() * 2 - 1) * Math.exp(-tn * 4);
    }

    const gain = 0.4 + intensity * 0.55;
    const pan = Math.sin(tn * Math.PI * 2) * 0.15;
    L[i] = clamp(v * gain * (1 - pan), -1, 1);
    R[i] = clamp(v * gain * (1 + pan), -1, 1);
  }

  // tiny fade-out to avoid clicks
  const fade = Math.min(length, 1024);
  for (let i = 0; i < fade; i++) {
    const k = 1 - i / fade;
    L[length - 1 - i] *= k;
    R[length - 1 - i] *= k;
  }

  // pretend we took some thinking time
  await new Promise(res => setTimeout(res, 650 + (promptHash % 500)));
  return buf;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function saw(x: number) {
  const f = x - Math.floor(x);
  return f * 2 - 1;
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/* ------------------ WAV encoder ------------------ */
function bufferToWav(buf: AudioBuffer): ArrayBuffer {
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
  function ws(s: string) { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); }
  function w32(n: number) { view.setUint32(p, n, true); p += 4; }
  function w16(n: number) { view.setUint16(p, n, true); p += 2; }

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
