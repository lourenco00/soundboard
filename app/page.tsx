"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import Pad, { PadData } from "@/components/Pad";
import SampleList from "@/components/SampleList";
import Paywall from "@/components/Paywall";
import BankTabs from "@/components/BankTabs";
import Mixer from "@/components/Mixer";

type Me = { plan: "FREE" | "PRO" };

const BASE_PADS = (deck:"A"|"B"): PadData[] => [
  { label: "Kick",  key: "a", src: "/sounds/kick.wav",  deck },
  { label: "Snare", key: "s", src: "/sounds/snare.wav", deck },
  { label: "Hi-Hat",key: "d", src: "/sounds/hat.wav",   deck },
  { label: "Clap",  key: "f", src: "/sounds/clap.wav",  deck },
  { label: "Vox",   key: "g", src: "/sounds/vox.wav",   deck },
  { label: "Pad 6", key: "h", deck },
  { label: "Pad 7", key: "j", deck },
  { label: "Pad 8", key: "k", deck },
  { label: "Pad 9", key: "l", deck },
];

const LIBRARY = [
  { id: "kick",  name: "Kick (909)", src: "/sounds/kick.wav",  length: "0:01" },
  { id: "snare", name: "Snare (808)",src: "/sounds/snare.wav", length: "0:01" },
  { id: "hat",   name: "Hi‑Hat",     src: "/sounds/hat.wav",   length: "0:01" },
  { id: "clap",  name: "Clap",       src: "/sounds/clap.wav",  length: "0:01" },
  { id: "vox",   name: "Vocal Hit",  src: "/sounds/vox.wav",   length: "0:01" },
];

type Preset = { bankA: PadData[]; bankB: PadData[]; bankC: PadData[] };

export default function Page() {
  const [me, setMe] = useState<Me>({ plan: "FREE" });
  const [bank, setBank] = useState<"A"|"B"|"C">("A");
  const [banks, setBanks] = useState<Preset>({
    bankA: BASE_PADS("A"),
    bankB: BASE_PADS("B"),
    bankC: BASE_PADS("A"),
  });
  const [soloMap, setSoloMap] = useState<Record<string, boolean>>({});
  const anySolo = Object.values(soloMap).some(Boolean);

  const [quantize, setQuantize] = useState(0); // ms; set 0 for off; try 125 for 120bpm 1/8th

  useEffect(() => { fetch("/api/entitlements").then(r=>r.json()).then(setMe).catch(()=>{}); }, []);

  // MIDI: trigger pads by MIDI note (C3=48 → a, 49→s, etc.)
  useEffect(() => {
    if (!("requestMIDIAccess" in navigator)) return;
    (navigator as any).requestMIDIAccess().then((access:any)=> {
      access.inputs.forEach((input:any) => {
        input.onmidimessage = (msg:any) => {
          const [status, note, vel] = msg.data;
          if ((status & 0xf0) === 0x90 && vel > 0) {
            const map = ["a","s","d","f","g","h","j","k","l"];
            const idx = (note % 9);
            const key = map[idx];
            const b = currentBank();
            const pad = b.find(p => p.key === key);
            if (pad) {
              // simulate keyboard press
              window.dispatchEvent(new KeyboardEvent("keydown",{key}));
            }
          }
        };
      });
    }).catch(()=>{});
  }, []);

  function currentBank(): PadData[] {
    return bank === "A" ? banks.bankA : bank === "B" ? banks.bankB : banks.bankC;
  }
  function setCurrentBank(next: PadData[]) {
    setBanks(prev => bank === "A" ? { ...prev, bankA: next } :
                     bank === "B" ? { ...prev, bankB: next } :
                                    { ...prev, bankC: next });
  }

  function handleDropSample(targetKey: string, sample: { name: string; src: string }) {
    const next = currentBank().map(p => p.key === targetKey ? { ...p, label: sample.name, src: sample.src } : p);
    setCurrentBank(next);
  }

  function onSoloChange(key: string, solo: boolean) {
    setSoloMap(prev => ({ ...prev, [key]: solo }));
  }

  // Presets
  function savePreset() {
    const obj: Preset = banks;
    localStorage.setItem("sb_preset", JSON.stringify(obj));
  }
  function loadPreset() {
    const raw = localStorage.getItem("sb_preset");
    if (!raw) return;
    try { setBanks(JSON.parse(raw)); } catch {}
  }
  function exportPreset() {
    const blob = new Blob([JSON.stringify(banks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "soundboard-preset.json"; a.click();
    URL.revokeObjectURL(url);
  }
  function importPreset(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    f.text().then(t => setBanks(JSON.parse(t))).catch(()=>{});
  }

  const pads = currentBank();

  return (
    <main className="min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        {/* Sidebar Library */}
        <div className="col-span-12 lg:col-span-3 h-[74vh]">
          <SampleList samples={LIBRARY} />
          <div className="mt-4 glass rounded-2xl p-3 text-xs text-gray-400">
            <div className="font-semibold text-gray-300 mb-2">Presets</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost rounded-lg" onClick={savePreset}>Save</button>
              <button className="btn-ghost rounded-lg" onClick={loadPreset}>Load</button>
              <button className="btn-ghost rounded-lg" onClick={exportPreset}>Export</button>
              <label className="btn-ghost rounded-lg cursor-pointer">
                Import<input className="hidden" type="file" accept="application/json" onChange={importPreset}/>
              </label>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          <header className="glass rounded-2xl p-5 flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">Pro Soundboard — DJ Mode</h1>
              <p className="text-gray-400 text-sm mt-1">Pads respond to keys A S D F G H J K L. Drag from Library. MIDI supported.</p>
            </div>
            <div className="flex items-center gap-3">
              <BankTabs bank={bank} setBank={setBank} />
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <span>Quantize</span>
                <select className="bg-white/10 rounded-md px-2 py-1"
                        value={quantize}
                        onChange={(e)=>setQuantize(parseInt(e.target.value))}
                >
                  <option value={0}>Off</option>
                  <option value={125}>1/8 (120bpm)</option>
                  <option value={250}>1/4</option>
                  <option value={500}>1/2</option>
                </select>
              </div>
            </div>
          </header>

          {/* Pads */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pads.map((p) => (
              <Pad key={`${bank}-${p.key}`}
                   data={p}
                   quantizeMs={quantize}
                   onDropSample={handleDropSample}
                   onSoloChange={onSoloChange}
                   soloActive={anySolo} />
            ))}
          </section>

          {/* Mixer / transport */}
          <Mixer />

          {/* Pro upsell example remains */}
          {me.plan === "FREE" && (
            <div className="glass rounded-2xl p-5">
              <Paywall title="Unlock higher upload limits, more banks, and longer recordings" />
            </div>
          )}
        </div>
      </div>

      <footer className="text-center text-[11px] text-gray-500 py-6">
        Tip: use the crossfader with Deck A/B to blend banks or route specific pads.
      </footer>
    </main>
  );
}