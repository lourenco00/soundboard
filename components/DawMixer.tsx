"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------ types ------------------------------ */

type Clip = {
  id: string;
  name: string;
  color: string;
  lane: number;          // which lane/row
  start: number;         // start on timeline (seconds)
  buffer: AudioBuffer;   // decoded audio
  offset: number;        // where inside the buffer we begin (seconds)
  duration: number;      // how much of the buffer we play (seconds)
};

type Dragging =
  | {
      kind: "move";
      clipId: string;
      grabX: number; // px inside the clip where the user grabbed
    }
  | {
      kind: "trim-left" | "trim-right";
      clipId: string;
      startPx: number;     // initial mouse x (px)
      origStart: number;   // original start (sec)
      origDuration: number;// original duration (sec)
    };

type ClipboardItem = {
  name: string;
  color: string;
  lane: number;
  relStart: number;     // start - minStart (seconds)
  offset: number;
  duration: number;
  buffer: AudioBuffer;
};

type ClipboardBundle = { items: ClipboardItem[] };

/* ----------------------------- helpers ----------------------------- */

const COLORS = [
  "#86efac", "#93c5fd", "#fca5a5", "#fcd34d",
  "#c4b5fd", "#fdba74", "#67e8f9", "#a5b4fc",
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function secondsToTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

/** quick peak extraction for drawing */
function getPeaks(buffer: AudioBuffer, targetWidth: number) {
  const ch0 = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(ch0.length / targetWidth));
  const out: number[] = [];
  for (let i = 0; i < targetWidth; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block && start + j < ch0.length; j++) {
      const v = Math.abs(ch0[start + j]);
      if (v > max) max = v;
    }
    out.push(max);
  }
  return out;
}

/* --------------------------- waveform view ------------------------- */

function Wave({
  buffer,
  color = "#93c5fd",
  width,
  height,
}: {
  buffer: AudioBuffer;
  color?: string;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    // faint vertical grid inside the clip
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.beginPath();
    for (let x = 0; x <= width; x += 40) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    ctx.stroke();

    // waveform
    const peaks = getPeaks(buffer, Math.max(1, Math.floor(width)));
    ctx.fillStyle = color;
    const mid = height / 2;
    for (let x = 0; x < peaks.length; x++) {
      const h = peaks[x] * (height * 0.9);
      ctx.fillRect(x, mid - h / 2, 1, h);
    }
  }, [buffer, color, width, height]);

  return <canvas ref={ref} className="rounded-md" style={{ width, height }} />;
}

/* ---------------------------- main view ---------------------------- */

export default function DawMixer() {
  /** sizing / grid */
  const lanesCount = 6;
  const laneH = 90;                          // height of each lane
  const [pxPerSec, setPxPerSec] = useState(140);
  const [bpm, setBpm] = useState(120);

  // NEW: quantization resolution (note values relative to a bar in 4/4)
  // 1/4 = quarter notes (1 beat), 1/8 = eighths (1/2 beat), etc.
  const [quant, setQuant] = useState<"1/4" | "1/8" | "1/16" | "1/32">("1/4");
  const [snap, setSnap] = useState(true);

  /** transport */
  const [cursor, setCursor] = useState(0);   // playhead (seconds)
  const [isPlaying, setIsPlaying] = useState(false);

  /** audio graph */
  const acRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const recDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const [master, setMaster] = useState(0.9);
  const playingSources = useRef<AudioBufferSourceNode[]>([]);
  const rafRef = useRef<number | null>(null);

  /** ui refs */
  const hostRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  /** data */
  const [clips, setClips] = useState<Clip[]>([]);
  const [drag, setDrag] = useState<Dragging | null>(null);

  /** selection + clipboard */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const clipboardRef = useRef<ClipboardBundle | null>(null);

  /** marquee selection */
  const [marquee, setMarquee] = useState<{active:boolean,x0:number,y0:number,x1:number,y1:number}>({
    active:false, x0:0, y0:0, x1:0, y1:0
  });

  /** record */
  const [isRec, setIsRec] = useState(false);
  const [recUrl, setRecUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  /** init audio */
  useEffect(() => {
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    const master = ac.createGain();
    master.gain.value = masterGainRef.current?.gain.value ?? 0.9;

    master.connect(ac.destination);
    const dest = ac.createMediaStreamDestination();
    master.connect(dest);

    acRef.current = ac;
    masterGainRef.current = master;
    recDestRef.current = dest;

    return () => {
      try { playingSources.current.forEach((s) => s.stop()); } catch {}
      playingSources.current = [];
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { ac.close(); } catch {}
      acRef.current = null;
    };
  }, []);

  /** master volume */
  useEffect(() => {
    if (masterGainRef.current) masterGainRef.current.gain.value = master;
  }, [master]);

  /** grid helpers */
  const beat = useMemo(() => 60 / clamp(bpm, 40, 240), [bpm]); // seconds per beat

  // grid step in seconds based on quantization
  const gridStepSec = useMemo(() => {
    switch (quant) {
      case "1/4":  return beat * 1;    // quarter notes (1 beat)
      case "1/8":  return beat * 0.5;  // eighths
      case "1/16": return beat * 0.25; // sixteenths
      case "1/32": return beat * 0.125;// thirty-seconds
    }
  }, [beat, quant]);

  const snapTime = (t: number) => (snap ? Math.round(t / gridStepSec) * gridStepSec : t);

  /** drawing timeline grid (top ruler) */
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;

    const width = el.clientWidth;
    const height = 36;
    el.innerHTML = "";
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    el.appendChild(c);

    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fillRect(0, 0, width, height);

    // vertical lines at chosen subdivision
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.beginPath();
    const pxPerStep = gridStepSec * pxPerSec;
    for (let x = 0; x < width; x += pxPerStep) {
      ctx.moveTo(Math.floor(x) + 0.5, 0);
      ctx.lineTo(Math.floor(x) + 0.5, height);
    }
    ctx.stroke();

    // labels every 1 second for orientation
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.font = "11px ui-sans-serif, system-ui, -apple-system, Segoe UI";
    for (let s = 0; s < width / pxPerSec; s++) {
      const x = s * pxPerSec;
      ctx.fillText(`${s}s`, x + 4, 22);
    }
  }, [pxPerSec, gridStepSec, bpm, hostRef.current?.clientWidth]);

  /* ----------------------------- transport ----------------------------- */

  function clearPlaying() {
    playingSources.current.forEach((s) => { try { s.stop(); } catch {} });
    playingSources.current = [];
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  function play() {
    const ac = acRef.current;
    if (!ac || !masterGainRef.current) return;
    ac.resume();

    clearPlaying();

    const startAt = ac.currentTime + 0.04;
    const offsetTimeline = cursor;

    clips.forEach((c) => {
      const clipEnd = c.start + c.duration;
      if (clipEnd <= offsetTimeline) return;

      const when = startAt + Math.max(0, c.start - offsetTimeline);
      const offsetInside = Math.max(0, offsetTimeline - c.start) + c.offset;
      const remain = c.duration - Math.max(0, offsetTimeline - c.start);
      if (remain <= 0) return;

      try {
        const src = ac.createBufferSource();
        src.buffer = c.buffer;
        src.connect(masterGainRef.current!);
        src.start(when, offsetInside, remain);
        playingSources.current.push(src);
      } catch {}
    });

    setIsPlaying(true);

    const tick = () => {
      if (!acRef.current) return;
      const elapsed = acRef.current.currentTime - startAt;
      setCursor(offsetTimeline + Math.max(0, elapsed));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function pause() {
    clearPlaying();
    setIsPlaying(false);
  }

  function stop() {
    pause();
    setCursor(0);
  }

  /* --------------------------- selection logic --------------------------- */

  function selectOnly(id: string) { setSelectedIds(new Set([id])); }
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  /** background interactions (cursor + marquee) */
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
    setMarquee(next);

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

  /* ------------------------------ dnd/load ------------------------------ */

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("application/json") || e.dataTransfer.types.includes("text/plain")) {
      e.preventDefault();
    }
  }

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

  /* -------------------------- move & trim drag -------------------------- */

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

    if (leftEdgeGrab) {
      setDrag({ kind: "trim-left", clipId: clip.id, startPx: x, origStart: clip.start, origDuration: clip.duration });
      return;
    }
    if (rightEdgeGrab) {
      setDrag({ kind: "trim-right", clipId: clip.id, startPx: x, origStart: clip.start, origDuration: clip.duration });
      return;
    }

    setDrag({ kind: "move", clipId: clip.id, grabX: x - clip.start * pxPerSec });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const host = hostRef.current!;
    const r = host.getBoundingClientRect();
    const x = clamp(e.clientX - r.left, 0, r.width);

    if (drag.kind === "move") {
      const newStart = snapTime((x - drag.grabX) / pxPerSec);

      const movingIds = selectedIds.size > 1 && selectedIds.has(drag.clipId)
        ? Array.from(selectedIds)
        : [drag.clipId];

      const anchor = clips.find(c => c.id === drag.clipId);
      if (!anchor) return;
      const delta = newStart - anchor.start;

      setClips(prev =>
        prev.map(c => movingIds.includes(c.id)
          ? { ...c, start: clamp(snapTime(c.start + delta), 0, 60 * 60) }
          : c
        )
      );
      return;
    }

    // Trimming with quantization
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

  /* --------------------------- copy / paste / del --------------------------- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && (e.key === "a" || e.key === "A")) {
        setSelectedIds(new Set(clips.map(c => c.id)));
        e.preventDefault();
        return;
      }

      if (meta && (e.key === "c" || e.key === "C")) {
        if (selectedIds.size === 0) return;
        const selected = clips.filter(c => selectedIds.has(c.id));
        const minStart = Math.min(...selected.map(c => c.start));
        clipboardRef.current = {
          items: selected.map(c => ({
            name: c.name,
            color: c.color,
            lane: c.lane,
            relStart: c.start - minStart,
            offset: c.offset,
            duration: c.duration,
            buffer: c.buffer,
          })),
        };
        e.preventDefault();
        return;
      }

      if (meta && (e.key === "v" || e.key === "V")) {
        const bundle = clipboardRef.current;
        if (!bundle || bundle.items.length === 0) return;
        const startAt = snapTime(cursor);
        const now = Date.now();

        const clones: Clip[] = bundle.items.map((it, i) => ({
          id: `${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          name: it.name,
          color: it.color,
          lane: it.lane,
          start: clamp(startAt + it.relStart, 0, 60 * 60),
          buffer: it.buffer,
          offset: it.offset,
          duration: it.duration,
        }));

        setClips(prev => [...prev, ...clones]);
        setSelectedIds(new Set(clones.map(c => c.id)));
        e.preventDefault();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size === 0) return;
        setClips(prev => prev.filter(x => !selectedIds.has(x.id)));
        setSelectedIds(new Set());
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clips, selectedIds, cursor, snapTime]);

  /* ------------------------------ recording ------------------------------ */

  function startRecord() {
    const dest = recDestRef.current;
    if (!dest) return;
    if (recRef.current) stopRecord();

    const rec = new MediaRecorder(dest.stream);
    recRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      setRecUrl(url);
    };
    rec.start();
    setIsRec(true);
  }

  function stopRecord() { if (recRef.current) recRef.current.stop(); setIsRec(false); }

  /* ------------------------------- sizing ------------------------------- */

  const totalWidth = Math.max(
    (Math.max(8, ...clips.map((c) => c.start + c.duration))) * pxPerSec,
    (hostRef.current?.clientWidth || 0)
  );
  const totalHeight = 36 + lanesCount * laneH;

  const listItems = clips.map((c) => ({ id: c.id, name: c.name, color: c.color, lane: c.lane, start: c.start }));

  /* -------------------------------- render -------------------------------- */

  return (
    <div className="glass glass-fill rounded-2xl p-4 space-y-3" onDragOver={onDragOver} onDrop={onDrop}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {!isPlaying ? (
            <button className="btn-ghost rounded-lg px-3" onClick={play}>▶</button>
          ) : (
            <button className="btn-ghost rounded-lg px-3" onClick={pause}>⏸</button>
          )}
          <button className="btn-ghost rounded-lg px-3" onClick={stop}>■</button>
        </div>

        <div className="text-sm text-gray-300">
          Cursor: <span className="font-mono">{secondsToTime(cursor)}</span>
        </div>

        <label className="text-sm text-gray-300 flex items-center gap-2">
          Zoom
          <input
            type="range" min={60} max={400} step={5} value={pxPerSec}
            onChange={(e)=>setPxPerSec(parseInt(e.target.value))}
            className="accent-indigo-500 w-40"
          />
        </label>

        <label className="text-sm text-gray-300 flex items-center gap-2">
          BPM
          <input
            type="number" min={60} max={200} value={bpm}
            onChange={(e)=>setBpm(parseInt(e.target.value || "120"))}
            className="bg-white/10 rounded-md px-2 py-1 w-20"
          />
        </label>

        {/* NEW: Grid selector */}
        <label className="text-sm text-gray-300 flex items-center gap-2">
          Grid
          <select
            className="bg-white/10 rounded-md px-2 py-1"
            value={quant}
            onChange={(e)=>setQuant(e.target.value as typeof quant)}
          >
            <option value="1/4">1/4 (quarters)</option>
            <option value="1/8">1/8 (eighths)</option>
            <option value="1/16">1/16</option>
            <option value="1/32">1/32</option>
          </select>
        </label>

        <label className="text-sm text-gray-300 flex items-center gap-2">
          <input type="checkbox" checked={snap} onChange={(e)=>setSnap(e.target.checked)}/>
          Snap to beat
        </label>

        <label className="text-sm text-gray-300 flex items-center gap-2 ml-auto">
          Master
          <input
            type="range" min={0} max={1} step={0.01} value={master}
            onChange={(e)=>setMaster(parseFloat(e.target.value))}
            className="accent-indigo-500 w-40"
          />
        </label>

        {!isRec ? (
          <button className="btn-primary rounded-lg" onClick={startRecord}>● Record</button>
        ) : (
          <button className="btn-ghost rounded-lg" onClick={stopRecord}>■ Stop</button>
        )}
        {recUrl && <a className="btn-ghost rounded-lg" href={recUrl} download="mix.webm">Download</a>}
      </div>

      {/* Top ruler */}
      <div ref={timelineRef} className="rounded-lg overflow-hidden border border-white/10" />

      {/* Tracks area */}
      <div
        ref={hostRef}
        className="relative rounded-2xl overflow-auto border border-white/10 bg-white/5 select-none"
        style={{ height: totalHeight }}
        onMouseDown={onBgMouseDown}
        onMouseMove={(e) => { onBgMouseMove(e); onMouseMove(e); }}
        onMouseUp={() => { onBgMouseUp(); onMouseUp(); }}
        onMouseLeave={() => { onBgMouseUp(); onMouseUp(); }}
      >
        <div style={{ width: totalWidth, height: totalHeight, position: "relative" }}>
          {/* horizontal lane separators */}
          {Array.from({ length: lanesCount }).map((_, i) => (
            <div
              key={`lane-${i}`}
              className="absolute left-0 right-0 border-t border-white/10"
              style={{ top: 36 + i * laneH }}
            />
          ))}

          {/* vertical grid at chosen subdivision */}
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

          {/* marquee rect */}
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

      {/* Clips scroller */}
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
                title={`${c.name} @ {secondsToTime(c.start)} • lane ${c.lane}`}
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
    </div>
  );
}
