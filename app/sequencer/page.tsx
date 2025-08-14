"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import SampleList, { Group } from "@/components/SampleList";
import StepSequencer from "@/components/StepSequencer";

type Beat = any;

export default function SequencerPage() {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [selected, setSelected] = useState<Beat | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isAuthed, setIsAuthed] = useState(false);

  // auth light check (for tabs copy)
  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => setIsAuthed(Boolean(d?.authenticated))).catch(()=>{});
  }, []);

  // load saved beats
  useEffect(() => {
    fetch("/api/beats").then(r => r.ok ? r.json() : []).then(setBeats).catch(()=> setBeats([]));
  }, []);

  // sample manifest + my sounds
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const base = await fetch("/samples.manifest.json").then(r => r.json());
        const cats: Group[] = base.categories || [];
        const mine = await fetch("/api/my-sounds").then(r => r.ok ? r.json() : []);
        if (Array.isArray(mine) && mine.length) {
          cats.unshift({
            id: "my-beats",
            name: "My Beats",
            items: mine.map((s: any) => ({ id: s.id, name: s.name, src: s.src }))
          });
        }
        if (mounted) setGroups(cats);
      } catch { if (mounted) setGroups([]); }
    })();
    return () => { mounted = false; };
  }, []);

  async function openBeat(id: string) {
    const r = await fetch(`/api/beats/${id}`);
    if (r.ok) setSelected(await r.json());
  }

  async function deleteBeat(id: string) {
    if (!confirm("Delete this beat?")) return;
    const r = await fetch(`/api/beats/${id}`, { method: "DELETE" });
    if (r.ok) {
      setSelected(null);
      const list = await fetch("/api/beats").then(x => x.json());
      setBeats(list);
    }
  }

  return (
    <main className="min-h-screen">
      <TopBar />

      {/* Top tabs (same register as Pads page) */}
      <div className="mx-auto max-w-7xl px-4 pt-5">
        <div className="glass rounded-2xl p-2 flex items-center gap-3">
          <Link href="/" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">Pads</Link>
          <Link href="/daw" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">DAW</Link>
          <span className="px-3 py-1.5 rounded-lg text-sm bg-white/15 text-white">Step Seq</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        {/* LEFT: Library + My Beats list */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">My Beats</h2>
              <button className="btn-ghost rounded px-2 py-1"
                onClick={async () => setBeats(await fetch("/api/beats").then(r => r.json()))}>
                Refresh
              </button>
            </div>
            <div className="space-y-1">
              {beats.length === 0 && (
                <div className="text-xs text-gray-500">No beats yet. Create on the right →</div>
              )}
              {beats.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <button className="hover:underline" onClick={() => openBeat(b.id)}>{b.name}</button>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">{b.bpm}bpm • {b.steps}s</span>
                    <button className="text-red-400 hover:text-red-500" onClick={() => deleteBeat(b.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sample Library (draggable) */}
          <div className="glass rounded-2xl p-3">
            <h3 className="font-semibold mb-2">Library</h3>
            {/* NOTE: SampleList already renders draggable items.
               Ensure each item has draggable and sets dataTransfer as JSON:
               dataTransfer.setData("application/x-sample", JSON.stringify({name, src})); */}
            <SampleList groups={groups} />
          </div>
        </aside>

        {/* RIGHT: Sequencer */}
        <section className="col-span-12 lg:col-span-8">
          <StepSequencer
            initial={selected || undefined}
            onSendToDAW={() => {}}
          />
        </section>
      </div>
    </main>
  );
}
