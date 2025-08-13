"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAudioContext, getMaster } from "@/lib/audio";
import Visualizer from "./Visualizer";

export type PadData = { label: string; key: string; src?: string; deck?: "A"|"B" };

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === data.key.toLowerCase()) trigger();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.key, loop, vol, pan, filter, send, muted, solo, quantizeMs]);

  useEffect(() => { onSoloChange(data.key, solo); }, [solo]); // notify parent

  /** Make sure we have the audio element + graph */
  function ensure() {
    if (!data.src) return;

    // --- important: encode spaces & allow CORS so decoding never fails ---
    const encoded = encodeURI(data.src);

    if (!mediaEl.current) {
      const a = new Audio(encoded);
      a.preload = "auto";
      a.crossOrigin = "anonymous";      // <— critical for WebAudio graph
      a.loop = loop;
      mediaEl.current = a;
    }
    mediaEl.current!.src = encoded;     // keep encoded when sample changes
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
      el.play().catch(() => {/* autoplay or decode hiccup — ignore */});
      setArmed(true);
      setTimeout(() => setArmed(false), 90);
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

  return (
    <div
      className={`glass rounded-2xl p-4 transition relative group ${armed ? "ring-2 ring-indigo-500/60" : "ring-1 ring-white/5"}`}
      onDragOver={(e) => {
        const ok = e.dataTransfer.types.includes("text/sample") || e.dataTransfer.types.includes("application/json");
        if (ok) e.preventDefault();
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData("text/sample") || e.dataTransfer.getData("application/json");
        if (!raw) return;
        const s = JSON.parse(raw) as { id: string; name: string; src: string };
        onDropSample(data.key, { name: s.name, src: s.src });
        // reset graph so ensure() rebuilds with new element/source
        mediaEl.current = null;
        nodes.current = {};
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] text-gray-400">Key: {data.key.toUpperCase()} • Deck {deck}</div>
          <div className="text-lg font-semibold">{data.label}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={trigger} className="btn-ghost rounded-xl px-3">▶</button>
          <button onClick={stop} className="btn-ghost rounded-xl px-3">■</button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-2 mb-3">
        <Visualizer analyser={analyser} />
        <div className="text-[11px] text-gray-400 px-1">{data.src ? decodeURI(data.src).split("/").pop() : "Drop a sample here"}</div>
      </div>

      <div className="grid grid-cols-12 gap-3 items-center">
        <label className="col-span-2 text-[11px] text-gray-400">Vol</label>
        <input className="col-span-4 accent-indigo-500" type="range" min={0} max={1} step={0.01} value={vol} onChange={(e)=>setVol(parseFloat(e.target.value))}/>
        <label className="col-span-2 text-[11px] text-gray-400">Pan</label>
        <input className="col-span-4 accent-indigo-500" type="range" min={-1} max={1} step={0.01} value={pan} onChange={(e)=>setPan(parseFloat(e.target.value))}/>
        <label className="col-span-2 text-[11px] text-gray-400">Filter</label>
        <select className="col-span-3 bg-white/10 rounded-md px-2 py-1" value={filter.type}
          onChange={(e)=>setFilter(f=>({ ...f, type: e.target.value as BiquadFilterType }))}>
          <option value="lowpass">LP</option>
          <option value="highpass">HP</option>
          <option value="bandpass">BP</option>
        </select>
        <input className="col-span-7 accent-indigo-500" type="range" min={100} max={20000} step={1} value={filter.freq}
          onChange={(e)=>setFilter(f=>({ ...f, freq: parseFloat(e.target.value) }))}/>
        <label className="col-span-2 text-[11px] text-gray-400">Rev</label>
        <input className="col-span-4 accent-indigo-500" type="range" min={0} max={1} step={0.01} value={send} onChange={(e)=>setSend(parseFloat(e.target.value))}/>
        <label className="col-span-2 text-[11px] text-gray-400">Loop</label>
        <input className="col-span-1" type="checkbox" checked={loop} onChange={(e)=>setLoop(e.target.checked)}/>
        <button className={`col-span-1 text-[11px] rounded-md px-2 py-1 ${muted?"bg-red-500/30":"bg-white/10"}`} onClick={()=>setMuted(m=>!m)}>M</button>
        <button className={`col-span-1 text-[11px] rounded-md px-2 py-1 ${solo?"bg-green-500/30":"bg-white/10"}`} onClick={()=>setSolo(s=>!s)}>S</button>
      </div>
    </div>
  );
}
