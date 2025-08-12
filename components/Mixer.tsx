"use client";
import { useEffect, useRef, useState } from "react";
import { getAudioContext, getMaster, setCrossfader } from "@/lib/audio";

export default function Mixer() {
  const [masterVol, setMasterVol] = useState(0.9);
  const [xf, setXf] = useState(0.5);
  const [bpm, setBpm] = useState(120);
  const ticking = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => { getMaster().then(m => m.output.gain.value = masterVol); }, []);
  useEffect(() => { getMaster().then(m => m.output.gain.value = masterVol); }, [masterVol]);
  useEffect(() => { setCrossfader(xf); }, [xf]);

  function startClick() {
    if (ticking.current) return;
    ticking.current = true;
    const ac = getAudioContext();
    const click = async () => {
      if (!ticking.current) return;
      const buf = await fetch("/sounds/click.wav").then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b.slice(0)));
      const src = ac.createBufferSource(); src.buffer = buf;
      const g = ac.createGain(); g.gain.value = 0.6;
      src.connect(g); g.connect(ac.destination); src.start();
    };
    const beat = () => {
      click();
      const ms = 60000 / bpm;
      timer.current = window.setTimeout(beat, ms) as unknown as number;
    };
    beat();
  }
  function stopClick() {
    ticking.current = false;
    if (timer.current) clearTimeout(timer.current);
  }

  return (
    <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Master</span>
        <input className="accent-indigo-500" type="range" min={0} max={1} step={0.01} value={masterVol} onChange={(e)=>setMasterVol(parseFloat(e.target.value))}/>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Crossfader A↔B</span>
        <input className="w-64 accent-indigo-500" type="range" min={0} max={1} step={0.01} value={xf} onChange={(e)=>setXf(parseFloat(e.target.value))}/>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">BPM</span>
        <input className="w-24 bg-white/10 rounded-md px-2 py-1" type="number" value={bpm} onChange={(e)=>setBpm(parseInt(e.target.value||"120"))}/>
        <button className="btn-ghost rounded-xl" onClick={startClick}>Start Metronome</button>
        <button className="btn-ghost rounded-xl" onClick={stopClick}>Stop</button>
      </div>
    </div>
  );
}