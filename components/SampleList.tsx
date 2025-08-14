"use client";
import { useMemo, useRef, useState } from "react";
import { getAudioContext, getMaster } from "@/lib/audio";

export type Sample = {
  id: string;
  name: string;
  src?: string;                    // optional for presets
  kind?: "audio" | "step" | "piano";
  folder?: string;
};
export type Group  = { id: string; name: string; items: Sample[] };

export default function SampleList({
  groups,
  onOpenStep,
  onOpenPiano,
  onDeletePreset,
}: {
  groups: Group[];
  onOpenStep?: (id: string) => void;
  onOpenPiano?: (id: string) => void;
  onDeletePreset?: (kind: "step" | "piano", id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return groups;
    return groups
      .map(g => ({ ...g, items: g.items.filter(it => it.name.toLowerCase().includes(term) || it.id.toLowerCase().includes(term)) }))
      .filter(g => g.items.length > 0);
  }, [groups, q]);

  return (
    <aside className="glass rounded-2xl p-3 h-full flex flex-col border border-white/10">
      <div className="mb-2">
        <div className="font-semibold text-gray-200">Library</div>
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Search samples…"
          className="mt-2 w-full rounded-lg border border-white/15 bg-white/12 px-3 py-2 text-[13px] text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-400/40"
        />
      </div>

      <div className="overflow-y-auto min-h-0 flex-1 pr-0.5 space-y-3">
        {filtered.map(group => {
          const isOpen = expanded[group.id] ?? false;
          return (
            <div key={group.id}>
              <div
                className="text-[11px] tracking-wider font-bold text-gray-300 mb-1 flex items-center justify-between cursor-pointer hover:text-white transition"
                onClick={() => setExpanded(prev => ({ ...prev, [group.id]: !isOpen }))}
              >
                {group.name.toUpperCase()}
                <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isOpen && (
                <ul className="space-y-1">
                  {group.items.map(item => {
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
              )}
            </div>
          );
        })}

        {filtered.length === 0 && <div className="text-xs text-gray-400">No matches.</div>}
      </div>
    </aside>
  );
}
