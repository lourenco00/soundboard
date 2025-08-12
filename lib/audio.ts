let ctx: AudioContext | null = null;

export function getAudioContext() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx!;
}

type MasterBus = {
  input: GainNode;
  reverbIn: GainNode;
  reverbOut: ConvolverNode;
  limiter: DynamicsCompressorNode;
  panA: GainNode; // for crossfader deck A
  panB: GainNode; // for crossfader deck B
  output: GainNode;
};

let master: MasterBus | null = null;

export async function getMaster() {
  if (master) return master;
  const ac = getAudioContext();

  const input = ac.createGain();
  const reverbIn = ac.createGain();
  const convolver = ac.createConvolver();
  const limiter = ac.createDynamicsCompressor(); // gentle “limiter”
  const panA = ac.createGain();
  const panB = ac.createGain();
  const output = ac.createGain();

  // Limiter settings
  limiter.threshold.value = -6;
  limiter.knee.value = 12;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;

  // Load impulse response (reverb)
  const resp = await fetch("/impulses/medium-room.wav").then(r => r.arrayBuffer());
  convolver.buffer = await ac.decodeAudioData(resp);

  // Graph: dry -> (A/B) -> input -> limiter -> destination
  input.connect(limiter);
  limiter.connect(output);
  output.connect(ac.destination);

  // Reverb send -> convolver -> input
  reverbIn.connect(convolver);
  convolver.connect(input);

  // Deck A/B (used by crossfader)
  panA.connect(input);
  panB.connect(input);

  master = { input, reverbIn, reverbOut: convolver, limiter, panA, panB, output };
  return master!;
}

export function setCrossfader(x: number) {
  // x in [0..1] (0 = full A, 1 = full B), use equal‑power curve
  if (!master) return;
  const a = Math.cos(x * 0.5 * Math.PI);
  const b = Math.cos((1 - x) * 0.5 * Math.PI);
  master.panA.gain.value = a;
  master.panB.gain.value = b;
}