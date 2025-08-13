"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAudioContext, getMaster } from "@/lib/audio";
import { decodeBuffer, buildPeaks } from "@/lib/wave";
import { renderMix, type Clip } from "@/lib/renderMix";

type Wave = { peaks: { min: Float32Array; max: Float32Array }; duration: number; color: string };
type LaneClip = Clip & { wave?: Wave };

const COLORS = ["#60a5fa","#34d399","#f472b6","#f59e0b","#a78bfa","#22d3ee"];

export default function TimelineMix() {
  // transport
  const [bpm, setBpm] = useState(128);
  const [playing, setPlaying] = useState(false);
  const [pxPerSec, setPxPerSec] = useState(120);   // zoom
  const [lanes] = useState(4);

  // arrangement
  const [clips, setClips] = useState<LaneClip[]>([]);
  const waves = useRef(new Map<string, Wave>());   // src -> peaks

  // playhead state
  const [time, setTime] = useState(0);
  const lastTick = useRef(0);
  const raf = useRef<number | null>(null);

  // canvas sizes
  const trackH = 64;
  const headerH = 24;
  const height = headerH + lanes * (trackH + 8) + 8;

  const secToX = (s: number) => Math.round(s * pxPerSec);
  const xToSec = (x: number) => x / pxPerSec;

  // load peaks for each unique src lazily
  async function ensureWave(src: string) {
    if (waves.current.has(src)) return waves.current.get(src)!;
    const buf = await decodeBuffer(src);
    const peaks = buildPeaks(buf, Math.max(256, Math.floor(buf.sampleRate / 200)));
    const wave: Wave = { peaks, duration: buf.duration, color: COLORS[waves.current.size % COLORS.length] };
    waves.current.set(src, wave);
    return wave;
  }

  // playback (schedule BufferSources relative to playhead)
  const sourcesRef = useRef<{ stop: () => void }[]>([]);

  function stopAudio() {
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current = [];
  }

  async function startAudio() {
    const ac = getAudioContext();
    const when = ac.currentTime + 0.05;
    const offset = time; // start from playhead
    const { master } = await getMaster();

    // decode cache per session
    const cache = new Map<string, AudioBuffer>();
    async function decode(src: string) {
      if (cache.has(src)) return cache.get(src)!;
      const res = await fetch(encodeURI(src), { cache: "force-cache" });
      const ab = await res.arrayBuffer();
      const buf = await ac.decodeAudioData(ab);
      cache.set(src, buf); return buf;
    }

    for (const c of clips) {
      // skip if ends before playhead
      if (c.start + c.duration <= offset) continue;

      const buf = await decode(c.src);
      const src = ac.createBufferSource();
      src.buffer = buf;

      const g = ac.createGain();
      g.gain.value = 0;

      // schedule times
      const startAt = when + Math.max(0, c.start - offset);
      const playOffset = Math.max(0, offset - c.start);
      const dur = Math.max(0, c.duration - playOffset);

      // simple fades
      const absInStart = startAt;
      const absInEnd = startAt + Math.min(c.fadeIn, dur);
      const absOutStart = startAt + Math.max(0, dur - c.fadeOut);
      const absEnd = startAt + dur;

      g.gain.setValueAtTime(0, absInStart);
      g.gain.linearRampToValueAtTime(c.gain, absInEnd);
      g.gain.setValueAtTime(c.gain, absOutStart);
      g.gain.linearRampToValueAtTime(0, absEnd);

      src.connect(g).connect(master);
      src.start(startAt, playOffset, dur);

      sourcesRef.current.push({ stop: () => { try { src.stop(); } catch {} } });
    }
  }

  // transport loop
  useEffect(() => {
    if (!playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null; return;
    }
    lastTick.current = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTick.current) / 1000;
      lastTick.current = now;
      setTime(t => t + dt);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing]);

  async function togglePlay() {
    if (playing) {
      stopAudio(); setPlaying(false);
    } else {
      await startAudio(); setPlaying(true);
      try { getAudioContext().resume(); } catch {}
    }
  }

  // drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // header grid (beats & bars)
    ctx.fillStyle = "rgba(255,255,255,.05)";
    ctx.fillRect(0, 0, w, headerH);
    const bps = bpm / 60;
    const secPerBeat = 1 / bps;
    const beatPx = pxPerSec * secPerBeat;
    for (let x = - (secToX(time) % beatPx); x < w; x += beatPx) {
      const strong = Math.round((x + secToX(time)) / beatPx) % 4 === 0;
      ctx.strokeStyle = strong ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.12)";
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
      ctx.stroke();
    }

    // lanes bg
    for (let i=0;i<lanes;i++) {
      const y = headerH + i * (trackH + 8);
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)";
      ctx.fillRect(0, y, w, trackH);
    }

    // draw clips
    for (const c of clips) {
      const wave = waves.current.get(c.src);
      const y = headerH + c.lane * (trackH + 8);
      const x = secToX(c.start - time);
      const wClip = secToX(c.duration);
      // box
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.strokeStyle = "rgba(255,255,255,.15)";
      ctx.lineWidth = 1;
      ctx.fillRect(x, y+4, wClip, trackH-8);
      ctx.strokeRect(x+.5, y+4.5, wClip-1, trackH-9);

      // label
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.font = "600 12px ui-sans-serif,system-ui";
      ctx.fillText(c.name, x+8, y+18);

      // waveform if available
      if (wave) {
        const { min, max } = wave.peaks;
        const mid = y + trackH/2;
        const step = Math.max(1, Math.floor((wClip) / min.length));
        ctx.strokeStyle = wave.color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        for (let i=0;i<min.length;i++){
          const px = x + Math.floor(i * step);
          const v1 = min[i] * (trackH*0.35);
          const v2 = max[i] * (trackH*0.35);
          ctx.moveTo(px, mid + v1);
          ctx.lineTo(px, mid + v2);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // playhead
    ctx.strokeStyle = "rgba(99,102,241,.9)";
    ctx.beginPath();
    ctx.moveTo(Math.round(w/2)+0.5, 0);
    ctx.lineTo(Math.round(w/2)+0.5, h);
    ctx.stroke();
  }, [clips, bpm, pxPerSec, time, lanes]);

  // drop handling
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/sample");
    if (!raw) return;
    const s = JSON.parse(raw) as { name: string; src: string };
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top - headerH;
    const lane = Math.max(0, Math.min(lanes-1, Math.floor(y / (trackH + 8))));
    const start = time + xToSec(x - (canvasRef.current!.width / 2)); // drop under playhead
    addClip(s.name, s.src, lane, Math.max(0, start));
  }

  async function addClip(name: string, src: string, lane: number, start: number) {
    const w = await ensureWave(src);
    setClips(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name, src,
        start: Math.round(start*1000)/1000,
        duration: w.duration,
        fadeIn: 2.0, fadeOut: 2.0, gain: 1.0,
        lane, wave: w
      }
    ]);
  }

  // resize canvas on DPR changes
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = c.clientWidth, cssH = c.clientHeight;
    c.width = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    const ctx = c.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  });

  // controls bar
  const totalSec = useMemo(() => clips.reduce((t,c)=>Math.max(t, c.start + c.duration), 0), [clips]);

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-3 mb-3">
        <button className="btn-ghost rounded-lg px-3" onClick={togglePlay}>{playing ? "Pause" : "Play"}</button>
        <button className="btn-ghost rounded-lg px-3" onClick={()=>{ stopAudio(); setPlaying(false); setTime(0); }}>Stop</button>
        <div className="text-sm text-gray-300">Time: {time.toFixed(1)}s / {totalSec.toFixed(1)}s</div>
        <div className="ml-4 flex items-center gap-2 text-sm">
          <span className="text-gray-400">BPM</span>
          <input className="bg-white/10 px-2 py-1 rounded w-16" type="number" min={60} max={200} value={bpm}
                 onChange={e=>setBpm(parseInt(e.target.value||"128",10))}/>
        </div>
        <div className="ml-2 flex items-center gap-2 text-sm">
          <span className="text-gray-400">Zoom</span>
          <input className="w-40 accent-indigo-500" type="range" min={60} max={300} step={1} value={pxPerSec}
                 onChange={e=>setPxPerSec(parseInt(e.target.value,10))}/>
        </div>
        <div className="flex-1" />
        <button className="btn-primary rounded-lg" onClick={()=>renderMix(clips)}>Export WAV</button>
      </div>

      <div
        className="relative h-[360px] rounded-xl border border-white/10 bg-white/5 overflow-hidden"
        onDragOver={(e)=>e.preventDefault()}
        onDrop={onDrop}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        {/* hint */}
        <div className="absolute inset-x-0 top-2 text-center text-[12px] text-gray-400 pointer-events-none">
          Drag samples here • Playhead is centered • Scroll wheel to scroll page; use Zoom to fit
        </div>
      </div>
    </div>
  );
}
