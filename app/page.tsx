"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import Pad, { PadData } from "@/components/Pad";
import SampleList, { Group } from "@/components/SampleList";
import Paywall from "@/components/Paywall";
import BankTabs from "@/components/BankTabs";
import Mixer from "@/components/Mixer";
import Landing from "@/components/Landing";

type Me = { plan: "FREE" | "PRO" };

const BASE_PADS = (deck: "A" | "B"): PadData[] => [
  { label: "Kick",   key: "a", deck },
  { label: "Snare",  key: "s", deck },
  { label: "Hi-Hat", key: "d", deck },
  { label: "Clap",   key: "f", deck },
  { label: "Vox",    key: "g", deck },
  { label: "Pad 6",  key: "h", deck },
  { label: "Pad 7",  key: "j", deck },
  { label: "Pad 8",  key: "k", deck },
  { label: "Pad 9",  key: "l", deck },
];

type Preset = { bankA: PadData[]; bankB: PadData[]; bankC: PadData[] };

export default function Page() {
  const [me, setMe] = useState<Me>({ plan: "FREE" });
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  const [bank, setBank] = useState<"A" | "B" | "C">("A");
  const [banks, setBanks] = useState<Preset>({
    bankA: BASE_PADS("A"),
    bankB: BASE_PADS("B"),
    bankC: BASE_PADS("A"),
  });
  const [soloMap, setSoloMap] = useState<Record<string, boolean>>({});
  const anySolo = Object.values(soloMap).some(Boolean);
  const [quantize, setQuantize] = useState(0);
  const [bpm, setBpm] = useState(124);
  const [forgeQueue, setForgeQueue] = useState<{ name: string; src: string }[]>([]);

  useEffect(() => {
    fetch("/api/entitlements").then(r => r.json()).then(setMe).catch(() => {});
    fetch("/api/me")
      .then(r => r.json())
      .then((d) => setIsAuthed(Boolean(d?.authenticated)))
      .catch(() => setIsAuthed(false));
  }, []);

  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => {
    fetch("/samples.manifest.json")
      .then(r => r.json())
      .then(json => setGroups(json.categories || []))
      .catch(() => setGroups([]));
  }, []);

  // pick up AI Forge queue from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("sb_forge_queue");
      if (raw) setForgeQueue(JSON.parse(raw));
    } catch {}
  }, []);

  // seed bank A
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

  // MIDI trigger
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

  // surface forge generations as a virtual "AI Forge" group at the top of the library
  const forgeGroup: Group | null = forgeQueue.length
    ? {
        id: "forge",
        name: "🤖 AI Forge",
        items: forgeQueue.map((q, i) => ({
          id: `forge-${i}`,
          name: q.name,
          src: q.src,
          kind: "audio" as const,
        })),
      }
    : null;
  const allGroups: Group[] = forgeGroup ? [forgeGroup, ...groups] : groups;

  const pads = currentBank();
  const totalAssigned = pads.filter(p => p.src).length;

  // loading shell while we don't know auth yet
  if (isAuthed === null) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <div className="flex items-center justify-center py-32">
          <div className="flex items-center gap-3 text-gray-400">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            Loading studio…
          </div>
        </div>
      </main>
    );
  }

  // landing for unauthenticated visitors
  if (!isAuthed) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <Landing />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <TopBar />

      {/* Quick-action bar */}
      <div className="mx-auto max-w-7xl px-4 pt-5">
        <div className="glass rounded-2xl p-3 flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-lg text-sm bg-white/15 text-white flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Pads
          </span>
          <Link href="/daw" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">DAW</Link>
          <Link href="/sequencer" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">Step Seq</Link>
          <Link href="/piano" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">Piano</Link>
          <Link href="/ai" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2">
            AI Forge <span className="pro-badge">New</span>
          </Link>

          <span className="ml-auto text-xs text-gray-400 hidden md:inline">
            Tip — press <kbd className="font-mono bg-black/40 border border-white/15 rounded px-1 mx-0.5">A</kbd>
            <kbd className="font-mono bg-black/40 border border-white/15 rounded px-1 mx-0.5">S</kbd>
            <kbd className="font-mono bg-black/40 border border-white/15 rounded px-1 mx-0.5">D</kbd>
            … <kbd className="font-mono bg-black/40 border border-white/15 rounded px-1 mx-0.5">L</kbd>
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        {/* Sidebar Library */}
        <div className="col-span-12 lg:col-span-3 h-[74vh]">
          <SampleList groups={allGroups} />
          <div className="mt-4 glass rounded-2xl p-3 text-xs text-gray-300">
            <div className="font-semibold text-gray-100 mb-2">Presets</div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost rounded-lg" onClick={savePreset}>💾 Save</button>
              <button className="btn-ghost rounded-lg" onClick={loadPreset}>📂 Load</button>
              <button className="btn-ghost rounded-lg" onClick={exportPreset}>⬇ Export</button>
              <label className="btn-ghost rounded-lg cursor-pointer text-center">
                ⬆ Import
                <input className="hidden" type="file" accept="application/json" onChange={importPreset} />
              </label>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {/* Studio header */}
          <header className="glass-strong rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-16 w-72 h-72 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-violet-300 mb-1">Pads · Bank {bank}</div>
                <h1 className="text-2xl font-bold">Studio</h1>
                <p className="text-gray-400 text-sm mt-1">
                  {totalAssigned}/9 pads loaded · Drag samples from the Library or generate with AI Forge.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <BankTabs bank={bank} setBank={setBank} />
                <div className="glass rounded-xl px-3 py-2 flex items-center gap-3 text-sm">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400">BPM</span>
                  <button
                    className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 text-sm"
                    onClick={() => setBpm(b => Math.max(60, b - 1))}
                  >−</button>
                  <span className="font-mono w-10 text-center">{bpm}</span>
                  <button
                    className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 text-sm"
                    onClick={() => setBpm(b => Math.min(220, b + 1))}
                  >+</button>
                </div>
                <div className="glass rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400">Quantize</span>
                  <select
                    className="bg-transparent outline-none text-sm"
                    value={quantize}
                    onChange={(e) => setQuantize(parseInt(e.target.value))}
                  >
                    <option value={0}>Off</option>
                    <option value={125}>1/8</option>
                    <option value={250}>1/4</option>
                    <option value={500}>1/2</option>
                  </select>
                </div>
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

          {/* Mixer */}
          <Mixer />

          {me.plan === "FREE" && (
            <div className="glass-strong rounded-2xl p-6">
              <Paywall title="Unlock the full studio" />
            </div>
          )}
        </div>
      </div>

      <footer className="text-center text-[11px] text-gray-500 py-6">
        Tip · use the crossfader with Deck A/B to blend banks or route specific pads.
      </footer>
    </main>
  );
}
