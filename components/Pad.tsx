"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAudioContext, getMaster } from "@/lib/audio";
import Visualizer from "./Visualizer";

export type PadData = { label: string; key: string; src?: string; deck?: "A" | "B"; color?: string };

const COLORS = ["violet", "pink", "cyan", "emerald", "amber", "rose", "sky", "fuchsia", "lime"];
function colorFor(key: string): string {
  const idx = "asdfghjkl".indexOf(key.toLowerCase());
  return COLORS[idx >= 0 ? idx : 0];
}
const COLOR_MAP: Record<string, { grad: string; ring: string; shadow: string }> = {
  violet:   { grad: "from-violet-500/40 to-fuchsia-500/20",   ring: "ring-violet-400/70",   shadow: "shadow-violet-500/30" },
  pink:     { grad: "from-pink-500/40 to-rose-500/20",        ring: "ring-pink-400/70",     shadow: "shadow-pink-500/30" },
  cyan:     { grad: "from-cyan-500/40 to-sky-500/20",         ring: "ring-cyan-400/70",     shadow: "shadow-cyan-500/30" },
  emerald:  { grad: "from-emerald-500/40 to-teal-500/20",     ring: "ring-emerald-400/70",  shadow: "shadow-emerald-500/30" },
  amber:    { grad: "from-amber-500/40 to-orange-500/20",     ring: "ring-amber-400/70",    shadow: "shadow-amber-500/30" },
  rose:     { grad: "from-rose-500/40 to-pink-500/20",        ring: "ring-rose-400/70",     shadow: "shadow-rose-500/30" },
  sky:      { grad: "from-sky-500/40 to-blue-500/20",         ring: "ring-sky-400/70",      shadow: "shadow-sky-500/30" },
  fuchsia:  { grad: "from-fuchsia-500/40 to-purple-500/20",   ring: "ring-fuchsia-400/70",  shadow: "shadow-fuchsia-500/30" },
  lime:     { grad: "from-lime-500/40 to-emerald-500/20",     ring: "ring-lime-400/70",     shadow: "shadow-lime-500/30" },
};

export default function Pad({
  data,
  quantizeMs = 0,
  onDropSample,
  onSoloChange,
  soloActive,
}: {
  data: PadData;
  quantizeMs?: number;
  onDropSample: (key: string, sample: { name: string; src: string }) => void;
  onSoloChange: (key: string, solo: boolean) => void;
  soloActive: boolean;
}) {
  const [vol, setVol] = useState(0.9);
  const [loop, setLoop] = useState(false);
  const [pan, setPan] = useState(0);
  const [filter, setFilter] = useState<{ type: BiquadFilterType; freq: number }>({ type: "lowpass", freq: 20000 });
  const [send, setSend] = useState(0);
  const [armed, setArmed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [solo, setSolo] = useState(false);
  const [hits, setHits] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaEl = useRef<HTMLAudioElement | null>(null);
  const nodes = useRef<{
    src?: MediaElementAudioSourceNode;
    gain?: GainNode;
    pan?: StereoPannerNode;
    filt?: BiquadFilterNode;
    send?: GainNode;
    analyser?: AnalyserNode;
  }>({});

  const deck = data.deck ?? "A";
  const id = useMemo(() => data.label.toLowerCase().replace(/\s+/g, "-"), [data.label]);
  const color = COLOR_MAP[data.color || colorFor(data.key)];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.key.toLowerCase() === data.key.toLowerCase()) trigger();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.key, loop, vol, pan, filter, send, muted, solo, quantizeMs]);

  useEffect(() => { onSoloChange(data.key, solo); }, [solo]);

  function ensure() {
    if (!data.src) return;
    const encoded = encodeURI(data.src);

    if (!mediaEl.current) {
      const a = new Audio(encoded);
      a.preload = "auto";
      a.crossOrigin = "anonymous";
      a.loop = loop;
      mediaEl.current = a;
    }
    mediaEl.current!.src = encoded;
    mediaEl.current!.loop = loop;

    const ac = getAudioContext();
    if (!nodes.current.src) {
      nodes.current.src = ac.createMediaElementSource(mediaEl.current!);
      nodes.current.gain = ac.createGain();
      nodes.current.pan = ac.createStereoPanner();
      nodes.current.filt = ac.createBiquadFilter();
      nodes.current.send = ac.createGain();
      nodes.current.analyser = ac.createAnalyser();

      const chain = nodes.current;
      chain.gain!.gain.value = vol;
      chain.pan!.pan.value = pan;
      chain.filt!.type = filter.type;
      chain.filt!.frequency.value = filter.freq;
      chain.send!.gain.value = send;

      getMaster().then(m => {
        const deckNode = deck === "A" ? m.panA : m.panB;
        chain.src!.connect(chain.filt!);
        chain.filt!.connect(chain.pan!);
        chain.pan!.connect(chain.gain!);
        chain.gain!.connect(deckNode);
        chain.gain!.connect(chain.analyser!);
        chain.src!.connect(chain.send!);
        chain.send!.connect(m.reverbIn);
        setAnalyser(chain.analyser!);
      });
    }
  }

  function updateParams() {
    const c = nodes.current;
    if (!c.gain) return;
    c.gain.gain.value = muted || (soloActive && !solo) ? 0 : vol;
    c.pan!.pan.value = pan;
    c.filt!.type = filter.type;
    c.filt!.frequency.value = filter.freq;
    c.send!.gain.value = send;
  }
  useEffect(updateParams, [vol, pan, filter, send, muted, solo, soloActive]);

  async function trigger() {
    if (!data.src) return;
    ensure();
    const play = () => {
      const el = mediaEl.current;
      if (!el) return;
      el.currentTime = 0;
      el.play().catch(() => {});
      setArmed(true);
      setHits(h => h + 1);
      setTimeout(() => setArmed(false), 120);
    };
    if (quantizeMs > 0) {
      const now = performance.now();
      setTimeout(play, quantizeMs - (now % quantizeMs));
    } else {
      play();
    }
  }

  function stop() {
    mediaEl.current?.pause();
    if (mediaEl.current) mediaEl.current.currentTime = 0;
  }

  const sampleName = data.src ? decodeURI(data.src).split("/").pop() : null;
  const empty = !data.src;

  return (
    <div
      className={`relative group rounded-2xl p-4 transition overflow-hidden ${
        empty
          ? "border-2 border-dashed border-white/15 bg-white/[.02]"
          : "glass"
      } ${armed ? `ring-2 ${color.ring} ${color.shadow} shadow-lg pad-pulse` : "ring-1 ring-white/5"}`}
      onDragOver={(e) => {
        const ok = e.dataTransfer.types.includes("text/sample") || e.dataTransfer.types.includes("application/json");
        if (ok) e.preventDefault();
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData("text/sample") || e.dataTransfer.getData("application/json");
        if (!raw) return;
        const s = JSON.parse(raw) as { id: string; name: string; src: string };
        onDropSample(data.key, { name: s.name, src: s.src });
        mediaEl.current = null;
        nodes.current = {};
      }}
    >
      {/* color tint overlay */}
      {!empty && (
        <div className={`absolute inset-0 bg-gradient-to-br ${color.grad} opacity-20 pointer-events-none`} />
      )}

      <div className="relative flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <kbd className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-black/40 border border-white/15 text-gray-200`}>
              {data.key.toUpperCase()}
            </kbd>
            <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
              deck === "A" ? "bg-violet-500/20 text-violet-200" : "bg-pink-500/20 text-pink-200"
            }`}>
              Deck {deck}
            </span>
            {hits > 0 && (
              <span className="text-[9px] text-gray-400">· {hits} hit{hits === 1 ? "" : "s"}</span>
            )}
          </div>
          <div className="text-base font-semibold truncate">{data.label}</div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={trigger}
            disabled={empty}
            className="btn-ghost rounded-lg px-2.5 py-1 text-sm disabled:opacity-40"
            title="Play (or press the assigned key)"
          >▶</button>
          <button
            onClick={stop}
            disabled={empty}
            className="btn-ghost rounded-lg px-2.5 py-1 text-sm disabled:opacity-40"
            title="Stop"
          >■</button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="btn-ghost rounded-lg px-2 py-1 text-sm"
            title={expanded ? "Less controls" : "More controls"}
          >{expanded ? "−" : "+"}</button>
        </div>
      </div>

      <div className="relative rounded-xl border border-white/10 bg-black/30 p-2 mb-3 h-[68px] flex flex-col justify-between">
        <Visualizer analyser={analyser} />
        <div className="text-[10px] text-gray-400 px-1 truncate">
          {sampleName || (
            <span className="text-gray-500 italic">Drop a sample, or press {data.key.toUpperCase()}</span>
          )}
        </div>
      </div>

      {/* compact main controls */}
      <div className="relative grid grid-cols-12 gap-2 items-center text-[11px]">
        <label className="col-span-2 text-gray-400">Vol</label>
        <input className="col-span-7 accent-violet-500" type="range" min={0} max={1} step={0.01} value={vol} onChange={(e) => setVol(parseFloat(e.target.value))} />
        <button
          className={`col-span-1 rounded-md py-1 text-[10px] font-semibold ${muted ? "bg-rose-500/40 text-white" : "bg-white/10 text-gray-200"}`}
          onClick={() => setMuted(m => !m)}
        >M</button>
        <button
          className={`col-span-1 rounded-md py-1 text-[10px] font-semibold ${solo ? "bg-emerald-500/40 text-white" : "bg-white/10 text-gray-200"}`}
          onClick={() => setSolo(s => !s)}
        >S</button>
        <button
          className={`col-span-1 rounded-md py-1 text-[10px] font-semibold ${loop ? "bg-cyan-500/40 text-white" : "bg-white/10 text-gray-200"}`}
          onClick={() => setLoop(l => !l)}
          title="Loop"
        >∞</button>
      </div>

      {/* expanded controls */}
      {expanded && (
        <div className="relative grid grid-cols-12 gap-2 items-center text-[11px] mt-2 pt-2 border-t border-white/10">
          <label className="col-span-2 text-gray-400">Pan</label>
          <input className="col-span-10 accent-pink-500" type="range" min={-1} max={1} step={0.01} value={pan} onChange={(e) => setPan(parseFloat(e.target.value))} />

          <label className="col-span-2 text-gray-400">Filter</label>
          <select
            className="col-span-3 bg-black/40 border border-white/10 rounded-md px-2 py-1 text-[11px]"
            value={filter.type}
            onChange={(e) => setFilter(f => ({ ...f, type: e.target.value as BiquadFilterType }))}
          >
            <option value="lowpass">LP</option>
            <option value="highpass">HP</option>
            <option value="bandpass">BP</option>
          </select>
          <input
            className="col-span-7 accent-cyan-500"
            type="range" min={100} max={20000} step={1}
            value={filter.freq}
            onChange={(e) => setFilter(f => ({ ...f, freq: parseFloat(e.target.value) }))}
          />

          <label className="col-span-2 text-gray-400">Reverb</label>
          <input className="col-span-10 accent-fuchsia-500" type="range" min={0} max={1} step={0.01} value={send} onChange={(e) => setSend(parseFloat(e.target.value))} />
        </div>
      )}
    </div>
  );
}
