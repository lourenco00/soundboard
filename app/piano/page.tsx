"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import PianoRoll, { Sample as PianoSample, PianoPreset } from "@/components/instruments/PianoRoll";
import SampleList, { Group as LibGroup, Sample as LibSample } from "@/components/SampleList";

// Avoid prerender for search params-driven UI
export const dynamic = "force-dynamic";

export default function PianoPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-6 text-sm text-gray-400">Loading piano…</div>}>
      <PianoClient />
    </Suspense>
  );
}

function PianoClient() {
  const sp = useSearchParams();

  // audio samples for the piano sampler
  const [samples, setSamples] = useState<PianoSample[]>([]);
  // saved piano presets
  const [presets, setPresets] = useState<PianoPreset[]>([]);
  const [selected, setSelected] = useState<PianoPreset | null>(null);

  // initial data
  useEffect(() => {
    (async () => {
      try {
        const base = await fetch("/samples.manifest.json").then(r => r.json());
        const cats = (base?.categories ?? []) as { items: PianoSample[] }[];
        const mine = await fetch("/api/my-sounds").then(r => (r.ok ? r.json() : []));
        const flat: PianoSample[] = [
          ...(mine?.map((s: any) => ({ id: s.id, name: s.name, src: s.src })) ?? []),
          ...cats.flatMap((g) => g.items),
        ];
        setSamples(flat);
      } catch { setSamples([]); }
    })();
    refreshPresets().catch(()=>{});
  }, []);

  // open by URL (?preset=ID)
  useEffect(() => {
    const id = sp.get("preset");
    if (!id) return;
    openPreset(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  async function refreshPresets() {
    const list = await fetch("/api/piano-presets").then(r=>r.ok?r.json():[]);
    setPresets(list ?? []);
  }

  async function openPreset(id: string) {
    const r = await fetch(`/api/piano-presets/${id}`);
    if (r.ok) setSelected(await r.json());
  }

  async function savePreset(p: PianoPreset) {
    const res = await fetch("/api/piano-presets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) {
      alert("Could not save preset. Please try again.");
      return;
    }
    await refreshPresets();
    // auto-select the newly saved preset
    setSelected(p);
  }

  async function deletePreset(id: string) {
    const r = await fetch(`/api/piano-presets/${id}`, { method: "DELETE" });
    if (r.ok) {
      await refreshPresets();
      if (selected?.id === id) setSelected(null);
    }
  }

  // ---- Side list groups (Audio Library + Piano Presets) ----
  const sideGroups: LibGroup[] = useMemo(() => {
    const audioItems: LibSample[] = (samples ?? []).map(s => ({
      id: s.id,
      name: s.name,
      src: s.src,
      kind: "audio",
    }));

    const presetItems: LibSample[] = (presets ?? []).map(p => ({
      id: p.id,
      name: p.name,
      kind: "piano",
      // no src needed; clicking will open the preset
    }));

    return [
      { id: "audio", name: "Samples", items: audioItems },
      { id: "piano-presets", name: "Piano Presets", items: presetItems },
    ];
  }, [samples, presets]);

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

      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: side library */}
        <div className="lg:col-span-4 xl:col-span-3 min-h-[480px]">
          <SampleList
            groups={sideGroups}
            defaultOpen
            onOpenPiano={(id) => openPreset(id)}
            onDeletePreset={(kind, id) => {
              if (kind !== "piano") return;
              if (!confirm("Delete this piano preset?")) return;
              deletePreset(id);
            }}
          />
        </div>

        {/* RIGHT: piano roll/sampler */}
        <div className="lg:col-span-8 xl:col-span-9">
          {/* Presets are listed in the side Library ("Piano Presets" group). */}
          <PianoRoll
            samples={samples}
            initialPreset={selected || undefined}
            onSavePreset={savePreset}
          />
        </div>
      </div>
    </main>
  );
}
