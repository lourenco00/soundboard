"use client";
import { useEffect, useState } from "react";
import { getAudioContext, getMaster, setCrossfader, setMasterVolume } from "@/lib/audio";

export default function Mixer() {
  const [masterVol, setMasterVol] = useState(0.9);
  const [xf, setXf] = useState(0.5);

  // Ensure graph exists on mount, then apply initial values
  useEffect(() => {
    getMaster().then(() => {
      setMasterVolume(masterVol);
      setCrossfader(xf);
      // iOS/Chrome autoplay guards
      try { getAudioContext().resume(); } catch {}
    });
  }, []);

  useEffect(() => { setMasterVolume(masterVol); }, [masterVol]);
  useEffect(() => { setCrossfader(xf); }, [xf]);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="grid grid-cols-12 gap-4 items-center">
        <div className="col-span-12 md:col-span-6">
          <div className="text-xs text-gray-400 mb-1">Master</div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={masterVol}
            onChange={e => setMasterVol(parseFloat(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <div className="text-xs text-gray-400 mb-1">Crossfader (A ↔ B)</div>
          <input
            type="range" min={0} max={1} step={0.001}
            value={xf}
            onChange={e => setXf(parseFloat(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>
      </div>
    </div>
  );
}
