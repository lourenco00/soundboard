import React from "react";
import Wave from "./Wave";
import { COLORS, clamp, secondsToTime } from "../lib/utils";
import { Clip, Dragging } from "../lib/types";

type Props = {
  acRef: React.MutableRefObject<AudioContext | null>;
  hostRef: React.MutableRefObject<HTMLDivElement | null>;
  laneH: number;
  lanesCount: number;
  pxPerSec: number;
  gridStepSec: number;

  cursor: number;
  setCursor: (v: number) => void;
  snapTime: (t: number) => number;

  clips: Clip[];
  setClips: React.Dispatch<React.SetStateAction<Clip[]>>;
  drag: Dragging | null;
  setDrag: (d: Dragging | null) => void;

  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  marquee: {active:boolean,x0:number,y0:number,x1:number,y1:number};
  setMarquee: React.Dispatch<React.SetStateAction<{active:boolean,x0:number,y0:number,x1:number,y1:number}>>;

  totalWidth: number;
  totalHeight: number;
};

export default function ClipsArea(props: Props) {
  const {
    acRef, hostRef, laneH, lanesCount, pxPerSec, gridStepSec,
    cursor, setCursor, snapTime,
    clips, setClips, drag, setDrag,
    selectedIds, setSelectedIds,
    marquee, setMarquee,
    totalWidth, totalHeight,
  } = props;

  function selectOnly(id: string) { setSelectedIds(new Set([id])); }
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const host = hostRef.current!;
    const rect = host.getBoundingClientRect();

    const raw =
      e.dataTransfer.getData("application/json") ||
      e.dataTransfer.getData("text/plain") ||
      e.dataTransfer.getData("text");
    if (!raw) return;

    let data: { name: string; src: string };
    try { data = JSON.parse(raw); } catch { data = { name: raw.split("/").pop() || "Clip", src: raw }; }

    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    const lane = clamp(Math.floor((y - 36) / laneH), 0, lanesCount - 1);

    const start = snapTime(x / pxPerSec);

    const ac = acRef.current!;
    const res = await fetch(data.src);
    const arr = await res.arrayBuffer();
    const buffer = await ac.decodeAudioData(arr);
    const color = COLORS[clips.length % COLORS.length];

    const clip: Clip = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: data.name,
      color,
      lane,
      start,
      buffer,
      offset: 0,
      duration: buffer.duration,
    };
    setClips((prev) => [...prev, clip]);
    selectOnly(clip.id);
  }

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("application/json") || e.dataTransfer.types.includes("text/plain")) {
      e.preventDefault();
    }
  }

  function startMoveDrag(
    e: React.MouseEvent,
    clip: Clip,
    leftEdgeGrab = false,
    rightEdgeGrab = false
  ) {
    acRef.current?.resume();
    if (e.shiftKey) toggleSelect(clip.id);
    else selectOnly(clip.id);

    const host = hostRef.current!;
    const r = host.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    if (leftEdgeGrab) {
      setDrag({ kind: "trim-left", clipId: clip.id, startPx: x, origStart: clip.start, origDuration: clip.duration });
      return;
    }
    if (rightEdgeGrab) {
      setDrag({ kind: "trim-right", clipId: clip.id, startPx: x, origStart: clip.start, origDuration: clip.duration });
      return;
    }

    // ⬇️ NEW: per-clip horizontal offset in pixels, captured at drag start
    const movingIds =
      selectedIds.size > 1 && selectedIds.has(clip.id) ? Array.from(selectedIds) : [clip.id];

    const offsets = movingIds.map(id => {
      const c = clips.find(cc => cc.id === id)!;
      return { id, dx: x - c.start * pxPerSec };
    });

    setDrag({
      kind: "move",
      clipId: clip.id,
      grabX: x - clip.start * pxPerSec, // kept for compatibility (anchor)
      grabY: y,
      anchorLane: clip.lane,
      offsets,
    });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const host = hostRef.current!;
    const r = host.getBoundingClientRect();
    const xMouse = clamp(e.clientX - r.left, 0, r.width);

    if (drag.kind === "move") {
      // shared vertical lane shift for the whole group
      const yMouse = clamp(e.clientY - r.top, 0, r.height);
      const relY = yMouse - drag.grabY;
      let laneDelta = Math.round(relY / laneH);

      // prevent any clip from leaving bounds
      const movingIds = drag.offsets.map(o => o.id);
      const movingClips = clips.filter(c => movingIds.includes(c.id));
      const minLane = Math.min(...movingClips.map(c => c.lane));
      const maxLane = Math.max(...movingClips.map(c => c.lane));
      if (minLane + laneDelta < 0) laneDelta = -minLane;
      if (maxLane + laneDelta > lanesCount - 1) laneDelta = (lanesCount - 1) - maxLane;

      setClips(prev =>
        prev.map(c => {
          const off = drag.offsets.find(o => o.id === c.id);
          if (!off) return c;

          // per-clip horizontal: keep relative spacing using its own dx
          const newStart = props.snapTime((xMouse - off.dx) / pxPerSec);
          const nextStart = clamp(newStart, 0, 60 * 60);
          const nextLane  = clamp(c.lane + laneDelta, 0, lanesCount - 1);
          return { ...c, start: nextStart, lane: nextLane };
        })
      );
      return;
    }

    // trim
    const x = xMouse;
    const dxSec = (x - drag.startPx) / pxPerSec;
    setClips((prev) =>
      prev.map((c) => {
        if (c.id !== drag.clipId) return c;
        if (drag.kind === "trim-left") {
          let ns = snapTime(drag.origStart + dxSec);
          let ndur = snapTime(drag.origDuration - dxSec);
          ndur = clamp(ndur, 0.02, c.buffer.duration - c.offset);
          ns = clamp(ns, 0, c.start + c.duration);
          const delta = ns - c.start;
          const newOffset = clamp(c.offset + delta, 0, c.buffer.duration - 0.02);
          const maxDur = c.buffer.duration - newOffset;
          ndur = clamp(ndur, 0.02, maxDur);
          return { ...c, start: ns, offset: newOffset, duration: ndur };
        } else {
          let ndur = snapTime(drag.origDuration + dxSec);
          const maxDur = c.buffer.duration - c.offset;
          ndur = clamp(ndur, 0.02, maxDur);
          return { ...c, duration: ndur };
        }
      })
    );
  }

  function onMouseUp() { if (drag) setDrag(null); }

  function onBgMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (drag) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCursor(x / pxPerSec);
    setMarquee({ active: true, x0: x, y0: y, x1: x, y1: y });
    if (!e.shiftKey) clearSelection();
  }

  function onBgMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!marquee.active) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    const next = { ...marquee, x1: x, y1: y };
    props.setMarquee(next);

    const minx = Math.min(next.x0, next.x1);
    const maxx = Math.max(next.x0, next.x1);
    const miny = Math.min(next.y0, next.y1);
    const maxy = Math.max(next.y0, next.y1);

    const sel = new Set<string>();
    const topOfLanes = 36;

    clips.forEach((c) => {
      const left = c.start * pxPerSec;
      const top = topOfLanes + c.lane * laneH + 10;
      const width = Math.max(24, c.duration * pxPerSec);
      const height = laneH - 20;
      const right = left + width;
      const bottom = top + height;

      const overlap = left < maxx && right > minx && top < maxy && bottom > miny;
      if (overlap) sel.add(c.id);
    });

    setSelectedIds(sel);
  }

  function onBgMouseUp() {
    if (marquee.active) setMarquee(m => ({ ...m, active: false }));
  }

  return (
    <div
      ref={hostRef}
      className="relative rounded-2xl overflow-auto border border-white/10 bg-white/5 select-none"
      style={{ height: totalHeight }}
      onMouseDown={onBgMouseDown}
      onMouseMove={(e) => { onBgMouseMove(e); onMouseMove(e); }}
      onMouseUp={() => { onBgMouseUp(); onMouseUp(); }}
      onMouseLeave={() => { onBgMouseUp(); onMouseUp(); }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div style={{ width: totalWidth, height: totalHeight, position: "relative" }}>
        {/* lanes */}
        {Array.from({ length: lanesCount }).map((_, i) => (
          <div
            key={`lane-${i}`}
            className="absolute left-0 right-0 border-t border-white/10"
            style={{ top: 36 + i * laneH }}
          />
        ))}

        {/* vertical grid */}
        {Array.from({ length: Math.ceil(totalWidth / (gridStepSec * pxPerSec)) + 1 }).map((_, i) => {
          const x = Math.floor(i * gridStepSec * pxPerSec) + 0.5;
          return (
            <div
              key={`grid-${i}`}
              className="absolute top-0 bottom-0 border-r border-white/10"
              style={{ left: x }}
            />
          );
        })}

        {/* playhead */}
        <div
          className="absolute top-0 bottom-0 border-r-2"
          style={{ left: cursor * pxPerSec, borderColor: "rgba(99,102,241,.8)" }}
        />

        {/* marquee */}
        {marquee.active && (
          <div
            className="absolute border-2 border-indigo-400/60 bg-indigo-400/10 rounded-lg"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}

        {/* clips */}
        {clips.map((c) => {
          const left = Math.round(c.start * pxPerSec);
          const top = 36 + c.lane * laneH + 10;
          const width = Math.max(24, Math.round(c.duration * pxPerSec));
          const height = laneH - 20;
          const selected = selectedIds.has(c.id);

          return (
            <div
              key={c.id}
              className={`absolute rounded-xl p-2 border shadow-sm overflow-hidden clip-hover ${
                selected ? "ring-2 ring-indigo-400/60 bg-white/10 border-white/20" : "bg-white/6 border-white/12"
              }`}
              style={{ left, top, width, height, transition: "box-shadow .12s" }}
              title={`${c.name} • ${secondsToTime(c.duration)}`}
              onMouseDown={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const px = e.clientX - rect.left;
                const edge = 10;
                const leftGrab = px <= edge;
                const rightGrab = px >= rect.width - edge;
                startMoveDrag(e, c, leftGrab, rightGrab);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey) toggleSelect(c.id);
                else selectOnly(c.id);
              }}
            >
              <div className="flex items-center justify-between text-[11px] mb-1">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />
                  <span className="truncate max-w-[14rem]">{c.name}</span>
                </div>
                <span className="opacity-60">{secondsToTime(c.duration)}</span>
              </div>

              <Wave buffer={c.buffer} color={c.color} width={width - 8} height={height - 28} />

              {/* trim handles */}
              <div
                className="absolute top-0 bottom-0 w-2 cursor-ew-resize"
                style={{ left: 0, background: "linear-gradient(to right, rgba(255,255,255,.18), transparent)" }}
              />
              <div
                className="absolute top-0 bottom-0 w-2 cursor-ew-resize"
                style={{ right: 0, background: "linear-gradient(to left, rgba(255,255,255,.18), transparent)" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
