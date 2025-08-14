"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

// ✅ your existing shared components
import TopBar from "@/components/TopBar";
import SampleList, { type Group } from "@/components/SampleList";

// ✅ the split mixer you already created in /app/daw/components
import DawMixer from "./components/DawMixer";

export default function DawPage() {
  // load real sample groups from your manifest (same as app/page)
  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => {
    fetch("/samples.manifest.json")
      .then((r) => r.json())
      .then((json) => setGroups(json.categories || []))
      .catch(() => setGroups([]));
  }, []);

  // (optional) client search here if you later add a filter box
  const [q, setQ] = useState("");
  const filtered: Group[] = useMemo(() => {
    if (!q.trim()) return groups;
    const needle = q.toLowerCase();
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.name.toLowerCase().includes(needle)) }))
      .filter((g) => g.items.length > 0);
  }, [q, groups]);

  return (
    <main className="min-h-screen">
      {/* ✅ same top bar as your homepage (second screenshot) */}
      <TopBar />

      {/* Tabs header (Pads + DAW) matching your app/page look & feel */}
      <div className="mx-auto max-w-7xl px-4 pt-5">
        <div className="glass rounded-2xl p-2 flex items-center gap-2">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10"
          >
            Pads
          </Link>
          <span className="px-3 py-1.5 rounded-lg text-sm bg-white/15 text-white">
            DAW
          </span>
          <Link href="/sequencer" className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10">
                Step Seq
          </Link>
          <Link
            href="/piano"
            className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10"
          >
            Piano
          </Link>

        </div>
      </div>

      {/* Main content: Library (left) + Mixer (right) */}
      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        {/* Left: your actual Library list component */}
        <aside className="col-span-12 lg:col-span-3 h-[74vh]">
          {/* If you want a search input above SampleList, uncomment: */}
          {/* <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search samples…"
            className="w-full mb-3 rounded-lg bg-white/10 border border-white/10 text-white/90 placeholder-white/40 px-3 py-2 outline-none focus:border-indigo-400/60"
          /> */}
          <SampleList groups={filtered} />
        </aside>

        {/* Right: DAW mixer (your split component) */}
        <section className="col-span-12 lg:col-span-9 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm text-white/70 mb-2">
              Mix view: drag samples from the Library onto the timeline. Click the waveform to move the playhead.
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <DawMixer />
            </div>
          </div>
        </section>
      </div>

      <footer className="text-center text-[11px] text-gray-500 py-6" />
    </main>
  );
}
