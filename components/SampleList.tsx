"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAudioContext, getMaster } from "@/lib/audio";

export type Sample = {
  id: string;
  name: string;
  src?: string;                    // optional for presets
  kind?: "audio" | "step" | "piano";
  folder?: string;
};
export type Group  = { id: string; name: string; items: Sample[] };

const PAGE_SIZE = 8;

export default function SampleList({
  groups,
  onOpenStep,
  onOpenPiano,
  onDeletePreset,
  defaultOpen = false,
  pageSize = PAGE_SIZE,
}: {
  groups: Group[];
  onOpenStep?: (id: string) => void;
  onOpenPiano?: (id: string) => void;
  onDeletePreset?: (kind: "step" | "piano", id: string) => void;
  defaultOpen?: boolean;
  pageSize?: number;
}) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState<Record<string, number>>({});
  const [activeCats, setActiveCats] = useState<string[]>([]); // empty = show all categories

  const previewRef = useRef<{ el: HTMLAudioElement | null; src?: MediaElementAudioSourceNode; gain?: GainNode } | null>(null);

  async function playPreview(src?: string) {
    if (!src) return;
    try { getAudioContext().resume(); } catch {}
    const { master } = await getMaster();

    if (previewRef.current?.el) try { previewRef.current.el.pause(); } catch {}
    try { previewRef.current?.src?.disconnect(); previewRef.current?.gain?.disconnect(); } catch {}

    const el = new Audio(encodeURI(src));
    el.preload = "auto"; el.crossOrigin = "anonymous";
    const ac = getAudioContext();
    const srcNode = ac.createMediaElementSource(el);
    const gain = ac.createGain(); gain.gain.value = 0.9;
    srcNode.connect(gain).connect(master);
    previewRef.current = { el, src: srcNode, gain };
    el.currentTime = 0; el.play().catch(()=>{});
    el.onended = () => { try { srcNode.disconnect(); gain.disconnect(); } catch {}; previewRef.current = null; };
  }

  // Category filter (chips) applied before the free-text search.
  const byCategory = useMemo(() => {
    if (!activeCats.length) return groups;
    return groups.filter(g => activeCats.includes(g.id));
  }, [groups, activeCats]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return byCategory;
    return byCategory
      .map(g => ({ ...g, items: g.items.filter(it => it.name.toLowerCase().includes(term) || it.id.toLowerCase().includes(term)) }))
      .filter(g => g.items.length > 0);
  }, [byCategory, q]);

  // Reset pagination whenever the visible set of items could have shifted,
  // so a stale page number never strands the user on an empty page.
  useEffect(() => { setPage({}); }, [q, activeCats]);

  function toggleCategory(id: string) {
    setActiveCats(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));
  }

  function expandAll() {
    setExpanded(Object.fromEntries(filtered.map(g => [g.id, true])));
  }
  function collapseAll() {
    setExpanded(Object.fromEntries(filtered.map(g => [g.id, false])));
  }

  return (
    <aside className="glass rounded-2xl p-3 h-full flex flex-col border border-white/10">
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-gray-200">Library</div>
          <div className="flex items-center gap-2 text-[11px]">
            <button onClick={expandAll} className="text-gray-400 hover:text-white transition">Expand all</button>
            <span className="text-gray-600">·</span>
            <button onClick={collapseAll} className="text-gray-400 hover:text-white transition">Collapse all</button>
          </div>
        </div>
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Search samples…"
          className="mt-2 w-full rounded-lg border border-white/15 bg-white/12 px-3 py-2 text-[13px] text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-400/40"
        />

        {groups.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {groups.map(g => {
              const active = activeCats.includes(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleCategory(g.id)}
                  title={activeCats.length ? "Click to toggle this category" : "Click to filter to just this category"}
                  className={`text-[10px] px-2 py-1 rounded-full border transition ${
                    active
                      ? "bg-indigo-400/20 border-indigo-300/40 text-indigo-100"
                      : "bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10"
                  }`}
                >
                  {g.name} <span className="opacity-60">({g.items.length})</span>
                </button>
              );
            })}
            {activeCats.length > 0 && (
              <button
                onClick={() => setActiveCats([])}
                className="text-[10px] px-2 py-1 rounded-full border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10 transition"
              >
                Clear ✕
              </button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-y-auto min-h-0 flex-1 pr-0.5 space-y-3">
        {filtered.map(group => {
          const isOpen = expanded[group.id] ?? defaultOpen;
          const total = group.items.length;
          const pageCount = Math.max(1, Math.ceil(total / pageSize));
          const current = Math.min(page[group.id] ?? 1, pageCount);
          const pageItems = group.items.slice((current - 1) * pageSize, current * pageSize);

          return (
            <div key={group.id}>
              <div
                className="text-[11px] tracking-wider font-bold text-gray-300 mb-1 flex items-center justify-between cursor-pointer hover:text-white transition"
                onClick={() => setExpanded(prev => ({ ...prev, [group.id]: !isOpen }))}
              >
                <span>{group.name.toUpperCase()} <span className="text-gray-500 font-normal">({total})</span></span>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isOpen && (
                <>
                  <ul className="space-y-1">
                    {pageItems.map(item => {
                      const kind = item.kind || "audio";
                      const rightLabel = kind === "audio" ? "Drag" : "Open";
                      return (
                        <li
                          key={item.id}
                          draggable={kind === "audio"}
                          onClick={(e) => {
                            if (kind === "step" && onOpenStep) return onOpenStep(item.id);
                            if (kind === "piano" && onOpenPiano) return onOpenPiano(item.id);
                            return playPreview(item.src);
                          }}
                          onDragStart={(e) => {
                            if (kind !== "audio") return;
                            e.dataTransfer.setData("application/json", JSON.stringify({ name: item.name, src: item.src }));
                            e.dataTransfer.effectAllowed = "copy";
                            try { e.dataTransfer.setData("text/sample", JSON.stringify({ name: item.name, src: item.src })); } catch {}
                          }}
                          className="group flex items-center justify-between rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 px-3 py-2 text-[13px] text-gray-100 transition cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {kind !== "audio" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 border border-white/10 text-gray-200 shrink-0">
                                {kind === "step" ? "STEP" : "PIANO"}
                              </span>
                            )}
                            <span className="truncate">{item.name}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {kind !== "audio" && onDeletePreset && (
                              <button
                                className="opacity-60 hover:opacity-100 text-red-300 hover:text-red-400 text-[12px]"
                                title="Delete preset"
                                onClick={(e) => { e.stopPropagation(); onDeletePreset(kind as any, item.id); }}
                              >
                                ✕
                              </button>
                            )}
                            <span className="opacity-60 text-[10px]">{rightLabel}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {pageCount > 1 && (
                    <div className="flex items-center justify-between mt-1.5 px-0.5 text-[11px] text-gray-400">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPage(p => ({ ...p, [group.id]: current - 1 })); }}
                        disabled={current <= 1}
                        className="px-2 py-1 rounded-md hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition"
                      >
                        ‹ Prev
                      </button>
                      <span>
                        {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, total)} of {total}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPage(p => ({ ...p, [group.id]: current + 1 })); }}
                        disabled={current >= pageCount}
                        className="px-2 py-1 rounded-md hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition"
                      >
                        Next ›
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && <div className="text-xs text-gray-400">No matches.</div>}
      </div>
    </aside>
  );
}
