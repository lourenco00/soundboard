"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import PianoRoll, { Sample, PianoPreset } from "@/components/instruments/PianoRoll";

export default function PianoPage() {
  const sp = useSearchParams();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [presets, setPresets] = useState<PianoPreset[]>([]);
  const [selected, setSelected] = useState<PianoPreset | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const base = await fetch("/samples.manifest.json").then(r => r.json());
        const cats = (base?.categories ?? []) as { items: Sample[] }[];
        const mine = await fetch("/api/my-sounds").then(r => (r.ok ? r.json() : []));
        const flat = [
          ...(mine?.map((s: any) => ({ id: s.id, name: s.name, src: s.src })) ?? []),
          ...cats.flatMap((g) => g.items),
        ];
        setSamples(flat);
      } catch { setSamples([]); }
    })();
    fetch("/api/piano-presets").then(r=>r.ok?r.json():[]).then(setPresets).catch(()=>setPresets([]));
  }, []);

  // open by URL (?preset=ID)
  useEffect(() => {
    const id = sp.get("preset");
    if (!id) return;
    (async () => {
      const r = await fetch(`/api/piano-presets/${id}`);
      if (r.ok) setSelected(await r.json());
    })();
  }, [sp]);

  async function savePreset(p: PianoPreset) {
    await fetch("/api/piano-presets", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p),
    });
    setPresets(await fetch("/api/piano-presets").then(x=>x.json()));
  }

  async function deletePreset(id: string) {
    if (!confirm("Delete this preset?")) return;
    const r = await fetch(`/api/piano-presets/${id}`, { method: "DELETE" });
    if (r.ok) {
      setPresets(await fetch("/api/piano-presets").then(x=>x.json()));
      if (selected?.id === id) setSelected(null);
    }
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

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* quick preset chips with delete */}
        {presets.length > 0 && (
          <div className="glass rounded-2xl p-3 mb-4">
            <div className="text-sm text-gray-300 mb-2">My Piano Presets</div>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                  <button className="text-sm hover:underline" onClick={() => setSelected(p)}>{p.name}</button>
                  <span className="text-[11px] text-gray-500">• {p.sample?.name || "sample"} • {p.baseNote || "C4"}</span>
                  <button className="ml-2 text-red-400 hover:text-red-500" onClick={() => deletePreset(p.id)}>✕</button>
                </div>
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
