import React from "react";

type Props = {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  cursorLabel: string;

  pxPerSec: number;
  setPxPerSec: (v: number) => void;
  bpm: number;
  setBpm: (v: number) => void;
  quant: "1/4" | "1/8" | "1/16" | "1/32";
  setQuant: (v: "1/4" | "1/8" | "1/16" | "1/32") => void;
  snap: boolean;
  setSnap: (v: boolean) => void;

  master: number;
  setMaster: (v: number) => void;

  isRec: boolean;
  startRecord: () => void;
  stopRecord: () => void;
  recUrl: string | null;
};

export default function Transport(props: Props) {
  const {
    isPlaying, onPlay, onPause, onStop, cursorLabel,
    pxPerSec, setPxPerSec, bpm, setBpm, quant, setQuant, snap, setSnap,
    master, setMaster, isRec, startRecord, stopRecord, recUrl
  } = props;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-2">
        {!isPlaying ? (
          <button className="btn-ghost rounded-lg px-3" onClick={onPlay}>▶</button>
        ) : (
          <button className="btn-ghost rounded-lg px-3" onClick={onPause}>⏸</button>
        )}
        <button className="btn-ghost rounded-lg px-3" onClick={onStop}>■</button>
      </div>

      <div className="text-sm text-gray-300">
        Cursor: <span className="font-mono">{cursorLabel}</span>
      </div>

      <label className="text-sm text-gray-300 flex items-center gap-2">
        Zoom
        <input
          type="range" min={60} max={400} step={5} value={pxPerSec}
          onChange={(e)=>setPxPerSec(parseInt(e.target.value))}
          className="accent-indigo-500 w-40"
        />
      </label>

      <label className="text-sm text-gray-300 flex items-center gap-2">
        BPM
        <input
          type="number" min={60} max={200} value={bpm}
          onChange={(e)=>setBpm(parseInt(e.target.value || "120"))}
          className="bg-white/10 rounded-md px-2 py-1 w-20"
        />
      </label>

      <label className="text-sm text-gray-300 flex items-center gap-2">
        Grid
        <select
          className="bg-white/10 rounded-md px-2 py-1"
          value={quant}
          onChange={(e)=>setQuant(e.target.value as typeof quant)}
        >
          <option value="1/4">1/4 (quarters)</option>
          <option value="1/8">1/8 (eighths)</option>
          <option value="1/16">1/16</option>
          <option value="1/32">1/32</option>
        </select>
      </label>

      <label className="text-sm text-gray-300 flex items-center gap-2">
        <input type="checkbox" checked={snap} onChange={(e)=>setSnap(e.target.checked)}/>
        Snap to beat
      </label>

      <label className="text-sm text-gray-300 flex items-center gap-2 ml-auto">
        Master
        <input
          type="range" min={0} max={1} step={0.01} value={master}
          onChange={(e)=>setMaster(parseFloat(e.target.value))}
          className="accent-indigo-500 w-40"
        />
      </label>

      {!isRec ? (
        <button className="btn-primary rounded-lg" onClick={startRecord}>● Record</button>
      ) : (
        <button className="btn-ghost rounded-lg" onClick={stopRecord}>■ Stop</button>
      )}
      {recUrl && <a className="btn-ghost rounded-lg" href={recUrl} download="mix.webm">Download</a>}
    </div>
  );
}
