"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import PianoRoll, { Sample, PianoPreset } from "@/components/instruments/PianoRoll";

export default function PianoPage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selected, setSelected] = useState<PianoPreset | null>(null);
  const [presets, setPresets] = useState<PianoPreset[]>([]);

  // gather samples (flatten manifest + my-sounds)
  useEffect(() => {
    (async () => {
      try {
        const base = await fetch("/samples.manifest.json").then(r => r.json());
        const cats = (base?.categories ?? []) as { items: Sample[] }[];
        const mine = await fetch("/api/my-sounds").then(r => (r.ok ? r.json() : []));
        const flat = [
          ...(mine?.map((s: any) => ({ id: s.id, name: s.name, src: s.src })) ?? []),
          ...cats.flatMap(g => g.items),
        ];
        setSamples(flat);
      } catch { setSamples([]); }
    })();
  }, []);

  // presets API
  useEffect(() => {
    fetch("/api/piano-presets")
      .then(r => (r.ok ? r.json() : []))
      .then(setPresets)
      .catch(() => setPresets([]));
  }, []);

  async function savePreset(p: PianoPreset) {
    await fetch("/api/piano-presets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    setPresets(await fetch("/api/piano-presets").then(x => x.json()));
  }

  return (
    <main className="min-h-screen">
      <TopBar />

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-4 pt-5">
        <div className="glass rounded-2xl p-2 flex items-center gap-3">
          <Link href="/" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">Pads</Link>
          <Link href="/daw" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">DAW</Link>
          <Link href="/sequencer" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">Step Seq</Link>
          <span className="px-3 py-1.5 rounded-lg text-sm bg-white/15 text-white">Piano</span>
        </div>
      </div>

      {/* Instrument — full width */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* (Optional) quick presets strip — remove if you want only the instrument */}
        {presets.length > 0 && (
          <div className="glass rounded-2xl p-3 mb-4">
            <div className="text-sm text-gray-300 mb-2">My Piano Presets</div>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <span key={p.id} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm">
                  {p.name} • {p.sample?.name || "sample"} • {p.baseNote || "C4"}
                </span>
              ))}
            </div>
          </div>
        )}

        <PianoRoll
          samples={samples}
          initialPreset={selected || undefined}
          onSavePreset={savePreset}
        />
      </div>
    </main>
  );
}
