"use client";

type Sample = { id: string; name: string; src: string; length?: string };

export default function SampleList({
  samples,
}: { samples: Sample[] }) {
  return (
    <aside className="glass rounded-2xl p-4 w-full h-full overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold tracking-wide text-gray-300">Library</h3>
        <span className="text-[11px] text-gray-400">Drag to pads</span>
      </div>

      <ul className="space-y-2">
        {samples.map((s) => (
          <li key={s.id}>
            <button
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/sample", JSON.stringify(s));
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="w-full glass rounded-xl px-3 py-2 text-left hover:bg-white/10 transition flex items-center gap-3"
            >
              <div className="h-8 w-8 rounded-lg bg-indigo-500/30 flex items-center justify-center">
                <span className="text-xs">♫</span>
              </div>
              <div className="flex-1">
                <div className="text-sm">{s.name}</div>
                {s.length && <div className="text-[11px] text-gray-400">{s.length}</div>}
              </div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">WAV</div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}