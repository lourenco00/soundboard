"use client";

import React from "react";
import type { SampleGroup } from "../lib/sampleData";

type Props = {
  groups: SampleGroup[];
  query: string;
  onQueryChange: (v: string) => void;
};

export default function Library({ groups, query, onQueryChange }: Props) {
  return (
    <aside className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-lg font-medium text-white/90 mb-3">Library</div>

      <input
        value={query}
        onChange={(e)=>onQueryChange(e.target.value)}
        placeholder="Search samples..."
        className="w-full mb-3 rounded-lg bg-white/10 border border-white/10 text-white/90 placeholder-white/40 px-3 py-2 outline-none focus:border-indigo-400/60"
      />

      <div className="max-h-[70vh] overflow-auto pr-1 space-y-3">
        {groups.map((group) => (
          <div key={group.id} className="space-y-2">
            <div className="text-[11px] tracking-wide text-white/50">{group.name.toUpperCase()}</div>
            <div className="space-y-2">
              {group.items.map((it) => (
                <div
                  key={it.id}
                  draggable
                  onDragStart={(e) => {
                    // DawMixer expects JSON: { name, src }
                    const payload = JSON.stringify({ name: it.name, src: it.src });
                    e.dataTransfer.setData("application/json", payload);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2 hover:bg-white/10"
                  title={it.name}
                >
                  <span className="truncate text-[13px] text-white/90">{it.name}</span>
                  <span className="text-[11px] text-white/60 border border-white/10 rounded-md px-1.5 py-0.5">Drag</span>
                </div>
              ))}
              {group.items.length === 0 && (
                <div className="text-xs text-white/40">No matches in this group.</div>
              )}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="text-sm text-white/50">No results.</div>
        )}
      </div>
    </aside>
  );
}
