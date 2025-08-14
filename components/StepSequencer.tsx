"use client";

import { useEffect, useRef, useState } from "react";

export type SeqTrack = {
  id: string;
  label: string;
  src?: string;        // assigned sample
  steps: number[];     // 0/1 per column
  buffer?: AudioBuffer;
  gain: number;        // 0..1
  muted?: boolean;
};

type BeatDoc = {
  id?: string;
  name: string;
  bpm: number;
  steps: number;
  pattern: { tracks: Omit<SeqTrack, "buffer">[] };
};

const uid = () => Math.random().toString(36).slice(2, 8);

export default function StepSequencer({
  initial,
  onSendToDAW
}: {
  initial?: BeatDoc;
  onSendToDAW?: (beat: BeatDoc) => void;
}) {
  // ---------- State ----------
  const [name, setName] = useState(initial?.name || "New Beat");
  const [bpm, setBpm] = useState(initial?.bpm || 120);
  const [cols, setCols] = useState(initial?.steps || 16);
  const [tracks, setTracks] = useState<SeqTrack[]>(
    (initial?.pattern?.tracks || []).map((t, i) => ({
      ...t,
      id: t.id || `r_${i}_${uid()}`,
      buffer: undefined,
      steps: (t.steps?.length ? t.steps : Array(cols).fill(0))
        .slice(0, cols)
        .concat(Array(Math.max(0, cols - (t.steps?.length || 0))).fill(0))
    }))
  );

  // keep steps length in sync when cols changes
  useEffect(() => {
    setTracks(prev => prev.map(t => {
      const next = t.steps.slice(0, cols);
      while (next.length < cols) next.push(0);
      return { ...t, steps: next };
    }));
  }, [cols]);

  // ---------- Audio ----------
  const acRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ac = new AC();
    acRef.current = ac;
    return () => { try { ac.close(); } catch {} acRef.current = null; };
  }, []);

  async function loadBuffer(src?: string) {
    if (!src || !acRef.current) return undefined;
    try {
      const res = await fetch(src);
      const arr = await res.arrayBuffer();
      return await acRef.current.decodeAudioData(arr);
    } catch { return undefined; }
  }

  // lazy-load buffers once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await Promise.all(tracks.map(async t => ({
        ...t,
        buffer: t.src ? await loadBuffer(t.src) : undefined
      })));
      if (!cancelled) setTracks(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Transport ----------
  const [isPlaying, setIsPlaying] = useState(false);
  const stepRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const stepDurSec = () => (60 / bpm) / 4; // 16th notes

  function scheduleStep(s: number) {
    const ac = acRef.current!;
    const when = ac.currentTime + 0.01;
    const durMs = stepDurSec() * 1000;

    tracks.forEach(t => {
      if (t.muted || !t.buffer) return;
      if (t.steps[s] === 1) {
        const src = ac.createBufferSource();
        src.buffer = t.buffer;
        const g = ac.createGain();
        g.gain.value = t.gain;
        src.connect(g).connect(ac.destination);
        src.start(when);
      }
    });

    return durMs;
  }

  function start() {
    if (isPlaying || !acRef.current) return;
    acRef.current.resume().catch(() => {});
    setIsPlaying(true);
    stepRef.current = 0;
    const tick = () => {
      const d = scheduleStep(stepRef.current);
      stepRef.current = (stepRef.current + 1) % cols;
      timerRef.current = window.setTimeout(tick, d);
    };
    tick();
  }
  function stop() {
    setIsPlaying(false);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  useEffect(() => {
    if (!isPlaying) return;
    stop(); start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); isPlaying ? stop() : start(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlaying]);

  // ---------- Grid ops ----------
  function toggleCell(r: number, c: number) {
    setTracks(prev => prev.map((t, i) =>
      i === r ? { ...t, steps: t.steps.map((v, j) => j === c ? (v ? 0 : 1) : v) } : t
    ));
  }

  async function setRowSrc(rowIdx: number, src?: string, label?: string) {
    setTracks(prev => prev.map((t, i) => i === rowIdx ? { ...t, src, label: label || t.label, buffer: undefined } : t));
    const buf = await loadBuffer(src);
    setTracks(prev => prev.map((t, i) => i === rowIdx ? { ...t, buffer: buf } : t));
  }

  function addRow(sample?: { name: string; src: string }) {
    const index = tracks.length;
    setTracks(prev => [...prev, {
      id: `r_${uid()}`,
      label: sample?.name || `Row ${index + 1}`,
      src: sample?.src,
      buffer: undefined,
      steps: Array(cols).fill(0),
      gain: 0.9,
      muted: false
    }]);
    if (sample?.src) loadBuffer(sample.src).then(buf => {
      setTracks(prev => prev.map((t, i) => i === index ? { ...t, buffer: buf } : t));
    });
  }

  function removeRow(r: number) {
    setTracks(prev => prev.filter((_, i) => i !== r));
  }

  // ---------- Drag & Drop ----------
  function parseDrag(e: React.DragEvent) {
    const types = Array.from((e.dataTransfer.types || []) as string[]);
    const grab = (t: string) => (types.includes(t) ? e.dataTransfer.getData(t) : "");
    let raw =
      grab("application/x-sample") ||
      grab("application/json") ||
      grab("text/uri-list") ||
      grab("text/plain");
    raw = (raw || "").trim();

    try { const j = JSON.parse(raw); if (j && j.src) return { name: j.name || "Sample", src: j.src as string }; } catch {}
    const m = raw.match(/(?:https?:\/\/|\b\/)[^ \n"'()]+?\.(?:mp3|wav|ogg|flac)/i);
    if (m) {
      const url = m[0]; const base = url.split("/").pop() || "Sample";
      return { name: base.replace(/\.[^.]+$/, ""), src: url };
    }
    return null;
  }
  const allowDrop = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };

  // ---------- WAV encoder ----------
  function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }
  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  function audioBufferToWav(ab: AudioBuffer) {
    const numOfChan = ab.numberOfChannels, samples = ab.length, sampleRate = ab.sampleRate;
    const bytesPerSample = 2, blockAlign = numOfChan * bytesPerSample;
    const buffer = new ArrayBuffer(44 + samples * blockAlign);
    const view = new DataView(buffer);
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples * blockAlign, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, samples * blockAlign, true);
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numOfChan; ch++) channels.push(ab.getChannelData(ch));
    let offset = 44;
    for (let i = 0; i < samples; i++) {
      for (let ch = 0; ch < numOfChan; ch++) {
        const sample = channels[ch][i];
        floatTo16BitPCM(view, offset, new Float32Array([sample]));
        offset += 2;
      }
    }
    return new Blob([view], { type: "audio/wav" });
  }

  // ---------- Save / Export ----------
  function toDoc(): BeatDoc {
    return {
      id: initial?.id,
      name, bpm, steps: cols,
      pattern: { tracks: tracks.map(({ buffer, ...rest }) => rest) }
    };
  }

  async function saveNew() {
    const r = await fetch("/api/beats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(toDoc()) });
    const j = await r.json().catch(() => null);
    if (r.ok) { localStorage.setItem("sb_last_beat", JSON.stringify(j ?? toDoc())); alert("Saved!"); }
    else alert(j?.error || "Save failed");
  }

  async function saveExisting() {
    if (!initial?.id) return saveNew();
    const r = await fetch(`/api/beats/${initial.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(toDoc()) });
    const j = await r.json().catch(() => null);
    if (r.ok) { localStorage.setItem("sb_last_beat", JSON.stringify(j ?? toDoc())); alert("Saved!"); }
    else alert(j?.error || "Save failed");
  }

  function handoffToDAW() {
    const doc = toDoc();
    localStorage.setItem("sb_last_beat", JSON.stringify(doc));
    onSendToDAW?.(doc);
    window.location.href = "/daw?from=sequencer";
  }

  async function exportAsSound() {
    const stepDur = stepDurSec();
    const duration = cols * stepDur + 2;
    const sampleRate = 44100;
    const offline = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);

    tracks.forEach(t => {
      if (!t.buffer || t.muted) return;
      t.steps.forEach((on, sIdx) => {
        if (!on) return;
        const when = sIdx * stepDur;
        const src = offline.createBufferSource();
        src.buffer = t.buffer as AudioBuffer;
        const g = offline.createGain();
        g.gain.value = t.gain;
        src.connect(g).connect(offline.destination);
        src.start(when);
      });
    });

    const rendered = await offline.startRendering();
    const wavBlob = audioBufferToWav(rendered);

    const b64 = await new Promise<string>(res => {
      const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(wavBlob);
    });

    const resp = await fetch("/api/beats/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, wavBase64: b64, durationMs: Math.round(rendered.duration * 1000) }),
    });

    if (resp.ok) {
      const created = await resp.json().catch(() => null);
      if (created) localStorage.setItem("sb_last_sound", JSON.stringify(created));
      alert("Exported as sound!");
    } else {
      const e = await resp.json().catch(() => ({ error: "Failed" }));
      alert(e.error || "Failed to export");
    }
  }

  // ---------- UI ----------
  return (
    <div className="space-y-4">
      {/* Top controls */}
      <header className="glass rounded-2xl px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center flex-wrap gap-3">
          <button
            className="rounded-lg px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-100"
            onClick={() => (isPlaying ? stop() : start())}
          >
            {isPlaying ? "Stop" : "Play"}
          </button>

          <div className="text-sm text-gray-300 flex items-center gap-2">
            <span className="opacity-80">BPM</span>
            <input
              type="number" min={50} max={240} value={bpm}
              onChange={e => setBpm(parseInt(e.target.value || "120", 10))}
              className="rounded px-2 py-1 w-20 bg-black/40 text-gray-100 border border-white/10"
            />
          </div>

          <div className="text-sm text-gray-300 flex items-center gap-2">
            <span className="opacity-80">Steps</span>
            <select
              className="rounded px-2 py-1 bg-black/40 text-gray-100 border border-white/10"
              value={cols}
              onChange={e => setCols(parseInt(e.target.value))}
            >
              {[8, 12, 16, 24, 32, 48, 64].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <button
            className="ml-1 rounded px-2 py-1 text-xs bg-white/10 hover:bg-white/15 text-gray-100"
            onClick={() => addRow()}
            title="Add empty row"
          >
            + Add row
          </button>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="ml-1 rounded px-3 py-1.5 bg-black/40 text-gray-100 placeholder-gray-400 border border-white/10"
            placeholder="New Beat"
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-lg px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-100" onClick={saveExisting}>Save</button>
          <button className="rounded-lg px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-100" onClick={saveNew}>Save as New</button>
          <button className="rounded-lg px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-100" onClick={exportAsSound}>Export as Sound</button>
          <button className="rounded-lg px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-100" onClick={handoffToDAW}>Send to DAW</button>
        </div>
      </header>

      {/* Grid wrapper — drop here to create a new row with the dropped sample */}
      <div
        className="glass rounded-2xl p-4 overflow-auto"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDrop={(e) => {
          const s = parseDrag(e);
          if (!s) return;
          addRow(s);
        }}
      >
        <div className="min-w-[820px]">
          {tracks.map((t, rIdx) => (
            <div key={t.id} className="flex items-center gap-2 py-2">
            {/* Sample name */}
            <input
              className="bg-white/5 rounded-lg border border-white/10 px-2 py-1 text-sm text-gray-100 w-32 outline-none"
              value={t.label}
              onChange={e => setTracks(prev => prev.map((x,i)=> i===rIdx ? { ...x, label: e.target.value } : x))}
            />

            {/* Slider */}
            <input
              type="range" min={0} max={1} step={0.01}
              value={t.gain}
              onChange={e => setTracks(prev => prev.map((x,i)=> i===rIdx ? { ...x, gain: parseFloat(e.target.value) } : x))}
              className="w-28 md:w-32"
            />

            {/* Mute & Remove */}
            <button
              className="text-[11px] px-2 py-1 rounded bg-black/30 hover:bg-black/40 text-gray-100 border border-white/10"
              onClick={() => setTracks(prev => prev.map((x,i)=> i===rIdx ? { ...x, muted: !x.muted } : x))}
            >
              {t.muted ? "Unmute" : "Mute"}
            </button>
            <button
              className="text-[13px] leading-none px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-white/10"
              onClick={() => removeRow(rIdx)}
            >
              ×
            </button>

            {/* Step cells */}
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 22px)` }}>
              {t.steps.map((v, cIdx) => (
                <button
                  key={cIdx}
                  onClick={() => toggleCell(rIdx, cIdx)}
                  onDragOver={allowDrop}
                  onDrop={(e) => {
                    e.stopPropagation();
                    const s = parseDrag(e); if (!s) return;
                    if (!tracks[rIdx].src) setRowSrc(rIdx, s.src, s.name);
                    setTracks(prev => prev.map((row,i) => i===rIdx ? {
                      ...row, steps: row.steps.map((vv,j)=> j===cIdx ? 1 : vv)
                    } : row));
                  }}
                  className={`w-[22px] h-[22px] rounded-md border border-white/10 ${v ? "bg-fuchsia-500/90" : "bg-black/30 hover:bg-black/40"}`}
                />
              ))}
            </div>
          </div>

          ))}
        </div>
      </div>
    </div>
  );
}
