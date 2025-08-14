"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import SampleList, { Group } from "@/components/SampleList";
import StepSequencer from "@/components/StepSequencer";

type Beat = any;

// Avoid prerender for search params-driven UI
export const dynamic = "force-dynamic";

export default function SequencerPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-6 text-sm text-gray-400">Loading sequencer…</div>}>
      <SequencerClient />
    </Suspense>
  );
}

function SequencerClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [beats, setBeats] = useState<Beat[]>([]);
  const [selected, setSelected] = useState<Beat | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    fetch("/api/beats").then(r => r.ok ? r.json() : []).then(setBeats).catch(()=> setBeats([]));
  }, []);

  // open beat from URL (?beat=ID)
  useEffect(() => {
    const id = sp.get("beat");
    if (!id) return;
    (async () => {
      const r = await fetch(`/api/beats/${id}`);
      if (r.ok) setSelected(await r.json());
    })();
  }, [sp]);

  // library with presets
  async function loadLibrary() {
    try {
      const base = await fetch("/samples.manifest.json").then(r => r.json());
      const cats: Group[] = base.categories || [];
      const presets = await fetch("/api/presets").then(r => r.ok ? r.json() : { folders: [], items: [] });

      const byFolder: Record<string, any[]> = {};
      (presets.items || []).forEach((p: any) => {
        (byFolder[p.folder || "(Unsorted)"] ||= []).push(p);
      });

      const presetGroups: Group[] = Object.keys(byFolder).sort().map(folderName => ({
        id: `presets-${folderName}`,
        name: `Presets / ${folderName}`,
        items: byFolder[folderName].map((p: any) => ({
          id: p.id,
          name: p.name,
          kind: p.kind, // "step" | "piano"
        })),
      }));

      setGroups([...presetGroups, ...cats]);
    } catch {
      setGroups([]);
    }
  }
  useEffect(() => { loadLibrary(); }, []);

  function openBeat(id: string) {
    router.push(`/sequencer?beat=${encodeURIComponent(id)}`);
  }
  async function deletePreset(kind: "step" | "piano", id: string) {
    if (!confirm("Delete this preset?")) return;
    const url = kind === "step" ? `/api/beats/${id}` : `/api/piano-presets/${id}`;
    const r = await fetch(url, { method: "DELETE" });
    if (r.ok) {
      if (kind === "step") setBeats(await fetch("/api/beats").then(x => x.json()).catch(()=>[]));
      loadLibrary();
      if (selected?.id === id && kind === "step") setSelected(null);
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
          <span className="px-3 py-1.5 rounded-lg text-sm bg-white/15 text-white">Step Seq</span>
          <Link href="/piano" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">Piano</Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        {/* LEFT */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">My Beats</h2>
              <button className="btn-ghost rounded px-2 py-1" onClick={async () => setBeats(await fetch("/api/beats").then(r => r.json()))}>
                Refresh
              </button>
            </div>
            <div className="space-y-1">
              {beats.length === 0 && <div className="text-xs text-gray-500">No beats yet. Create on the right →</div>}
              {beats.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <button className="hover:underline" onClick={() => openBeat(b.id)}>{b.name}</button>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">{b.bpm}bpm • {b.steps}s</span>
                    <button className="text-red-400 hover:text-red-500" onClick={() => deletePreset("step", b.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Library</h3>
              <button
                className="text-[12px] text-gray-300 hover:text-white"
                onClick={async () => {
                  const name = prompt("New Preset Folder name:");
                  if (!name) return;
                  await fetch("/api/preset-folders", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ name }),
                  });
                  loadLibrary();
                }}
              >
                + Folder
              </button>
            </div>

            <SampleList
              groups={groups}
              onOpenStep={(id) => openBeat(id)}
              onOpenPiano={(id) => { window.location.href = `/piano?preset=${encodeURIComponent(id)}`; }}
              onDeletePreset={(kind, id) => deletePreset(kind as any, id)}
            />
          </div>
        </aside>

        {/* RIGHT */}
        <section className="col-span-12 lg:col-span-8">
          <StepSequencer
            key={selected?.id || "new"}
            initial={selected || undefined}
            onSendToDAW={() => {}}
          />
        </section>
      </div>
    </main>
  );
}
