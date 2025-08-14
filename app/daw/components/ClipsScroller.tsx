import React from "react";
import { secondsToTime } from "../lib/utils";
import { Clip } from "../lib/types";

type Props = {
  listItems: Pick<Clip,"id"|"name"|"color"|"lane"|"start">[];
  setClips: React.Dispatch<React.SetStateAction<Clip[]>>;
};

export default function ClipsScroller({ listItems, setClips }: Props) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-sm text-gray-300 mb-2">Clips in project</div>
      {listItems.length === 0 ? (
        <div className="text-xs text-gray-400">Drop samples from the Library to add clips.</div>
      ) : (
        <ul className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {listItems.map((c) => (
            <li
              key={c.id}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5"
              title={`${c.name} @ ${secondsToTime(c.start)} • lane ${c.lane}`}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />
              <span className="truncate max-w-[10rem] text-[12px] text-gray-100">{c.name}</span>
              <span className="text-[11px] text-gray-400">
                @ {secondsToTime(c.start)} • lane {c.lane}
              </span>
              <button
                className="ml-1 rounded-md bg-white/10 px-2 py-1 text-[11px] hover:bg-white/15"
                onClick={() => setClips((prev) => prev.filter((x) => x.id !== c.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
