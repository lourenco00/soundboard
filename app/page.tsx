"use client";
import { useEffect, useState } from "react";
import Link from "next/link"; // ✅ added
import TopBar from "@/components/TopBar";
import Pad, { PadData } from "@/components/Pad";
import SampleList, { Group } from "@/components/SampleList";
import Paywall from "@/components/Paywall";
import BankTabs from "@/components/BankTabs";
import Mixer from "@/components/Mixer";
// import TimelineMix from "@/components/TimelineMix"; // (optional; not used in Mix tab per your request)
// import DawMixer from "@/components/DawMixer"; // ❌ removed

type Me = { plan: "FREE" | "PRO" };

const BASE_PADS = (deck: "A" | "B"): PadData[] => [
  { label: "Kick",  key: "a", deck },
  { label: "Snare", key: "s", deck },
  { label: "Hi-Hat",key: "d", deck },
  { label: "Clap",  key: "f", deck },
  { label: "Vox",   key: "g", deck },
  { label: "Pad 6", key: "h", deck },
  { label: "Pad 7", key: "j", deck },
  { label: "Pad 8", key: "k", deck },
  { label: "Pad 9", key: "l", deck },
];

type Preset = { bankA: PadData[]; bankB: PadData[]; bankC: PadData[] };
type Tab = "pads" | "mix";

export default function Page() {
  const [me, setMe] = useState<Me>({ plan: "FREE" });
  const [isAuthed, setIsAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("pads");

  const [bank, setBank] = useState<"A" | "B" | "C">("A");
  const [banks, setBanks] = useState<Preset>({
    bankA: BASE_PADS("A"),
    bankB: BASE_PADS("B"),
    bankC: BASE_PADS("A"),
  });
  const [soloMap, setSoloMap] = useState<Record<string, boolean>>({});
  const anySolo = Object.values(soloMap).some(Boolean);
  const [quantize, setQuantize] = useState(0);

  // plan + auth
  useEffect(() => {
    fetch("/api/entitlements").then(r => r.json()).then(setMe).catch(() => {});
    fetch("/api/me")
      .then(r => r.json())
      .then((d) => setIsAuthed(Boolean(d?.authenticated)))
      .catch(() => setIsAuthed(false));
  }, []);

  // grouped samples from manifest
  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => {
    fetch("/samples.manifest.json")
      .then(r => r.json())
      .then(json => setGroups(json.categories || []))
      .catch(() => setGroups([]));
  }, []);

  // seed bank A from common categories
  useEffect(() => {
    if (!groups.length) return;
    const pick = (needle: string) =>
      groups.find(g => g.id.toLowerCase().includes(needle))?.items?.[0];

    setBanks(prev => ({
      ...prev,
      bankA: prev.bankA.map(p => {
        const byKey: Record<string, string> = { a: "kick", s: "snare", d: "hihat", f: "clap", g: "vocals" };
        const cat = byKey[p.key];
        const chosen = cat ? pick(cat) : undefined;
        return chosen ? { ...p, label: chosen.name, src: chosen.src } : p;
      }),
    }));
  }, [groups]);

  // MIDI trigger (unchanged)
  useEffect(() => {
    if (!("requestMIDIAccess" in navigator)) return;
    (navigator as any).requestMIDIAccess().then((access: any) => {
      access.inputs.forEach((input: any) => {
        input.onmidimessage = (msg: any) => {
          const [status, note, vel] = msg.data;
          if ((status & 0xf0) === 0x90 && vel > 0) {
            const map = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
            const key = map[note % 9];
            window.dispatchEvent(new KeyboardEvent("keydown", { key }));
          }
        };
      });
    }).catch(() => {});
  }, []);

  function currentBank(): PadData[] {
    return bank === "A" ? banks.bankA : bank === "B" ? banks.bankB : banks.bankC;
  }
  function setCurrentBank(next: PadData[]) {
    setBanks(prev =>
      bank === "A" ? { ...prev, bankA: next } :
      bank === "B" ? { ...prev, bankB: next } :
                     { ...prev, bankC: next }
    );
  }

  function handleDropSample(targetKey: string, sample: { name: string; src: string }) {
    const next = currentBank().map(p => p.key === targetKey ? { ...p, label: sample.name, src: sample.src } : p);
    setCurrentBank(next);
  }

  function onSoloChange(key: string, solo: boolean) {
    setSoloMap(prev => ({ ...prev, [key]: solo }));
  }

  // presets
  function savePreset() { localStorage.setItem("sb_preset", JSON.stringify(banks)); }
  function loadPreset() { const raw = localStorage.getItem("sb_preset"); if (raw) try { setBanks(JSON.parse(raw)); } catch {} }
  function exportPreset() {
    const blob = new Blob([JSON.stringify(banks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "soundboard-preset.json"; a.click();
    URL.revokeObjectURL(url);
  }
  function importPreset(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    f.text().then(t => setBanks(JSON.parse(t))).catch(() => {});
  }

  const pads = currentBank();

  return (
    <main className="min-h-screen">
      <TopBar />

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-4 pt-5">
        <div className="glass rounded-2xl p-2 flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === "pads" ? "bg-white/15 text-white" : "text-gray-300 hover:bg-white/10"}`}
            onClick={() => setActiveTab("pads")}
          >
            Pads
          </button>

          {/* Mix tab navigates to /mix */}
          {isAuthed ? (
            <>
              <Link href="/daw" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">
                DAW
              </Link>
              <Link href="/sequencer" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">
                Step Seq
              </Link>
            </>
          ) : (
            <span className="ml-1 text-xs text-gray-400">
              <Link href="/login" className="underline hover:text-gray-300">
                DAW & Step Seq (log in to access)
              </Link>
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        {/* Sidebar Library (always shown) */}
        <div className="col-span-12 lg:col-span-3 h-[74vh]">
          <SampleList groups={groups} />
          {/* Presets (visible on this page) */}
          <div className="mt-4 glass rounded-2xl p-3 text-xs text-gray-500">
            <div className="font-semibold text-gray-700 mb-2">Presets</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost rounded-lg" onClick={savePreset}>Save</button>
              <button className="btn-ghost rounded-lg" onClick={loadPreset}>Load</button>
              <button className="btn-ghost rounded-lg" onClick={exportPreset}>Export</button>
              <label className="btn-ghost rounded-lg cursor-pointer">
                Import<input className="hidden" type="file" accept="application/json" onChange={importPreset} />
              </label>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {/* Pads-only UI on the main page */}
          <header className="glass rounded-2xl p-5 flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">Soundboard Lab - Pads Mode</h1>
              <p className="text-gray-500 text-sm mt-1">
                Drag from Library; pads use keys A S D F G H J K L. MIDI supported.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <BankTabs bank={bank} setBank={setBank} />
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <span>Quantize</span>
                <select
                  className="bg-white/80 rounded-md px-2 py-1"
                  value={quantize}
                  onChange={(e) => setQuantize(parseInt(e.target.value))}
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
              <Pad
                key={`${bank}-${p.key}`}
                data={p}
                quantizeMs={quantize}
                onDropSample={handleDropSample}
                onSoloChange={onSoloChange}
                soloActive={anySolo}
              />
            ))}
          </section>

          {/* Mixer (pads tab can still use it) */}
          <Mixer />

          {/* Optional timeline — comment in if you want it on Pads page */}
          {/* <TimelineMix /> */}

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
