// lib/safeAudio.ts
let _ctx: AudioContext | null = null;
export function getCtx() {
  if (typeof window === "undefined") return null;
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _ctx!;
}

function norm(url: string) {
  // handle spaces and non-ascii safely
  return encodeURI(url);
}

export type Player =
  | { kind: "buffer"; play: () => void; stop: () => void; dispose: () => void }
  | { kind: "media"; el: HTMLAudioElement; play: () => void; stop: () => void; dispose: () => void };

export async function createPlayer(src: string): Promise<Player> {
  const ctx = getCtx();
  if (!ctx) throw new Error("AudioContext not available");
  // iOS/autoplay: resume on first user gesture
  try { await ctx.resume(); } catch {}

  const url = norm(src);

  // Try WebAudio decode first
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    const buffer = await ctx.decodeAudioData(ab);

    let node: AudioBufferSourceNode | null = null;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    return {
      kind: "buffer",
      play() {
        if (!buffer) return;
        node?.stop();
        node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(gain);
        node.start();
      },
      stop() {
        node?.stop();
        node = null;
      },
      dispose() {
        try { node?.disconnect(); gain.disconnect(); } catch {}
      }
    };
  } catch (err) {
    // Fallback: HTMLAudioElement + MediaElementSource
    const el = new Audio();
    el.src = url;
    el.preload = "auto";
    el.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      const ok = () => { cleanup(); resolve(); };
      const bad = () => { cleanup(); reject(new Error("media element failed")); };
      const cleanup = () => {
        el.removeEventListener("canplaythrough", ok);
        el.removeEventListener("error", bad);
      };
      el.addEventListener("canplaythrough", ok, { once: true });
      el.addEventListener("error", bad, { once: true });
    });

    const srcNode = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    srcNode.connect(gain).connect(ctx.destination);

    return {
      kind: "media",
      el,
      play() { el.currentTime = 0; el.play().catch(() => {}); },
      stop() { el.pause(); el.currentTime = 0; },
      dispose() {
        try { srcNode.disconnect(); gain.disconnect(); } catch {}
        el.src = "";
      }
    };
  }
}
