"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAudioContext, getMaster } from "@/lib/audio";

export type Sample = { id: string; name: string; src: string };
export type PianoPreset = {
  id: string;
  name: string;
  sample: Sample;
  baseNote: string; // what pitch the raw sample represents (e.g., C4)
  volume: number;   // 0..1
};

const NOTES = [
  { n: "C"  , s: 0,  k: "A" },
  { n: "C#", s: 1,  k: "W" },
  { n: "D"  , s: 2,  k: "S" },
  { n: "D#", s: 3,  k: "E" },
  { n: "E"  , s: 4,  k: "D" },
  { n: "F"  , s: 5,  k: "F" },
  { n: "F#", s: 6,  k: "T" },
  { n: "G"  , s: 7,  k: "G" },
  { n: "G#", s: 8,  k: "Y" },
  { n: "A"  , s: 9,  k: "H" },
  { n: "A#", s: 10, k: "U" },
  { n: "B"  , s: 11, k: "J" },
] as const;

const OCTAVE_RANGE = { min: 1, max: 7 };
const DEFAULT_BASE = "C4";

// ── helpers ────────────────────────────────────────────────────────────────────
function midi(note: string): number {
  const m = note.match(/^([A-G])(#?)(-?\d+)$/i);
  if (!m) return 60;
  const letter = m[1].toUpperCase();
  const sharp = m[2] ? 1 : 0;
  const oct = parseInt(m[3], 10);
  const baseMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return 12 * (oct + 1) + baseMap[letter] + sharp; // MIDI: C-1 = 0
}
function noteName(semitoneFromC: number, octave: number) {
  const idx = ((semitoneFromC % 12) + 12) % 12;
  return `${NOTES[idx].n}${octave}`;
}
function semitoneRatio(semitones: number) {
  return Math.pow(2, semitones / 12);
}

// ── component ─────────────────────────────────────────────────────────────────
export default function PianoSampler({
  samples,
  onSave,
  initialPreset,
}: {
  samples: Sample[];
  onSave?: (preset: PianoPreset) => void;
  initialPreset?: Partial<PianoPreset>;
}) {
  const [selected, setSelected] = useState<Sample | null>(initialPreset?.sample ?? null);
  const [octave, setOctave] = useState<number>(4);
  const [volume, setVolume] = useState<number>(initialPreset?.volume ?? 0.9);
  const [baseNote, setBaseNote] = useState<string>(initialPreset?.baseNote ?? DEFAULT_BASE);
  const [presetName, setPresetName] = useState<string>(initialPreset?.name ?? "New Piano Preset");

  // decoded buffer + gain
  const bufferRef = useRef<AudioBuffer | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      bufferRef.current = null;
      if (!selected) return;
      const ac = getAudioContext();
      try { await ac.resume(); } catch {}
      const res = await fetch(encodeURI(selected.src), { cache: "force-cache" });
      const arr = await res.arrayBuffer();
      const buf = await ac.decodeAudioData(arr.slice(0));
      if (!cancelled) bufferRef.current = buf;
    }
    load();
    return () => { cancelled = true; };
  }, [selected]);

  useEffect(() => {
    let mounted = true;
    async function ensureGain() {
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
    }
    ensureGain();
    return () => { mounted = false; };
  }, [volume]);

  const keys = useMemo(() => {
    // render 2 octaves (24 keys)
    return Array.from({ length: 24 }, (_, i) => {
      const semitone = i % 12;
      const off = Math.floor(i / 12);
      const o = octave + off;
      const label = noteName(semitone, o);
      const display = NOTES[semitone].n;
      const isSharp = display.includes("#");
      return { label, display, isSharp, midi: midi(label) };
    });
  }, [octave]);

  const play = useCallback((targetNote: string) => {
    const ac = getAudioContext();
    const buf = bufferRef.current;
    const g = gainRef.current;
    if (!buf || !g) return;

    const src = ac.createBufferSource();
    src.buffer = buf;

    const detune = midi(targetNote) - midi(baseNote);
    src.playbackRate.value = semitoneRatio(detune);

    src.connect(g);
    try { src.start(); } catch {}
  }, [baseNote]);

  // keyboard input
  useEffect(() => {
    const mapFirst: Record<string, number> = {
      a:0,w:1,s:2,e:3,d:4,f:5,t:6,g:7,y:8,h:9,u:10,j:11,
    };
    const mapSecond: Record<string, number> = { k:0,o:1,l:2,p:3,";":4,"'":5,"]":6,"\\" :7 };
    function onDown(e: KeyboardEvent) {
      if (!selected) return;
      const key = e.key.toLowerCase();
      if (mapFirst[key] !== undefined) {
        const n = noteName(mapFirst[key], octave);
        play(n);
      } else if (mapSecond[key] !== undefined) {
        const n = noteName(mapSecond[key], octave + 1);
        play(n);
      } else if (key === "z") setOctave(o => Math.max(OCTAVE_RANGE.min, o - 1));
      else if (key === "x") setOctave(o => Math.min(OCTAVE_RANGE.max, o + 1));
    }
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, [octave, play, selected]);

  const savePreset = () => {
    if (!selected || !onSave) return;
    const preset: PianoPreset = {
      id: Math.random().toString(36).slice(2, 10),
      name: presetName.trim() || selected.name,
      sample: selected,
      baseNote,
      volume,
    };
    onSave(preset);
  };

  return (
    <section className="glass rounded-2xl p-4 border border-white/10">
      {/* header & toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-gray-200">Piano</div>
          <div className="text-xs text-gray-400">Choose a sample and play / transpose</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={presetName}
            onChange={(e)=>setPresetName(e.target.value)}
            placeholder="New Piano Preset"
            className="rounded-md bg-white/10 border border-white/15 px-2 py-1 text-xs text-gray-100 outline-none"
          />
          <button
            onClick={savePreset}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-500/70 hover:bg-indigo-500 text-white transition"
          >
            Save Preset
          </button>
        </div>
      </div>

      {/* control bar */}
      <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3 overflow-visible">
        <div className="flex flex-wrap items-center gap-3">
          {/* Sample selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">Sample</span>
            <select
              value={selected?.id || ""}
              onChange={(e) => {
                const s = samples.find(x => x.id === e.target.value) || null;
                setSelected(s);
              }}
              className="piano-select w-64 rounded-md border border-white/15 bg-zinc-800/80 text-gray-100 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40"
            >
              <option value="" disabled>Select a sample…</option>
              {samples.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Base note */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">Base</span>
            <select
              value={baseNote}
              onChange={(e)=>setBaseNote(e.target.value)}
              className="piano-select w-24 rounded-md border border-white/15 bg-zinc-800/80 text-gray-100 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40"
            >
              {Array.from({length:3},(_,i)=>3+i).map(o=>(
                NOTES.filter(n=>!n.n.includes("#")).map(n=>{
                  const nn = `${n.n}${o}`;
                  return <option key={nn} value={nn}>{nn}</option>;
                })
              ))}
            </select>
          </div>

          {/* Octave */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300">Octave</span>
            <button
              onClick={()=>setOctave(o=>Math.max(OCTAVE_RANGE.min, o-1))}
              className="px-2 py-1 rounded-md bg-white/10 border border-white/15 text-sm text-gray-100"
            >–</button>
            <div className="w-8 text-center text-sm text-gray-100">{octave}</div>
            <button
              onClick={()=>setOctave(o=>Math.min(OCTAVE_RANGE.max, o+1))}
              className="px-2 py-1 rounded-md bg-white/10 border border-white/15 text-sm text-gray-100"
            >+</button>
          </div>

          {/* Volume (now inside the bar, right side if space) */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-300">Vol</span>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={volume}
              onChange={(e)=>setVolume(parseFloat(e.target.value))}
              className="w-28 accent-indigo-400"
            />
            <span className="w-8 text-right text-xs text-gray-400">{Math.round(volume*100)}</span>
          </div>
        </div>
      </div>

      {/* keyboard */}
      <div className="relative select-none">
        {/* white keys */}
        <div className="flex">
          {keys.filter(k=>!k.display.includes("#")).map(k => (
            <button
              key={k.label}
              onMouseDown={() => selected && play(k.label)}
              className="relative h-28 flex-1 border border-white/10 bg-white/90 hover:bg-white active:translate-y-[1px] rounded-b-md transition"
              title={`${k.label}`}
            >
              <span className="absolute bottom-1 left-1 text-[10px] text-gray-600/70">{k.display}</span>
            </button>
          ))}
        </div>

        {/* black keys overlay */}
        <div className="pointer-events-none absolute inset-0 flex">
          {/* For each white key slot, add a sharp between C-D, D-E, F-G, G-A, A-B */}
          {Array.from({ length: 14 }).map((_, idx) => {
            const pos = idx % 7;
            const hasSharp = [0,1,3,4,5].includes(pos);
            if (!hasSharp) return <div key={idx} className="flex-1 relative" />;
            // compute the sharp note label for the correct MIDI
            const whiteToSemitone: number[] = [0,2,4,5,7,9,11]; // C D E F G A B
            const baseOct = 4 + Math.floor(idx / 7); // align with our two octaves
            const sharpSemitone = (whiteToSemitone[pos] + 1) % 12;
            const label = noteName(sharpSemitone, baseOct);
            return (
              <div key={idx} className="flex-1 relative">
                <button
                  onMouseDown={() => selected && play(label)}
                  className="pointer-events-auto absolute -right-3 w-6 h-16 bg-black hover:bg-zinc-900 active:translate-y-[1px] border border-black/60 rounded-b-md shadow-md top-0"
                  title={label}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 text-[10px] text-gray-400">
        Keyboard: <span className="font-mono">A W S E D F T G Y H U J</span> (+ next row keys) •
        <span className="ml-1 font-mono">Z/X</span> to change octave.
      </div>

      {/* Force dark dropdown menu & options (native select) */}
      <style jsx global>{`
        .piano-select {
          color-scheme: dark; /* helps some browsers choose dark popups */
        }
        .piano-select option {
          background: #0c0d10;
          color: #e5e7eb;
        }
        /* Safari/Chrome dropdown panel tweak */
        select.piano-select:focus {
          outline: none;
        }
      `}</style>
    </section>
  );
}
