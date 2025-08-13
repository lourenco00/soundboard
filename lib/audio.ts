// lib/audio.ts
let _ctx: AudioContext | null = null;
export function getAudioContext() {
  if (typeof window === "undefined") throw new Error("No window");
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _ctx!;
}

type Master = {
  master: GainNode;
  panA: GainNode;          // deck A gain
  panB: GainNode;          // deck B gain
  reverbIn: GainNode;      // global send bus input
};

// keep single graph
let _masterNodes: Master | null = null;
let _initPromise: Promise<Master> | null = null;

export async function getMaster(): Promise<Master> {
  if (_masterNodes) return _masterNodes;
  if (_initPromise) return _initPromise;
  _initPromise = initMaster();
  _masterNodes = await _initPromise;
  return _masterNodes;
}

async function initMaster(): Promise<Master> {
  const ac = getAudioContext();

  const master = ac.createGain();
  master.gain.value = 1;
  master.connect(ac.destination);

  const panA = ac.createGain();
  const panB = ac.createGain();
  panA.gain.value = 1;
  panB.gain.value = 1;
  panA.connect(master);
  panB.connect(master);

  const reverbIn = ac.createGain();
  reverbIn.gain.value = 0.25;

  // Optional: try to load an impulse; if missing, just bypass.
  try {
    const res = await fetch("/impulses/medium-room.wav", { cache: "force-cache" });
    if (!res.ok) throw new Error(`IR HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    const buf = await ac.decodeAudioData(ab);

    const convolver = ac.createConvolver();
    convolver.buffer = buf;
    const wet = ac.createGain();
    wet.gain.value = 0.8;

    reverbIn.connect(convolver);
    convolver.connect(wet).connect(master);
  } catch {
    // IR not present or failed to decode → route send straight to master
    reverbIn.connect(master);
    console.info("[audio] No impulse; reverb disabled.");
  }

  return { master, panA, panB, reverbIn };
}

/** Equal-power crossfader between Deck A (0) and Deck B (1). */
export async function setCrossfader(pos: number) {
  const { panA, panB } = await getMaster();
  const x = Math.min(1, Math.max(0, pos));
  // equal-power law
  const t = x * Math.PI / 2;
  const a = Math.cos(t);
  const b = Math.sin(t);
  panA.gain.value = a * a;
  panB.gain.value = b * b;
}

/** Master volume (0..1). */
export async function setMasterVolume(v: number) {
  const { master } = await getMaster();
  master.gain.value = Math.min(1, Math.max(0, v));
}
