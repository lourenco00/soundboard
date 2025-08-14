"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// ✅ these components are in the same folder as DawMixer.tsx
import Transport from "./Transport";
import Timeline from "./Timeline";
import ClipsArea from "./ClipsArea";
import ClipsScroller from "./ClipsScroller";

// ✅ lib is one level up from /components
import { Clip, Dragging, ClipboardBundle } from "../lib/types";
import { clamp, secondsToTime } from "../lib/utils";

export default function DawMixer() {
  /** sizing / grid */
  const lanesCount = 6;
  const laneH = 90;
  const [pxPerSec, setPxPerSec] = useState(140);
  const [bpm, setBpm] = useState(120);
  const [quant, setQuant] = useState<"1/4" | "1/8" | "1/16" | "1/32">("1/4");
  const [snap, setSnap] = useState(true);

  /** transport */
  const [cursor, setCursor] = useState(0);
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
  const [marquee, setMarquee] = useState({ active: false, x0: 0, y0: 0, x1: 0, y1: 0 });

  /** record */
  const [isRec, setIsRec] = useState(false);
  const [recUrl, setRecUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  /** init audio */
  useEffect(() => {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    const ac = new AC();
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
  const gridStepSec = useMemo(() => {
    switch (quant) {
      case "1/4":  return beat * 1;
      case "1/8":  return beat * 0.5;
      case "1/16": return beat * 0.25;
      case "1/32": return beat * 0.125;
    }
  }, [beat, quant]);

  const snapTime = (t: number) => (snap ? Math.round(t / gridStepSec) * gridStepSec : t);

  /** transport */
  function clearPlaying() {
    playingSources.current.forEach((s) => { try { s.stop(); } catch {} });
    playingSources.current = [];
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }
  function play() {
    const ac = acRef.current; if (!ac || !masterGainRef.current) return;
    ac.resume(); clearPlaying();

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
  function pause() { clearPlaying(); setIsPlaying(false); }
  function stop() { pause(); setCursor(0); }

  /** 🔧 recording — these were missing */
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
  function stopRecord() {
    if (recRef.current) recRef.current.stop();
    setIsRec(false);
  }

  /** shortcuts */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && (e.key === "a" || e.key === "A")) {
        setSelectedIds(new Set(clips.map(c => c.id)));
        e.preventDefault(); return;
      }
      if (meta && (e.key === "c" || e.key === "C")) {
        if (selectedIds.size === 0) return;
        const selected = clips.filter(c => selectedIds.has(c.id));
        const minStart = Math.min(...selected.map(c => c.start));
        clipboardRef.current = {
          items: selected.map(c => ({
            name: c.name, color: c.color, lane: c.lane,
            relStart: c.start - minStart, offset: c.offset,
            duration: c.duration, buffer: c.buffer,
          })),
        };
        e.preventDefault(); return;
      }
      if (meta && (e.key === "v" || e.key === "V")) {
        const bundle = clipboardRef.current;
        if (!bundle || bundle.items.length === 0) return;
        const startAt = snapTime(cursor);
        const now = Date.now();

        const clones: Clip[] = bundle.items.map((it, i) => ({
          id: `${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          name: it.name, color: it.color, lane: it.lane,
          start: clamp(startAt + it.relStart, 0, 60 * 60),
          buffer: it.buffer, offset: it.offset, duration: it.duration,
        }));

        setClips(prev => [...prev, ...clones]);
        setSelectedIds(new Set(clones.map(c => c.id)));
        e.preventDefault(); return;
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
  }, [clips, selectedIds, cursor, gridStepSec, snap]);

  /** ruler canvas */
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

    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.beginPath();
    const pxPerStep = gridStepSec * pxPerSec;
    for (let x = 0; x < width; x += pxPerStep) {
      ctx.moveTo(Math.floor(x) + 0.5, 0);
      ctx.lineTo(Math.floor(x) + 0.5, height);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.font = "11px ui-sans-serif, system-ui, -apple-system, Segoe UI";
    for (let s = 0; s < width / pxPerSec; s++) {
      const x = s * pxPerSec;
      ctx.fillText(`${s}s`, x + 4, 22);
    }
  }, [pxPerSec, gridStepSec, bpm]);

  /** sizing */
  const totalWidth = Math.max(
    (Math.max(8, ...clips.map((c) => c.start + c.duration))) * pxPerSec,
    (hostRef.current?.clientWidth || 0)
  );
  const totalHeight = 36 + lanesCount * laneH;
  const listItems = clips.map((c) => ({ id: c.id, name: c.name, color: c.color, lane: c.lane, start: c.start }));

  return (
    <div className="glass glass-fill rounded-2xl p-4 space-y-3">
      <Transport
        isPlaying={isPlaying}
        onPlay={play}
        onPause={pause}
        onStop={stop}
        cursorLabel={secondsToTime(cursor)}
        pxPerSec={pxPerSec}
        setPxPerSec={setPxPerSec}
        bpm={bpm}
        setBpm={setBpm}
        quant={quant}
        setQuant={setQuant}
        snap={snap}
        setSnap={setSnap}
        master={master}
        setMaster={setMaster}
        isRec={isRec}
        startRecord={startRecord}
        stopRecord={stopRecord}
        recUrl={recUrl}
      />

      <Timeline refDiv={timelineRef} pxPerSec={pxPerSec} gridStepSec={gridStepSec} />

      <ClipsArea
        acRef={acRef}
        hostRef={hostRef}
        laneH={laneH}
        lanesCount={lanesCount}
        pxPerSec={pxPerSec}
        gridStepSec={gridStepSec}
        cursor={cursor}
        setCursor={setCursor}
        snapTime={snapTime}
        clips={clips}
        setClips={setClips}
        drag={drag}
        setDrag={setDrag}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        marquee={marquee}
        setMarquee={setMarquee}
        totalWidth={totalWidth}
        totalHeight={totalHeight}
      />

      <ClipsScroller listItems={listItems} setClips={setClips} />
    </div>
  );
}
