"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAudioContext, getMaster } from "@/lib/audio";

export type Sample = { id: string; name: string; src: string };
export type PianoPreset = { id: string; name: string; sample: Sample; baseNote: string; volume: number };
type Note = { id: string; pitch: number; start: number; dur: number }; // beats

const GRID_PPQ = 4;         // 16ths
const VISIBLE_OCTAVES = 3;
const BPM_DEFAULT = 120;

const NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const isSharp = (m: number) => NAMES[m % 12].includes("#");
const nameOf  = (m: number) => `${NAMES[m % 12]}${Math.floor(m/12) - 1}`;
const ratio   = (semi: number) => Math.pow(2, semi / 12);
function midiFromName(n: string) {
  const m = n.match(/^([A-G])(#?)(-?\d+)$/i);
  if (!m) return 60;
  const base: Record<string, number> = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  return 12 * (parseInt(m[3],10) + 1) + base[m[1].toUpperCase()] + (m[2] ? 1 : 0);
}

// helper: inclusive window detection with loop wrap
function inWindowLooped(x: number, a: number, b: number, loop: number) {
  // window [a, b) in beat space, may exceed loop
  const nx = ((x % loop) + loop) % loop;
  const na = ((a % loop) + loop) % loop;
  const nb = ((b % loop) + loop) % loop;
  if (na <= nb) return nx >= na && nx < nb;
  // wrapped
  return nx >= na || nx < nb;
}

export default function PianoRoll({
  samples,
  initialPreset,
  onSavePreset,
}: {
  samples: Sample[];
  initialPreset?: Partial<PianoPreset>;
  onSavePreset?: (p: PianoPreset) => void;
}) {
  // sampler
  const [selected, setSelected] = useState<Sample | null>(initialPreset?.sample ?? null);
  const [baseNote, setBaseNote] = useState<string>(initialPreset?.baseNote ?? "C4");
  const [volume, setVolume]     = useState<number>(initialPreset?.volume ?? 0.9);
  const [presetName, setPresetName] = useState<string>(initialPreset?.name ?? "New Piano Preset");

  // roll
  const [bpm, setBpm] = useState(BPM_DEFAULT);
  const [bars, setBars] = useState<number>(2);
  const [topOct, setTopOct] = useState<number>(5);
  const [notes, setNotes] = useState<Note[]>([]);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0); // beats (0..totalBeats)

  // audio
  const bufferRef = useRef<AudioBuffer | null>(null);
  const gainRef   = useRef<GainNode | null>(null);

  // layout
  const laneHeight = 28;
  const keyColWidth = 86;
  const totalBeats = bars * 4;

  // responsive beat width (fills to the end)
  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const [gridW, setGridW] = useState<number>(800);
  useEffect(() => {
    if (!gridWrapRef.current) return;
    const el = gridWrapRef.current;
    const ro = new ResizeObserver(() => setGridW(el.clientWidth));
    ro.observe(el);
    setGridW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const beatWidth = Math.max(32, gridW / totalBeats); // keep sensible min width

  const lanes = useMemo(() => {
    const topMidi = 12 * (topOct + 1) + 11; // B topOct
    return Array.from({ length: VISIBLE_OCTAVES * 12 }, (_, i) => topMidi - i);
  }, [topOct]);

  // load sample
  useEffect(() => {
    let cancelled = false;
    (async () => {
      bufferRef.current = null;
      if (!selected) return;
      const ac = getAudioContext();
      try { await ac.resume(); } catch {}
      const res = await fetch(encodeURI(selected.src), { cache: "force-cache" });
      const arr = await res.arrayBuffer();
      const buf = await ac.decodeAudioData(arr.slice(0));
      if (!cancelled) bufferRef.current = buf;
    })();
    return () => { cancelled = true; };
  }, [selected]);

  // gain -> master
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { master } = await getMaster();
      const ac = getAudioContext();
      if (!mounted) return;
      if (!gainRef.current) {
        const g = ac.createGain();
        g.gain.value = volume;
        g.connect(master);
        gainRef.current = g;
      } else {
        gainRef.current.gain.value = volume;
      }
    })();
    return () => { mounted = false; };
  }, [volume]);

  const baseMidi = useMemo(() => midiFromName(baseNote), [baseNote]);

  const createVoice = useCallback((mTarget: number) => {
    const ac = getAudioContext();
    const buf = bufferRef.current;
    const g   = gainRef.current;
    if (!buf || !g) return null;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = ratio(mTarget - baseMidi);
    src.connect(g);
    return { ac, src };
  }, [baseMidi]);

  // transport (fixed scheduling)
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now();
    const startBeat = playhead;

    const lookAhead = 0.25; // seconds
    let lastSched = -1;

    const tick = () => {
      const now = performance.now();
      const elapsed = (now - start) / 1000;
      const bps = bpm / 60;
      const curBeat = (startBeat + elapsed * bps) % totalBeats;
      setPlayhead(curBeat);

      // schedule a bit ahead each frame
      const windowBeats = lookAhead * bps;
      const winStart = curBeat;
      const winEnd = curBeat + windowBeats;

      if (now - lastSched > (lookAhead * 1000) / 2) {
        lastSched = now;

        const ac = getAudioContext();
        const t0 = ac.currentTime + 0.02;

        notes.forEach(n => {
          // schedule note starts that fall inside [winStart,winEnd) modulo loop
          // test the base start and one shifted by ±loop to catch wrap
          for (const s of [n.start, n.start + totalBeats, n.start - totalBeats]) {
            if (inWindowLooped(s, winStart, winEnd, totalBeats)) {
              const when = t0 + (s - curBeat) / bps;
              const durS = Math.max(0.05, n.dur / bps);
              const v = createVoice(n.pitch);
              if (v) {
                try { v.src.start(when); v.src.stop(when + durS); } catch {}
              }
            }
          }
        });
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, bpm, notes, createVoice, totalBeats, playhead]);

  // interactions
  const rollRef = useRef<HTMLDivElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<"move"|"resizeL"|"resizeR"|"create"|null>(null);
  const [dragStart, setDragStart] = useState<{x:number;y:number;note?:Note}|null>(null);

  const pxToBeat = (x: number) => {
    const rect = rollRef.current!.getBoundingClientRect();
    const rel = Math.max(0, Math.min(rect.width, x - rect.left));
    const beat = rel / beatWidth;
    return Math.max(0, Math.min(totalBeats, Math.round(beat * GRID_PPQ) / GRID_PPQ));
  };
  const yToMidi = (y: number) => {
    const rect = rollRef.current!.getBoundingClientRect();
    const rel  = Math.max(0, Math.min(rect.height, y - rect.top));
    const lane = Math.floor(rel / laneHeight);
    return lanes[lane] ?? lanes[lanes.length - 1];
  };

  function onMouseDownGrid(e: React.MouseEvent) {
    const m = yToMidi(e.clientY);
    const s = pxToBeat(e.clientX);
    const id = Math.random().toString(36).slice(2, 9);
    const n: Note = { id, pitch: m, start: s, dur: 1 };
    setNotes(prev => [...prev, n]);
    setDragId(id); setDragMode("create"); setDragStart({ x: e.clientX, y: e.clientY, note: n });
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragId || !dragMode) return;
    const sBeat = pxToBeat(e.clientX);
    const mPitch = yToMidi(e.clientY);
    setNotes(prev => prev.map(n => {
      if (n.id !== dragId) return n;
      if (dragMode === "create" || dragMode === "resizeR") {
        const start = dragStart!.note!.start;
        const dur = Math.max(1/GRID_PPQ, Math.min(totalBeats - start, sBeat - start));
        return { ...n, dur };
      }
      if (dragMode === "move") {
        const start = Math.max(0, Math.min(totalBeats - n.dur, sBeat - n.dur/2));
        return { ...n, start, pitch: mPitch };
      }
      if (dragMode === "resizeL") {
        const end = n.start + n.dur;
        const start = Math.max(0, Math.min(end - 1/GRID_PPQ, sBeat));
        return { ...n, start, dur: end - start };
      }
      return n;
    }));
  }
  const onMouseUp = () => { setDragId(null); setDragMode(null); setDragStart(null); };

  function playKey(m: number) {
    const v = createVoice(m);
    if (v) {
      const t = getAudioContext().currentTime + 0.01;
      try { v.src.start(t); v.src.stop(t + 0.35); } catch {}
    }
  }

  // sizes
  const heightPx = lanes.length * laneHeight;

  return (
    <section className="glass rounded-2xl p-4 border border-white/10">
      {/* header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="font-semibold text-gray-200">Piano Roll</div>
          <div className="text-xs text-gray-400">Draw & move notes • glossy side keys • loop & play</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={presetName}
            onChange={(e)=>setPresetName(e.target.value)}
            placeholder="New Piano Preset"
            className="rounded-md bg-white/10 border border-white/15 px-2 py-1 text-xs text-gray-100 outline-none"
          />
          <button
            onClick={()=>{
              if (!selected || !onSavePreset) return;
              onSavePreset({
                id: Math.random().toString(36).slice(2,10),
                name: presetName || "Piano Preset",
                sample: selected, baseNote, volume
              });
            }}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-500/70 hover:bg-indigo-500 text-white transition"
          >
            Save Preset
          </button>
        </div>
      </div>

      {/* control bar */}
      <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Sample */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">Sample</span>
            <select
              value={selected?.id || ""}
              onChange={(e)=>setSelected(samples.find(s=>s.id===e.target.value) || null)}
              className="piano-select w-64 rounded-md border border-white/15 bg-zinc-800/80 text-gray-100 px-2 py-1.5 text-sm outline-none"
            >
              <option value="" disabled>Select a sample…</option>
              {samples.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Base */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">Base</span>
            <select
              value={baseNote}
              onChange={(e)=>setBaseNote(e.target.value)}
              className="piano-select w-24 rounded-md border border-white/15 bg-zinc-800/80 text-gray-100 px-2 py-1.5 text-sm outline-none"
            >
              {["C3","D3","E3","F3","G3","A3","B3","C4","D4","E4","F4","G4","A4","B4","C5"].map(n =>
                <option key={n} value={n}>{n}</option>
              )}
            </select>
          </div>

          {/* BPM */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">BPM</span>
            <input
              type="number" min={40} max={220} value={bpm}
              onChange={(e)=>setBpm(parseInt(e.target.value||"120",10))}
              className="w-20 rounded-md bg-white/10 border border-white/15 px-2 py-1.5 text-sm text-gray-100 outline-none"
            />
          </div>

          {/* Bars */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">Bars</span>
            <select
              value={bars}
              onChange={(e)=>setBars(parseInt(e.target.value,10))}
              className="piano-select w-20 rounded-md border border-white/15 bg-zinc-800/80 text-gray-100 px-2 py-1.5 text-sm outline-none"
            >
              {[1,2,4,8].map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* View */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">View</span>
            <button onClick={()=>setTopOct(o=>o+1)} className="px-2 py-1 rounded-md bg-white/10 border border-white/15 text-sm text-gray-100">↑</button>
            <button onClick={()=>setTopOct(o=>o-1)} className="px-2 py-1 rounded-md bg-white/10 border border-white/15 text-sm text-gray-100">↓</button>
          </div>

          {/* Vol + Transport */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-300">Vol</span>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e)=>setVolume(parseFloat(e.target.value))} className="w-28 accent-indigo-400" />
            <span className="w-8 text-right text-xs text-gray-400">{Math.round(volume*100)}</span>
            <button onClick={()=>setPlaying(p=>!p)} className="px-3 py-1.5 rounded-md bg-indigo-500/70 hover:bg-indigo-500 text-white text-sm">
              {playing ? "Stop" : "Play"}
            </button>
            <button onClick={()=>setPlayhead(0)} className="px-2 py-1 rounded-md bg-white/10 border border-white/15 text-sm text-gray-100">⟲</button>
          </div>
        </div>
      </div>

      {/* === Roll with LEFT side keyboard === */}
      <div className="rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.04),_rgba(0,0,0,0)_60%)] p-3">
        <div className="relative rounded-xl border border-white/10 overflow-hidden">
          <div className="flex">
            {/* LEFT: vertical keyboard */}
            <div
              className="shrink-0 border-r border-white/10"
              style={{ width: keyColWidth, height: lanes.length * laneHeight }}
            >
              {lanes.map((m) => {
                const sharp = isSharp(m);
                const label = nameOf(m);
                return (
                  <button
                    key={`k-${m}`}
                    onMouseDown={() => playKey(m)}
                    className={`w-full relative text-left pl-2 ${sharp
                      ? "bg-gradient-to-r from-zinc-900 to-black"
                      : "bg-gradient-to-r from-white to-zinc-200"} border-b border-white/10 active:translate-x-[1px] transition`}
                    style={{ height: laneHeight }}
                    title={label}
                  >
                    {!sharp && (
                      <span className="text-[10px] text-zinc-700/80">{label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* RIGHT: grid area (auto-fit width) */}
            <div ref={gridWrapRef} className="relative flex-1">
              <div
                ref={rollRef}
                className="relative cursor-crosshair"
                style={{ width: "100%", height: lanes.length * laneHeight }}
                onMouseDown={onMouseDownGrid}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
              >
                {/* lane tint */}
                {lanes.map((m, i) => (
                  <div
                    key={`lane-${m}`}
                    className={`absolute left-0 right-0 ${isSharp(m) ? "bg-black/25" : "bg-zinc-100/[0.03]"}`}
                    style={{ top: i * laneHeight, height: laneHeight }}
                  />
                ))}

                {/* vertical grid (fills to end) */}
                {Array.from({ length: totalBeats * GRID_PPQ + 1 }).map((_, i) => {
                  const x = (i / GRID_PPQ) * beatWidth;
                  const isBar = i % (4 * GRID_PPQ) === 0;
                  const isBeat = i % GRID_PPQ === 0;
                  return (
                    <div
                      key={`v-${i}`}
                      className={`absolute top-0 bottom-0 ${isBar ? "bg-white/20" : isBeat ? "bg-white/10" : "bg-white/5"}`}
                      style={{ left: x, width: isBar ? 2 : 1 }}
                    />
                  );
                })}

                {/* playhead */}
                <div
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: playhead * beatWidth,
                    width: 2,
                    background: "linear-gradient(to bottom, rgba(129,140,248,0.9), rgba(129,140,248,0.3))",
                    boxShadow: "0 0 12px rgba(129,140,248,0.6)",
                  }}
                />

                {/* notes */}
                {notes.map((n) => {
                  const idx = lanes.indexOf(n.pitch);
                  if (idx < 0) return null;
                  const left = n.start * beatWidth;
                  const width = n.dur * beatWidth;
                  const top = idx * laneHeight + 2;

                  return (
                    <div
                      key={n.id}
                      className="group absolute rounded-lg border text-[10px] select-none"
                      style={{
                        left, top, width, height: laneHeight - 4,
                        background: "linear-gradient(180deg,#34d399cc,#10b981cc)",
                        borderColor: "rgba(16,185,129,.45)",
                        boxShadow: "0 4px 14px rgba(16,185,129,.25), inset 0 0 8px rgba(0,0,0,.25)",
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const edge = 8;
                        const localX = e.nativeEvent.offsetX;
                        const mode = localX < edge ? "resizeL" : (localX > width - edge ? "resizeR" : "move");
                        setDragId(n.id);
                        setDragMode(mode as any);
                        setDragStart({ x: e.clientX, y: e.clientY, note: { ...n } });
                      }}
                      onDoubleClick={() => {
                        const v = createVoice(n.pitch);
                        if (v) {
                          const t = getAudioContext().currentTime + 0.01;
                          try { v.src.start(t); v.src.stop(t + 0.4); } catch {}
                        }
                      }}
                    >
                      <div className="px-1 pt-[2px] text-black/80 font-medium">{nameOf(n.pitch)}</div>
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-black/20 rounded-l-lg cursor-ew-resize" />
                      <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-black/20 rounded-r-lg cursor-ew-resize" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* dark native select */}
      <style jsx global>{`
        .piano-select { color-scheme: dark; }
        .piano-select option { background: #0c0d10; color: #e5e7eb; }
      `}</style>
    </section>
  );
}
