"use client";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { getAudioContext, getMaster } from "@/lib/audio";
import { renderPatch, bufferToWav } from "@/lib/forge/render";
import type { ForgePatch } from "@/lib/forge/patch";

type Gen = {
  id: string;
  prompt: string;
  preset: string;
  bpm: number;
  key: string;
  durationMs: number;
  buffer: AudioBuffer;
  patch: ForgePatch;
  source: "ai" | "fallback";
  provider: string | null;
  model: string | null;
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

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude",
  openai: "OpenAI",
};

export default function AIForgePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState("Dark trap kick with deep sub tail");
  const [preset, setPreset] = useState("kick");
  const [bpm, setBpm] = useState(124);
  const [keyRoot, setKeyRoot] = useState("C");
  const [duration, setDuration] = useState(1200);
  const [intensity, setIntensity] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gens, setGens] = useState<Gen[]>([]);

  const [providers, setProviders] = useState<string[]>([]);
  const [provider, setProvider] = useState<"auto" | "claude" | "openai">("auto");

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => setAuthed(!!d?.authenticated))
      .catch(() => setAuthed(false));
    fetch("/api/forge")
      .then(r => r.json())
      .then(d => setProviders(Array.isArray(d?.providers) ? d.providers : []))
      .catch(() => setProviders([]));
  }, []);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ac = getAudioContext();
      await getMaster();

      const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, preset, bpm, keyRoot, durationMs: duration, intensity, provider,
        }),
      });

      if (res.status === 401) {
        setAuthed(false);
        setError("Sign in to forge sounds.");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || "Generation failed.");
        return;
      }

      const data = await res.json();
      const patch: ForgePatch = data.patch;
      const buffer = await renderPatch(ac, patch);

      const id = Math.random().toString(36).slice(2, 9);
      setGens(prev => [
        {
          id, prompt, preset, bpm, key: keyRoot, durationMs: patch.durationMs,
          buffer, patch,
          source: data.source === "ai" ? "ai" : "fallback",
          provider: data.provider ?? null,
          model: data.model ?? null,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
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

  const hasAI = providers.length > 0;

  return (
    <main className="min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-violet-300 mb-1">AI Sample Forge</div>
            <h1 className="text-3xl md:text-4xl font-bold">Type a vibe. <span className="gradient-text">Get a stem.</span></h1>
            <p className="text-gray-400 mt-2 max-w-2xl">
              An AI reads your description and designs a synthesis patch — oscillators, envelopes, filters, drive.
              Your browser renders it to audio. Different words, different sound.
            </p>
          </div>
          <div className="glass rounded-xl px-4 py-3 text-sm">
            <div className="text-[10px] uppercase tracking-widest text-gray-400">Engine</div>
            <div className="font-semibold text-lg">
              {hasAI ? providers.map(p => PROVIDER_LABELS[p] || p).join(" + ") : "On-device"}
            </div>
          </div>
        </div>

        {authed === false && (
          <div className="glass rounded-2xl p-6 mb-6 border border-amber-300/20">
            <div className="font-semibold mb-1">Heads up — you're not logged in.</div>
            <p className="text-sm text-gray-400">
              The Forge needs an account to run. <a href="/signup" className="text-violet-300 underline">Sign up free</a> to start generating.
            </p>
          </div>
        )}

        {!hasAI && (
          <div className="glass rounded-2xl p-4 mb-6 border border-white/10 text-sm text-gray-400">
            No AI provider key is configured on the server, so the Forge is using its built-in prompt-driven synth.
            Set <code className="text-violet-300">ANTHROPIC_API_KEY</code> or <code className="text-violet-300">OPENAI_API_KEY</code> to enable real AI generation.
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

            {hasAI && providers.length > 0 && (
              <div className="mt-6">
                <label className="text-xs uppercase tracking-widest text-gray-400">AI model</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {providers.length > 1 && (
                    <button
                      onClick={() => setProvider("auto")}
                      className={`text-sm px-3 py-1.5 rounded-lg border ${
                        provider === "auto" ? "glass-strong gradient-border" : "glass border-white/10 hover:bg-white/[.07]"
                      }`}
                    >
                      Auto
                    </button>
                  )}
                  {providers.map(p => (
                    <button
                      key={p}
                      onClick={() => setProvider(p as "claude" | "openai")}
                      className={`text-sm px-3 py-1.5 rounded-lg border ${
                        provider === p ? "glass-strong gradient-border" : "glass border-white/10 hover:bg-white/[.07]"
                      }`}
                    >
                      {PROVIDER_LABELS[p] || p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 text-sm text-amber-300/90 bg-amber-400/10 border border-amber-300/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

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
                        {g.preset} · {g.key} · {g.bpm}bpm · {(g.durationMs / 1000).toFixed(1)}s · {g.patch.layers.length} layers
                      </div>
                      <div className="text-sm font-medium truncate">{g.prompt}</div>
                      <div className="mt-1">
                        {g.source === "ai" ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-200 border border-violet-400/20">
                            {PROVIDER_LABELS[g.provider || ""] || g.provider} · {g.model}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                            on-device synth
                          </span>
                        )}
                      </div>
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
          Only your text prompt is sent to the AI. The audio itself is synthesized on-device from the AI's patch — no audio leaves your browser.
        </p>
      </div>
    </main>
  );
}
