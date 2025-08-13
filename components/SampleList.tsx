"use client";
import { useMemo, useRef, useState } from "react";
import { getAudioContext, getMaster } from "@/lib/audio";

export type Sample = { id: string; name: string; src: string };
export type Group  = { id: string; name: string; items: Sample[] };

export default function SampleList({ groups }: { groups: Group[] }) {
  const [q, setQ] = useState("");

  // one reusable preview chain
  const previewRef = useRef<{
    el: HTMLAudioElement | null;
    src?: MediaElementAudioSourceNode;
    gain?: GainNode;
  } | null>(null);

  async function playPreview(src: string) {
    // ensure audio context is ready (autoplay policies)
    try { getAudioContext().resume(); } catch {}

    const { master } = await getMaster();

    // cleanup previous preview
    if (previewRef.current?.el) {
      try { previewRef.current.el.pause(); } catch {}
    }
    try {
      previewRef.current?.src?.disconnect();
      previewRef.current?.gain?.disconnect();
    } catch {}

    const url = encodeURI(src);                // handle spaces safely
    const el = new Audio(url);
    el.preload = "auto";
    el.crossOrigin = "anonymous";

    const ac = getAudioContext();
    const srcNode = ac.createMediaElementSource(el);
    const gain    = ac.createGain();
    gain.gain.value = 0.9;

    srcNode.connect(gain).connect(master);

    // store for later cleanup
    previewRef.current = { el, src: srcNode, gain };

    // play, restarting from 0 on every click
    el.currentTime = 0;
    el.play().catch(() => { /* ignore autoplay hiccups */ });

    // auto cleanup when it ends
    el.onended = () => {
      try {
        srcNode.disconnect();
        gain.disconnect();
      } catch {}
      previewRef.current = null;
    };
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return groups;
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(it =>
          it.name.toLowerCase().includes(term) || it.id.toLowerCase().includes(term)
        ),
      }))
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
        {filtered.map(group => (
          <div key={group.id}>
            <div className="text-[10px] tracking-wider font-bold text-gray-400 mb-1">
              {group.name.toUpperCase()}
            </div>
            <ul className="space-y-1">
              {group.items.map(item => (
                <li
                  key={item.id}
                  draggable
                  onClick={() => playPreview(item.src)}          // ← play on click
                  onDragStart={(e) => {
                    // still draggable to pads
                    e.dataTransfer.setData("application/json", JSON.stringify({ name: item.name, src: item.src }));
                    e.dataTransfer.effectAllowed = "copy";
                    // also offer the older custom type, if some components use it
                    try { e.dataTransfer.setData("text/sample", JSON.stringify({ name: item.name, src: item.src })); } catch {}
                  }}
                  title={item.id}
                  className="flex items-center justify-between rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 px-3 py-2 text-[13px] text-gray-100 transition cursor-pointer select-none"
                >
                  <span className="truncate">{item.name}</span>
                  <span className="opacity-60 text-[10px]">Drag</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-xs text-gray-400">No matches.</div>
        )}
      </div>
    </aside>
  );
}
